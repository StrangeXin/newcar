# Plan 10: 生产部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 newcar 首次生产部署准备 — 生产 Docker Compose + Dockerfile 构建 + 环境变量管理 + CI/CD 流水线 + 数据库迁移策略 + 健康检查监控 + 上线前检查清单。

---

## 部署架构说明

### 服务关系图

```
Internet (HTTPS :443 / HTTP :80)
        │
        ▼
  ┌─────────────┐
  │    Nginx    │  反向代理 + SSL 终止 + 静态资源
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌───────┐
│  API  │  │  Web  │  仅内部网络可达
│ :3000 │  │ :3001 │
└───┬───┘  └───────┘
    │
    │  内部网络（app-network）
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
┌──────────┐            ┌──────────┐
│ PostgreSQL│            │  Redis   │
│  :5432   │            │  :6379   │
└──────────┘            └──────────┘
    │
    ▼
┌──────────┐   ┌─────────────────────┐
│ Weaviate │──▶│  t2v-transformers   │
│  :8080   │   │  (内部 :8080)        │
└──────────┘   └─────────────────────┘
```

### 网络隔离原则

- 只有 Nginx 暴露宿主机端口（80 / 443）
- API、Web、PostgreSQL、Redis、Weaviate 均在内部 Docker 网络 `app-network`，不对外暴露端口
- Nginx 通过容器名称访问上游服务（`http://api:3000`、`http://web:3001`）
- t2v-transformers 仅被 Weaviate 访问，处于最内层

### 路由规则

| 路径前缀 | 上游 | 说明 |
|----------|------|------|
| `/api/` | `api:3000` | REST API，去掉 `/api` 前缀转发 |
| `/health` | `api:3000` | 健康检查，Nginx 直连 |
| `/_next/` | `web:3001` | Next.js 静态资源 |
| `/` | `web:3001` | Next.js 页面 |

---

## File Structure

```
newcar/
├── apps/
│   ├── api/
│   │   └── Dockerfile                    # Task 2
│   └── web/
│       └── Dockerfile                    # Task 2
├── nginx/
│   ├── nginx.conf                        # Task 1 — Nginx 主配置
│   └── conf.d/
│       └── default.conf                  # Task 1 — 虚拟主机配置
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Task 4 — PR 测试
│       └── deploy.yml                    # Task 4 — main 分支部署
├── docker-compose.yml                    # 现有开发环境（不修改）
├── docker-compose.prod.yml               # Task 1 — 生产环境
├── .env.production.example               # Task 3 — 环境变量模板
└── scripts/
    └── migrate.sh                        # Task 5 — 迁移脚本
```

---

## Task 1: 生产 docker-compose.prod.yml

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `nginx/nginx.conf`
- Create: `nginx/conf.d/default.conf`

### 架构决策

**容器构成：** 6 个服务 — api、web、nginx、postgres、redis、weaviate（含 t2v-transformers 子依赖）。

**网络设计：**
- 单一内部网络 `app-network`（bridge 模式）
- 仅 nginx 服务通过 `ports` 暴露 80/443
- 其余所有服务只声明 `expose`（容器间通信），不绑定宿主机端口

**持久化：** 每个有状态服务使用具名 volume，由 Docker Engine 管理，不映射到宿主机路径。具名 volume 命名规范：`newcar_prod_{service}_{数据类型}`。

**重启策略：** 所有服务设置 `restart: unless-stopped`，Nginx 额外设置 `depends_on: [api, web]`，API 设置 `depends_on: [postgres, redis]`。

**资源限制：** 生产环境各容器添加 `deploy.resources.limits` 约束内存上限，防止单个容器 OOM 影响整机：
- api: 512m
- web: 256m
- nginx: 128m
- postgres: 1g
- redis: 256m
- weaviate: 2g（含向量计算）
- t2v-transformers: 1g

### docker-compose.prod.yml 服务声明规范

**api 服务**
- `build.context: ./apps/api`，使用多阶段 Dockerfile
- `build.target: production`（multi-stage 目标阶段）
- 环境变量通过 `env_file: .env.production` 注入
- `expose: ["3000"]`，不对外暴露
- 启动命令：`node dist/index.js`（不使用 ts-node）
- 数据库迁移由独立 `entrypoint.sh` 在容器启动时执行（见 Task 5）

**web 服务**
- `build.context: ./apps/web`，Next.js standalone 构建
- `expose: ["3001"]`
- 环境变量：`NEXT_PUBLIC_API_URL`（通过 env_file 注入）
- 启动命令：`node server.js`（Next.js standalone 产物）

**nginx 服务**
- 使用官方 `nginx:stable-alpine` 镜像（不自行构建）
- 挂载 `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro` 和 `./nginx/conf.d:/etc/nginx/conf.d:ro`
- `ports: ["80:80", "443:443"]`
- SSL 证书目录挂载：`./ssl:/etc/nginx/ssl:ro`（证书由外部工具（如 Certbot）管理，部署前准备好）

**postgres 服务**
- `image: postgres:16-alpine`
- 数据目录：volume `newcar_prod_postgres_data` 挂载到 `/var/lib/postgresql/data`
- 环境变量通过 `env_file: .env.production` 注入（POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD）
- `expose: ["5432"]`
- 健康检查：`pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB`，interval 10s，retries 5

**redis 服务**
- `image: redis:7-alpine`
- 启动命令添加 `--requirepass ${REDIS_PASSWORD}`（从环境变量读取）
- 数据目录：volume `newcar_prod_redis_data` 挂载到 `/data`
- `expose: ["6379"]`
- 健康检查：`redis-cli -a $$REDIS_PASSWORD ping`

**weaviate 服务**
- `image: cr.weaviate.io/semitechnologies/weaviate:1.28.2`（与开发环境版本保持一致）
- `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "false"`（生产环境关闭匿名访问）
- 添加 `AUTHENTICATION_APIKEY_ENABLED: "true"` 和 `AUTHENTICATION_APIKEY_ALLOWED_KEYS`
- 数据目录：volume `newcar_prod_weaviate_data` 挂载到 `/var/lib/weaviate`
- `expose: ["8080"]`
- `depends_on: [t2v-transformers]`

**t2v-transformers 服务**
- `image: cr.weaviate.io/semitechnologies/transformers-inference:sentence-transformers-multi-qa-MiniLM-L6-cos-v1`
- `expose: ["8080"]`（仅 weaviate 内部访问，端口号与 weaviate 宿主不冲突因为都是容器内）

### Nginx 配置规范

**nginx/nginx.conf 主配置**
- `worker_processes auto`
- `worker_connections 1024`
- 开启 `gzip on`，压缩 text/html、application/json、text/css、application/javascript
- `server_tokens off`（隐藏 Nginx 版本）
- 日志格式包含 `$upstream_response_time` 便于排查慢请求

**nginx/conf.d/default.conf 虚拟主机**
- HTTP（:80）→ 301 重定向到 HTTPS
- HTTPS（:443）启用 TLS 1.2/1.3，证书路径 `/etc/nginx/ssl/fullchain.pem` 和 `privkey.pem`
- 安全响应头：`X-Frame-Options SAMEORIGIN`、`X-Content-Type-Options nosniff`、`Strict-Transport-Security max-age=31536000`
- upstream `api_backend { server api:3000; }` 和 `upstream web_backend { server web:3001; }`
- `/api/` location：`proxy_pass http://api_backend/`（去掉 /api 前缀），添加标准 proxy_set_header
- `/health` location：`proxy_pass http://api_backend/health`，`access_log off`
- `/` location：`proxy_pass http://web_backend`，Next.js SSR 需传递 Host 头
- 客户端请求体最大 10m（`client_max_body_size 10m`）

- [ ] **Step 1: 创建 nginx/ 目录结构**

  - Create: `nginx/nginx.conf`
  - Create: `nginx/conf.d/default.conf`

  nginx.conf 关键配置项（不含代码，约定如下）：
  - events.worker_connections: 1024
  - http 块包含 gzip、log_format、include conf.d/*.conf
  - upstream 块定义在 conf.d/default.conf 中

- [ ] **Step 2: 创建 docker-compose.prod.yml**

  按上述架构决策声明所有服务，网络统一引用 `app-network`（driver: bridge），volumes 段声明所有具名 volume。

- [ ] **Step 3: 本地验证 compose 配置有效**

  Run: `docker compose -f docker-compose.prod.yml config`
  Expected: 输出合并后的配置，无 YAML 语法错误

- [ ] **Step 4: Commit**

  ```bash
  git add docker-compose.prod.yml nginx/
  git commit -m "feat: add production docker-compose and nginx configuration"
  ```

---

## Task 2: Dockerfile 编写

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`

### 架构决策

**多阶段构建原则：** 使用 multi-stage build 分离构建依赖与运行时，生产镜像只包含运行必要文件，减小攻击面和镜像体积。

**基础镜像：** 统一使用 `node:20-alpine` 系列（Alpine 减小体积；Node 20 LTS 与 TypeScript 5.x 兼容）。

**运行用户：** 生产阶段创建非 root 用户（`addgroup -S appgroup && adduser -S appuser -G appgroup`），以 `appuser` 运行进程，防止容器逃逸时拥有 root 权限。

**Prisma 生成：** API Dockerfile 在构建阶段执行 `prisma generate`，确保 Prisma Client 已生成并包含在 `node_modules/.prisma`。

### apps/api/Dockerfile 阶段说明

**Stage 1: deps（依赖安装）**
- FROM node:20-alpine AS deps
- 仅复制 package*.json 和 prisma/schema.prisma
- `npm ci --only=production` 生产依赖 + `npm ci` 全量依赖（用于构建）
- 分开两个 WORKDIR/COPY 以利用 Docker 层缓存

**Stage 2: builder（TypeScript 编译）**
- FROM node:20-alpine AS builder
- 从 deps 阶段 COPY 全量 node_modules
- 复制源代码
- 运行 `npx prisma generate`（读取 schema.prisma 生成 client）
- 运行 `npm run build`（tsc 编译输出到 dist/）

**Stage 3: production（运行时）**
- FROM node:20-alpine AS production
- 仅从 builder 阶段 COPY `dist/`、`node_modules/`、`prisma/`
- 创建非 root 用户
- EXPOSE 3000
- ENV NODE_ENV=production
- CMD ["node", "dist/index.js"]

**关键文件列表（Dockerfile 中 COPY 的路径）：**
- `package.json`
- `prisma/schema.prisma`
- `dist/`（编译产物）
- `node_modules/`（仅生产依赖）

### apps/web/Dockerfile 阶段说明

Next.js 15 支持 `output: 'standalone'`，需先在 `next.config.js`/`next.config.ts` 中添加该配置。

**Stage 1: deps**
- FROM node:20-alpine AS deps
- COPY package*.json
- `npm ci`

**Stage 2: builder**
- FROM node:20-alpine AS builder
- COPY 全量 node_modules 和源代码
- ENV NEXT_TELEMETRY_DISABLED=1
- 运行 `npm run build`
- Next.js standalone 产物输出到 `.next/standalone/`

**Stage 3: production**
- FROM node:20-alpine AS production
- 仅 COPY `.next/standalone/`（包含内嵌 server.js 和 node_modules）
- COPY `.next/static/` → `.next/standalone/.next/static/`（静态资源需单独复制）
- COPY `public/` → `.next/standalone/public/`
- 创建非 root 用户
- EXPOSE 3001
- ENV NODE_ENV=production PORT=3001
- CMD ["node", "server.js"]

**next.config 配置约定（由本 Task 确认存在）：**
- `output: 'standalone'` 必须存在，否则 standalone 目录不会生成
- 若 `next.config.ts` 尚未有此配置，Step 1 需添加

- [ ] **Step 1: 确认/更新 apps/web/next.config 添加 standalone 输出**

  - Modify: `apps/web/next.config.ts`（或 next.config.js）
  - 确认 `output: 'standalone'` 存在于 nextConfig 对象中

- [ ] **Step 2: 创建 apps/api/Dockerfile**

  按上述三阶段规范创建，注意 prisma generate 在 builder 阶段。

- [ ] **Step 3: 创建 apps/web/Dockerfile**

  按上述三阶段规范创建，注意 static 资源需从 builder 复制到 standalone 目录。

- [ ] **Step 4: 创建 .dockerignore 文件**

  - Create: `apps/api/.dockerignore`
  - Create: `apps/web/.dockerignore`

  两者均排除：`node_modules/`、`.next/`（web 独有）、`dist/`（api 独有）、`.env*`、`*.test.ts`、`coverage/`、`.git`

- [ ] **Step 5: 本地构建验证**

  Run: `docker build -t newcar-api:local apps/api/ && docker build -t newcar-web:local apps/web/`
  Expected: 两个镜像构建成功，无错误

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/Dockerfile apps/api/.dockerignore apps/web/Dockerfile apps/web/.dockerignore apps/web/next.config.*
  git commit -m "feat: add multi-stage Dockerfiles for API and Web"
  ```

---

## Task 3: 环境变量与 Secrets

**Files:**
- Create: `.env.production.example`
- 无需创建额外文件；secrets 管理以文档约定形式记录在本 Task 中

### .env.production.example 变量清单

文件位于项目根目录，供运维人员参考，实际 `.env.production` 不进入版本控制（已加入 .gitignore）。

**数据库**

| 变量名 | 说明 | 示例格式 |
|--------|------|---------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://USER:PASSWORD@postgres:5432/newcar` |
| `POSTGRES_DB` | 数据库名 | `newcar` |
| `POSTGRES_USER` | 数据库用户名 | （自定义） |
| `POSTGRES_PASSWORD` | 数据库密码 | （强密码，32字符以上） |

**Redis**

| 变量名 | 说明 |
|--------|------|
| `REDIS_URL` | Redis 连接串，含密码 `redis://:PASSWORD@redis:6379` |
| `REDIS_PASSWORD` | Redis AUTH 密码（与 compose 中 `--requirepass` 一致） |

**认证**

| 变量名 | 说明 |
|--------|------|
| `JWT_SECRET` | JWT 签名密钥，64字符以上随机字符串 |
| `OTP_SECRET` | OTP 加密盐，32字符以上 |

**微信**

| 变量名 | 说明 |
|--------|------|
| `WECHAT_APP_ID` | 微信公众号/小程序 AppID |
| `WECHAT_APP_SECRET` | 微信 AppSecret |
| `WECHAT_TEMPLATE_PRICE_DROP` | 微信价格提醒模板 ID |
| `WECHAT_TEMPLATE_NEW_REVIEW` | 微信新评论模板 ID |

**AI 服务**

| 变量名 | 说明 |
|--------|------|
| `AI_API_KEY` | AI 服务 API Key |
| `AI_MODEL` | 使用的模型名称 |
| `AI_BASE_URL` | AI 服务 Base URL（国内中转地址） |

**Weaviate**

| 变量名 | 说明 |
|--------|------|
| `WEAVIATE_HOST` | `http://weaviate:8080`（内部地址） |
| `WEAVIATE_API_KEY` | Weaviate 访问密钥（与 compose 配置一致） |

**应用配置**

| 变量名 | 说明 |
|--------|------|
| `NODE_ENV` | `production` |
| `PORT` | `3000`（API 内部端口） |
| `NEXT_PUBLIC_API_URL` | 前端调用 API 的公网地址，如 `https://api.example.com` |

### Secrets 管理原则

以下原则适用于本项目，不绑定具体工具：

1. **零明文提交原则**：`.env.production` 绝不进入 Git。`.gitignore` 必须包含 `.env.production` 和 `.env*.local`。仅 `.env.production.example`（无真实值）进入版本库。

2. **最小权限原则**：数据库用户只授予应用所需权限（SELECT/INSERT/UPDATE/DELETE），不使用超级用户；Redis 启用 AUTH；Weaviate 关闭匿名访问。

3. **密钥轮换原则**：JWT_SECRET、数据库密码、Redis 密码需有轮换机制。轮换前确保所有现有 JWT 失效时间可接受（或提前失效）。

4. **注入方式原则**：CI/CD 环境（GitHub Actions）通过 Repository Secrets 注入；服务器上通过受保护的 `.env.production` 文件（权限 600，所有者为运行 Docker 的用户）注入，不通过命令行参数传递。

5. **审计原则**：变更 secrets 时记录变更人、变更时间、变更原因（可通过 Git commit 描述或内部变更日志）。

- [ ] **Step 1: 创建 .env.production.example**

  按上述变量清单创建，所有值使用占位符（如 `REPLACE_ME`、`<your-value>` 格式）。

- [ ] **Step 2: 确认 .gitignore 包含保护规则**

  - Verify: 项目根 `.gitignore` 包含 `.env.production`、`.env*.local`、`.env.*.local`
  - 若不存在，追加这些规则

- [ ] **Step 3: Commit**

  ```bash
  git add .env.production.example .gitignore
  git commit -m "feat: add production environment variable template and gitignore rules"
  ```

---

## Task 4: CI/CD（GitHub Actions）

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

### 架构决策

**两条流水线分离：**
- `ci.yml`：触发于 PR（`pull_request` 事件），只跑测试，快速反馈，不部署
- `deploy.yml`：触发于 push to main，跑测试 + 构建镜像 + SSH 部署

**不使用容器注册表（简化首次部署）：** 在服务器上直接执行 `git pull + docker compose up --build`，无需推送镜像到 Docker Hub/阿里云 ACR。镜像构建在目标服务器完成。适合单机部署阶段。

**SSH 部署方式：** GitHub Actions 通过 `appleboy/ssh-action` SSH 到生产服务器执行部署命令。服务器 SSH 私钥存储在 GitHub Repository Secrets（`SERVER_SSH_KEY`）。

**必需的 GitHub Secrets（在 Repository Settings > Secrets 中配置）：**

| Secret 名称 | 用途 |
|-------------|------|
| `SERVER_HOST` | 生产服务器 IP 或域名 |
| `SERVER_USER` | SSH 登录用户名 |
| `SERVER_SSH_KEY` | SSH 私钥（PEM 格式完整内容） |
| `SERVER_DEPLOY_PATH` | 服务器上项目目录，如 `/opt/newcar` |

### ci.yml 工作流规范

**触发条件：** `on: pull_request: branches: [main]`

**Job: test**
- runs-on: ubuntu-latest
- 步骤：
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4`（node-version: '20', cache: 'npm'）
  3. `npm ci`（根目录，安装 workspace 所有依赖）
  4. `npm run build --workspace=packages/shared`（shared 包先编译）
  5. `npm test --workspace=apps/api`（运行 vitest）
  6. `npm run typecheck --workspace=apps/api`（tsc --noEmit 类型检查）
  7. `npm run typecheck --workspace=apps/web`（可选，若有 typecheck script）

**目的：** PR 合并前确保测试通过、类型安全。

### deploy.yml 工作流规范

**触发条件：** `on: push: branches: [main]`

**Job 1: test**（与 ci.yml 相同，复用测试步骤）

**Job 2: deploy**
- needs: [test]（测试通过后才部署）
- runs-on: ubuntu-latest
- 步骤：
  1. `appleboy/ssh-action@v1.0.0`，通过 secrets 获取连接信息
  2. SSH 执行的命令序列（见下方部署命令约定）

**部署命令序列（SSH 执行）：**

```
cd ${{ secrets.SERVER_DEPLOY_PATH }}
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
docker image prune -f
```

**命令说明：**
- `up --build -d`：重新构建变更的镜像并以 detached 模式启动（未变更的容器不重建）
- `exec -T api npx prisma migrate deploy`：在运行中的 api 容器执行数据库迁移（`-T` 禁用 TTY，兼容非交互环境）
- `image prune -f`：清理悬空镜像，释放磁盘空间

**部署超时设置：** SSH action timeout 设置为 15 分钟，足以完成镜像构建和启动。

- [ ] **Step 1: 创建 .github/workflows/ 目录（若不存在）**

- [ ] **Step 2: 创建 .github/workflows/ci.yml**

  按上述规范创建，包含 test job。

- [ ] **Step 3: 创建 .github/workflows/deploy.yml**

  按上述规范创建，包含 test job + deploy job，deploy 使用 appleboy/ssh-action。

- [ ] **Step 4: 验证 workflow 文件 YAML 语法**

  Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml OK')"` 和同样验证 deploy.yml
  Expected: 两个文件均输出 OK

- [ ] **Step 5: Commit**

  ```bash
  git add .github/
  git commit -m "feat: add CI/CD workflows for testing and deployment"
  ```

---

## Task 5: 数据库迁移策略

**Files:**
- Create: `scripts/migrate.sh`（可选辅助脚本，用于手动迁移操作）

### 架构决策

**迁移执行时机：** Prisma 迁移在 API 容器启动时、应用监听端口之前自动执行。不依赖 CI/CD 流程的单独步骤（因为 CI 只有 SSH 权限而无数据库直连）。

**迁移命令：** `prisma migrate deploy`（非 `migrate dev`）。`migrate deploy` 只应用已提交的迁移文件，不生成新迁移，适合生产环境。

### 容器启动入口点约定

API 容器使用 shell 入口脚本而非直接 CMD，确保迁移先于应用启动完成：

**`apps/api/entrypoint.sh` 执行逻辑（非代码，逻辑约定）：**
1. 等待 PostgreSQL 就绪（最多重试 30 次，每次间隔 2 秒，使用 `pg_isready` 或简单 TCP 探测）
2. 执行 `npx prisma migrate deploy`
3. 若迁移失败（exit code != 0），脚本以非零退出，容器启动失败（触发 Docker restart 策略）
4. 迁移成功后执行 `node dist/index.js`

**Dockerfile 对应修改：** `apps/api/Dockerfile` production 阶段将 `entrypoint.sh` 复制进镜像，设置执行权限，CMD 改为 `["sh", "entrypoint.sh"]`。

### 迁移前备份流程

**备份命令约定（在 deploy.yml 的 deploy job 中，`docker compose up --build` 之前执行）：**

SSH 执行：
```
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > /opt/backups/$BACKUP_FILE
gzip /opt/backups/$BACKUP_FILE
```

**备份目录：** `/opt/backups/`，在服务器上预先创建，建议保留最近 7 天的备份（cron 清理旧备份）。

**备份时机：** 迁移前备份，即 `docker compose up --build` 之前。

### 回滚方案

Prisma 不提供自动 down migration。回滚策略分两级：

**Level 1 — 应用级回滚（推荐，无迁移变更时）：**
- 若新版本有 bug 但无 schema 变更：直接 `git revert` + 重新部署
- `git push origin main` 触发 deploy.yml 重新部署上一个版本

**Level 2 — 数据库回滚（有 schema 变更时）：**
1. 停止 api 容器：`docker compose -f docker-compose.prod.yml stop api`
2. 从备份恢复：`gunzip -c /opt/backups/backup_YYYYMMDD_HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB`
3. Checkout 上一个稳定的 Git tag/commit
4. 重新部署

**不可逆迁移的预防原则：**
- 删除列/表的迁移应分两步：第一次部署标记为废弃（代码停止使用），第二次部署才删除
- 重命名列应通过添加新列 + 数据迁移 + 删除旧列三步完成，不直接 rename

### scripts/migrate.sh 功能约定

手动操作辅助脚本，供运维在服务器上直接执行：
- 支持参数 `backup`：执行数据库备份
- 支持参数 `deploy`：执行 `prisma migrate deploy`
- 支持参数 `status`：执行 `prisma migrate status`（查看迁移状态）
- 包含前置检查：确认 `.env.production` 存在

- [ ] **Step 1: 修改 apps/api/Dockerfile（production 阶段）**

  - 在 production 阶段 COPY `entrypoint.sh`
  - `RUN chmod +x entrypoint.sh`
  - 将 `CMD ["node", "dist/index.js"]` 改为 `CMD ["sh", "entrypoint.sh"]`

- [ ] **Step 2: 创建 apps/api/entrypoint.sh**

  按上述逻辑约定实现，包含等待 PostgreSQL 就绪、prisma migrate deploy、启动应用三步。

- [ ] **Step 3: 更新 deploy.yml 添加迁移前备份步骤**

  在 deploy job 的 SSH 命令序列中，在 `docker compose up --build` 前添加备份命令。

- [ ] **Step 4: 创建 scripts/migrate.sh**

  按上述功能约定实现。

- [ ] **Step 5: 在服务器上创建备份目录（文档约定，非自动化）**

  服务器手动操作：`mkdir -p /opt/backups && chmod 700 /opt/backups`

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/entrypoint.sh apps/api/Dockerfile scripts/
  git commit -m "feat: add database migration strategy with backup and entrypoint"
  ```

---

## Task 6: 健康检查与监控

**Files:**
- Modify: `nginx/conf.d/default.conf`（添加 upstream 健康检查配置）
- Modify: `docker-compose.prod.yml`（确认所有服务的 healthcheck 配置）

### 现有 /health 端点

`GET /health` 已在 `apps/api/src/app.ts` 实现，返回：
```json
{ "status": "ok", "timestamp": "2026-03-22T00:00:00.000Z" }
```

### /health 端点增强约定

生产环境的 `/health` 应返回更详细的依赖状态，以支持运维排查。建议响应格式：

```
{
  "status": "ok" | "degraded" | "error",
  "timestamp": "ISO8601",
  "checks": {
    "database": "ok" | "error",
    "redis": "ok" | "error"
  }
}
```

HTTP 状态码：
- 所有依赖正常 → 200
- 任一依赖异常 → 503

**Modify: `apps/api/src/app.ts`（或独立 health 路由）**
- `/health` 路由同时检查 PostgreSQL（`prisma.$queryRaw('SELECT 1')`）和 Redis（`redis.ping()`）
- 任一失败返回 503，body 中 status 字段标记为 `"error"` 并在 checks 中指明哪个失败

### Nginx Upstream 健康检查配置

开源版 Nginx 不支持主动 upstream health check（需要 Nginx Plus 或第三方模块）。本项目采用**被动健康检查**（passive）：

- 在 `upstream api_backend` 块中配置 `max_fails=3 fail_timeout=30s`
- Nginx 会在 30 秒内记录 3 次失败后，将该 upstream 标记为不可用 30 秒
- 结合 Docker healthcheck + restart 策略，服务崩溃会自动重启，Nginx 随后恢复

**Nginx 配置约定（在 default.conf upstream 块）：**
```
upstream api_backend {
    server api:3000 max_fails=3 fail_timeout=30s;
}
```

同理配置 `web_backend`。

### Docker Compose 健康检查配置

**api 服务 healthcheck 约定：**
- test: `["CMD", "wget", "-qO-", "http://localhost:3000/health"]`
- interval: 30s
- timeout: 10s
- retries: 3
- start_period: 40s（给 prisma migrate deploy 留出时间）

**web 服务 healthcheck 约定：**
- test: `["CMD", "wget", "-qO-", "http://localhost:3001/"]`
- interval: 30s
- timeout: 10s
- retries: 3
- start_period: 30s

**postgres、redis healthcheck：** 已在 Task 1 中指定（`pg_isready`、`redis-cli ping`）。

### 基础 Uptime 监控配置说明

**方案：外部 HTTP 探测（推荐最简方式）**

使用外部 Uptime 监控服务（如 UptimeRobot、Uptime Kuma 自建等）定期 HTTP GET `https://your-domain/health`：
- 探测间隔：5 分钟
- 告警条件：连续 2 次探测失败（避免单次网络抖动触发误报）
- 告警通道：企业微信 webhook 或邮件

**Uptime Kuma 自建方案（若选择）：**
- 可与主服务同机部署，独立 Docker 容器，监听不同端口
- 不配置为本项目必选项；上线初期使用免费外部服务即可

### 日志聚合

**容器日志策略（Docker 默认 json-file driver）：**

在 `docker-compose.prod.yml` 的每个应用服务（api、web、nginx）中添加 logging 配置：
```
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

含义：每个容器日志文件最大 50MB，保留最多 5 个滚动文件，防止磁盘被日志撑满。

**日志查看命令约定（运维手册）：**
- 实时查看 api 日志：`docker compose -f docker-compose.prod.yml logs -f api`
- 查看最近 100 行：`docker compose -f docker-compose.prod.yml logs --tail=100 api`
- 查看所有服务最近日志：`docker compose -f docker-compose.prod.yml logs --tail=50`

**日志格式约定：** API 应用日志输出 JSON 格式（包含 `timestamp`、`level`、`message`、`requestId` 字段），便于后期接入 ELK/Loki 等日志系统时解析。

- [ ] **Step 1: 增强 /health 端点（检查数据库和 Redis 连通性）**

  - Modify: `apps/api/src/app.ts`（或创建 `apps/api/src/routes/health.ts`）
  - /health 路由同时探测 PostgreSQL 和 Redis，返回聚合状态

- [ ] **Step 2: 更新 nginx/conf.d/default.conf**

  - 在 `upstream api_backend` 和 `upstream web_backend` 块中添加 max_fails 和 fail_timeout 参数

- [ ] **Step 3: 更新 docker-compose.prod.yml**

  - 为 api、web 服务添加 `healthcheck` 配置
  - 为所有应用服务（api、web、nginx）添加 `logging` 配置

- [ ] **Step 4: 运行测试验证 /health 端点逻辑**

  Run: `cd apps/api && npm test`
  Expected: PASS（若有 health 路由测试）

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/ nginx/ docker-compose.prod.yml
  git commit -m "feat: enhance health check endpoint and configure monitoring"
  ```

---

## Task 7: 上线前检查清单

**Files:**
- Create: `docs/LAUNCH_CHECKLIST.md`

此 Task 产出一份可执行的 Markdown checklist，供上线当天逐项确认。

### 安全检查

- [ ] JWT_SECRET 长度 >= 64 字符，且为随机生成（非字典词）
- [ ] POSTGRES_PASSWORD 长度 >= 32 字符
- [ ] Redis 已启用 AUTH（`--requirepass` 已配置）
- [ ] Weaviate 已关闭匿名访问（`AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "false"`）
- [ ] `.env.production` 文件权限为 600（`chmod 600 .env.production`）
- [ ] `.env.production` 未进入 Git（`git log --all --full-history -- .env.production` 返回空）
- [ ] CORS 配置已限制为生产域名（非 `*`）
- [ ] Rate limit 已启用（API 全局中间件）
- [ ] Nginx 已关闭 server_tokens（`server_tokens off`）
- [ ] HTTPS 强制跳转已配置（HTTP 301 → HTTPS）
- [ ] 安全响应头已配置：X-Frame-Options、X-Content-Type-Options、HSTS
- [ ] SSL 证书有效期 > 30 天（`openssl x509 -enddate -noout -in fullchain.pem`）
- [ ] 生产 API 端点的 OTP 响应不返回 otp 明文（确认 sendOtp controller 在生产环境不返回 otp 字段）

### 功能验证（关键流程手动测试）

- [ ] **注册登录流程**：微信 OAuth 完整跳转 → 获取 access_token → 调用需认证接口成功
- [ ] **手机 OTP 流程**：发送 OTP（短信到达）→ 验证 OTP → 获取 access_token
- [ ] **旅程创建**：创建旅程 → 查询 active journey → 记录行为事件
- [ ] **旅程阶段推进**：AWARENESS → CONSIDERATION → COMPARISON
- [ ] **AI 对话**：发送消息 → 收到 AI 回复 → 信号提取记录到 DB
- [ ] **通知功能**：触发价格提醒 → 微信模板消息到达
- [ ] **健康检查**：`GET /health` 返回 200 且 checks 中数据库/Redis 均为 ok
- [ ] **静态资源**：Next.js 页面正常加载，无 404 CSS/JS
- [ ] **移动端适配**：微信内置浏览器打开主要页面，布局正常

### 合规检查（中国市场）

- [ ] **ICP 备案**：网站已完成 ICP 备案，备案号显示在页面底部
- [ ] **域名绑定**：备案域名与生产域名一致
- [ ] **服务器在境内**：确认云服务商区域为中国大陆（不可使用香港节点上线无备案域名）
- [ ] **隐私政策页面**：前端有独立隐私政策页面（路径如 `/privacy`），可访问
- [ ] **隐私政策内容**：包含数据收集说明、使用目的、第三方共享情况、用户权利（删除账号、导出数据）
- [ ] **用户协议页面**：前端有用户协议页面（路径如 `/terms`），可访问
- [ ] **微信小程序（若有）**：已通过微信审核，隐私政策链接已配置
- [ ] **PIPL 合规**：用户注册时有明确同意收集个人信息的弹窗/确认机制
- [ ] **数据留存**：确认日志和用户数据存储在境内服务器，无自动同步至境外

### 基础设施确认

- [ ] 服务器磁盘空间充足（建议生产数据目录所在分区剩余 > 20GB）
- [ ] `/opt/backups/` 目录已创建，权限为 700
- [ ] GitHub Secrets（SERVER_HOST、SERVER_USER、SERVER_SSH_KEY、SERVER_DEPLOY_PATH）已配置
- [ ] DNS 已解析到生产服务器 IP（`nslookup your-domain.com` 验证）
- [ ] SSL 证书已放置在 `./ssl/` 目录，路径与 nginx 配置一致
- [ ] `docker compose -f docker-compose.prod.yml config` 无报错
- [ ] 首次手动部署执行成功（`docker compose -f docker-compose.prod.yml up --build -d`）
- [ ] Prisma 迁移已在生产数据库执行（`prisma migrate status` 显示 all applied）

### 监控告警确认

- [ ] 外部 uptime 监控已配置 `/health` 探测
- [ ] 告警通道（企业微信/邮件）测试触发成功
- [ ] Docker 日志 logging driver 已配置 max-size 和 max-file，防止日志无限增长

---

- [ ] **Step 1: 创建 docs/LAUNCH_CHECKLIST.md**

  将上述 Task 7 中所有 checklist 项目整理为独立 Markdown 文档，格式为可勾选的 `- [ ]` 列表，按安全、功能、合规、基础设施、监控分区。

- [ ] **Step 2: Commit**

  ```bash
  git add docs/LAUNCH_CHECKLIST.md
  git commit -m "docs: add production launch checklist"
  ```

---

## 依赖关系

```
Task 1 (docker-compose.prod)
    │
    ├── Task 2 (Dockerfiles) ─────────────┐
    │                                     │
    ├── Task 3 (环境变量)                  │
    │                                     ▼
    └── Task 5 (迁移策略) ─────── Task 4 (CI/CD，依赖 Task 2+3+5)
                                          │
                                 Task 6 (健康检查，依赖 Task 1+4)
                                          │
                                 Task 7 (上线清单，依赖所有 Task)
```

**推荐执行顺序：** Task 1 → Task 2 → Task 3 → Task 5 → Task 4 → Task 6 → Task 7

---

## 接口约定汇总

### /health 端点（增强后）

**请求：** `GET /health`（无认证要求）

**成功响应（200）：**
```
{
  "status": "ok",
  "timestamp": "<ISO8601>",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**降级响应（503）：**
```
{
  "status": "error",
  "timestamp": "<ISO8601>",
  "checks": {
    "database": "ok" | "error",
    "redis": "ok" | "error"
  }
}
```

### Nginx 路由规则（完整）

| 请求路径 | 转发目标 | 说明 |
|----------|---------|------|
| `GET /health` | `api:3000/health` | 健康检查，不记录 access_log |
| `ANY /api/*` | `api:3000/*` | REST API，去掉 `/api` 前缀 |
| `GET /_next/*` | `web:3001/_next/*` | Next.js 静态资源 |
| `GET /public/*` | `web:3001/public/*` | 公共静态文件 |
| `ANY /` | `web:3001` | Next.js 页面（SSR/SSG） |

### Docker 内部服务地址

| 服务 | 容器内地址 |
|------|-----------|
| API | `http://api:3000` |
| Web | `http://web:3001` |
| PostgreSQL | `postgres:5432` |
| Redis | `redis:6379` |
| Weaviate | `http://weaviate:8080` |
| t2v-transformers | `http://t2v-transformers:8080` |

---

## 修复记录

_首次创建，无历史修复记录。_
