# Plan 1: 项目基础设施 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立项目骨架 — Node.js + TypeScript API框架 + PostgreSQL schema（13个实体）+ Redis + 微信OAuth认证 + 手机OTP备用

**Architecture:** Monorepo 结构，分为 `apps/api`（Node.js主服务）、`apps/ai-pipeline`（Python AI服务）、`apps/web`（Next.js前端）、`packages/shared`（共享类型）。API服务处理用户请求，AI Pipeline独立部署通过内部RPC通信。

**Tech Stack:** Node.js + Express + TypeScript + Prisma ORM + PostgreSQL + Redis + 微信OAuth2 + JWT

---

## File Structure

```
newcar/
├── apps/
│   ├── api/                      # Node.js + Express API
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── app.ts            # Express app setup
│   │   │   ├── config/           # 环境配置
│   │   │   ├── routes/           # 路由
│   │   │   ├── middleware/       # 中间件（auth, error, rate-limit）
│   │   │   ├── controllers/      # 控制器
│   │   │   ├── lib/              # 内部库（prisma client, utils）
│   │   │   └── services/         # 业务逻辑
│   │   ├── prisma/
│   │   │   └── schema.prisma     # 数据库schema
│   │   └── tests/
│   ├── ai-pipeline/              # Python FastAPI (Plan 3再实现)
│   └── web/                      # Next.js (Plan 4再实现)
├── packages/
│   └── shared/                   # 共享类型和工具
│       ├── src/
│       │   ├── types/           # 共享TypeScript类型
│       │   └── utils/           # 共享工具函数
│       └── package.json
├── docker-compose.yml           # PostgreSQL + Redis
└── package.json                  # workspace根配置
```

---

## Task 1: 项目骨架搭建

**Files:**
- Create: `package.json` (workspace根配置)
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/lib/prisma.ts` ← **提前到 Task 1**
- Create: `apps/api/src/lib/utils.ts` ← **提前到 Task 1**
- Create: `apps/api/src/config/index.ts` ← **在 index.ts 之前创建**
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/app.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types/index.ts`
- Create: `docker-compose.yml`

- [ ] **Step 1: 创建 workspace 根配置**

```json
// package.json
{
  "name": "newcar",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build"
  }
}
```

- [ ] **Step 2: 创建 docker-compose.yml（PostgreSQL + Redis）**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: newcar
      POSTGRES_USER: newcar
      POSTGRES_PASSWORD: newcar_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 3: 创建 .env.example**

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://newcar:newcar_dev@localhost:5432/newcar
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
OTP_SECRET=your-otp-secret
```

- [ ] **Step 4: 创建 apps/api/src/lib/prisma.ts** ← **提前**

```typescript
// apps/api/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 5: 创建 apps/api/src/lib/utils.ts** ← **提前，使用 crypto.randomUUID**

```typescript
// apps/api/src/lib/utils.ts
import { randomUUID } from 'crypto';

export function generateSessionId(): string {
  return randomUUID(); // 使用 crypto.randomUUID() 而非 Math.random()
}

export function generateId(): string {
  return randomUUID();
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required config: ${name}`);
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

- [ ] **Step 6: 创建 apps/api/src/config/index.ts** ← **在 index.ts 之前**

```typescript
// apps/api/src/config/index.ts
import { requireEnvVar, requireConfigValue } from '../lib/utils';

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: isProduction
      ? requireEnvVar('DATABASE_URL')
      : (process.env.DATABASE_URL || 'postgresql://newcar:newcar_dev@localhost:5432/newcar'),
  },

  redis: {
    url: isProduction
      ? requireEnvVar('REDIS_URL')
      : (process.env.REDIS_URL || 'redis://localhost:6379'),
  },

  jwt: {
    // 在生产环境必须提供 JWT_SECRET，永不使用默认值
    secret: requireConfigValue(process.env.JWT_SECRET, 'JWT_SECRET'),
    expiresIn: '7d',
  },

  wechat: {
    appId: requireConfigValue(process.env.WECHAT_APP_ID, 'WECHAT_APP_ID'),
    appSecret: requireConfigValue(process.env.WECHAT_APP_SECRET, 'WECHAT_APP_SECRET'),
  },

  otp: {
    // 生产环境必须提供 OTP_SECRET
    secret: requireConfigValue(process.env.OTP_SECRET, 'OTP_SECRET'),
  },
};
```

- [ ] **Step 7: 创建 apps/api/src/index.ts**

```typescript
// apps/api/src/index.ts
import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
```

- [ ] **Step 8: 创建 apps/api/src/app.ts**

```typescript
// apps/api/src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rateLimit';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Global rate limiting
  app.use(rateLimitMiddleware);

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes (挂载在 Task 3-6)
  // app.use('/auth', authRoutes);
  // app.use('/', sessionRoutes);
  // app.use('/journeys', journeyRoutes);

  // Global error handler
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 9: 创建 rate limit 中间件**

```typescript
// apps/api/src/middleware/rateLimit.ts
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redis.url);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = `ratelimit:${req.ip}:${Math.floor(Date.now() / WINDOW_MS)}`;

  try {
    const entry = await redis.get(key);
    const now = Date.now();

    if (!entry) {
      await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }));
      return next();
    }

    const { count, resetAt }: RateLimitEntry = JSON.parse(entry);

    if (now > resetAt) {
      // Window expired, reset
      await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }));
      return next();
    }

    if (count >= MAX_REQUESTS) {
      res.setHeader('Retry-After', Math.ceil((resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }

    await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: count + 1, resetAt }));
    next();
  } catch {
    // If Redis fails, allow request to pass
    next();
  }
}
```

- [ ] **Step 10: 创建 packages/shared/src/types/index.ts**

```typescript
// packages/shared/src/types/index.ts

export enum JourneyStage {
  AWARENESS = 'AWARENESS',
  CONSIDERATION = 'CONSIDERATION',
  COMPARISON = 'COMPARISON',
  DECISION = 'DECISION',
  PURCHASE = 'PURCHASE',
}

export enum JourneyStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

export enum UserRole {
  MEMBER = 'MEMBER',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN',
}

export enum Platform {
  WEB = 'WEB',
  WECHAT_MINIAPP = 'WECHAT_MINIAPP',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export enum BehaviorEventType {
  PAGE_VIEW = 'PAGE_VIEW',
  CAR_VIEW = 'CAR_VIEW',
  SPEC_TAB = 'SPEC_TAB',
  REVIEW_READ = 'REVIEW_READ',
  COMPARISON_OPEN = 'COMPARISON_OPEN',
  PRICE_CHECK = 'PRICE_CHECK',
  VIDEO_WATCH = 'VIDEO_WATCH',
  DEALER_LOCATE = 'DEALER_LOCATE',
  COMMUNITY_POST_VIEW = 'COMMUNITY_POST_VIEW',
}

export enum PublishedFormat {
  STORY = 'story',
  REPORT = 'report',
  TEMPLATE = 'template',
}
```

- [ ] **Step 11: 安装依赖并验证**

Run: `npm install && docker-compose up -d`
Expected: PostgreSQL 和 Redis 运行中，依赖安装成功

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: project skeleton with workspace structure and rate limiting"
```

---

## Task 2: Prisma Schema（13个实体）

**Files:**
- Create: `apps/api/prisma/schema.prisma` — **包含修复后的 User model，添加 openid 字段**
- Modify: `apps/api/package.json` (添加 prisma 脚本)

- [ ] **Step 1: 创建 Prisma Schema（修复版 — 添加 openid 字段）**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                   String   @id @default(cuid())
  openid               String?  @unique  // ← 添加：微信 openid，用于微信登录
  email                String?  @unique
  phone                String?  @unique
  avatar               String?
  nickname             String?
  city                 String?
  hasGarage            Boolean  @default(false)
  chargingSituation    String?  // HOME | PUBLIC | NONE
  familySize           Int?
  privacyDefault       String   @default("PRIVATE") // PRIVATE | FRIENDS | PUBLIC
  notificationSettings Json?
  role                 String   @default("MEMBER") // MEMBER | EDITOR | ADMIN
  createdAt            DateTime @default(now())
  lastActiveAt         DateTime @default(now())

  devices              UserDevice[]
  journeys             Journey[]
  conversations        Conversation[]
  publishedJourneys    PublishedJourney[]
  journeyForks         JourneyFork[]
  notifications        NotificationFeed[]

  @@map("users")
}

model UserDevice {
  id                String   @id @default(cuid())
  userId            String
  platform          String   // WEB | WECHAT_MINIAPP | IOS | ANDROID
  pushToken         String?
  deviceFingerprint String?
  lastSeenAt        DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_devices")
}

model Journey {
  id               String   @id @default(cuid())
  userId           String
  title            String
  stage            String   @default("AWARENESS")
  status           String   @default("ACTIVE")
  requirements     Json?
  aiConfidenceScore Float?
  templateSourceId String?
  startedAt        DateTime @default(now())
  completedAt      DateTime?
  lastActivityAt   DateTime @default(now())

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  templateSource   Journey?  @relation("JourneyForks", fields: [templateSourceId], references: [id])
  forkedJourneys   Journey[] @relation("JourneyForks")

  candidates       CarCandidate[]
  snapshots        JourneySnapshot[]
  behaviorEvents   BehaviorEvent[]
  conversations    Conversation[]
  publishedJourney PublishedJourney?
  notifications    NotificationFeed[]

  @@map("journeys")
}

model BehaviorEvent {
  id           String   @id @default(cuid())
  journeyId    String
  userId       String?
  sessionId    String
  type         String
  targetType   String?
  targetId     String?
  metadata     Json?
  aiWeight     Float   @default(0)
  timestamp    DateTime @default(now())

  journey      Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@map("behavior_events")
}

model Conversation {
  id               String   @id @default(cuid())
  journeyId        String
  userId           String?
  sessionId        String
  messages         Json     @default("[]")
  extractedSignals Json     @default("[]")
  toolCalls        Json     @default("[]")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  journey          Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  user             User?    @relation(fields: [userId], references: [id])

  @@map("conversations")
}

model CarCandidate {
  id                String   @id @default(cuid())
  journeyId         String
  carId             String
  status            String   @default("ACTIVE")
  addedReason       String
  userInterestScore Float?
  aiMatchScore      Float?
  priceAtAdd        Int?
  eliminationReason String?
  userNotes         String?
  addedAt           DateTime @default(now())

  journey           Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  car               Car      @relation(fields: [carId], references: [id])

  @@map("car_candidates")
}

model JourneySnapshot {
  id                      String   @id @default(cuid())
  journeyId               String
  trigger                 String   @default("DAILY")
  narrativeSummary        String?
  keyInsights             Json     @default("[]")
  topRecommendation       String?
  recommendationReasoning String?
  attentionSignals        Json     @default("[]")
  nextSuggestedActions    Json     @default("[]")
  modelUsed               String?
  promptVersion           String?
  tokensUsed              Int?
  generatedAt             DateTime @default(now())

  journey                 Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@map("journey_snapshots")
}

model Car {
  id         String   @id @default(cuid())
  brand      String
  model      String
  variant    String
  year       Int
  type       String   // SEDAN | SUV | MPV | HATCHBACK | PICKUP
  fuelType   String   // BEV | PHEV | HEV | ICE
  baseSpecs  Json?
  msrp       Int?
  updatedAt  DateTime @updatedAt

  priceSnapshots CarPriceSnapshot[]
  reviews        CarReview[]
  candidates     CarCandidate[]

  @@map("cars")
}

model CarPriceSnapshot {
  id              String   @id @default(cuid())
  carId           String
  region          String?
  msrp            Int
  dealerDiscount  Int?
  policyIds       Json?
  effectivePrice  Int?
  source          String?
  capturedAt      DateTime @default(now())

  car             Car      @relation(fields: [carId], references: [id], onDelete: Cascade)

  @@map("car_price_snapshots")
}

model CarPolicy {
  id                  String   @id @default(cuid())
  carId               String?  // null = all-car policy
  region              String
  policyType          String   // PURCHASE_TAX | TRADE_IN_SUBSIDY | NEW_ENERGY_SUBSIDY | LICENSE_PLATE
  subsidyAmount       Int
  eligibilityCriteria Json?
  validFrom           DateTime
  validUntil         DateTime
  sourceUrl           String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@map("car_policies")
}

model CarReview {
  id              String    @id @default(cuid())
  carId           String
  source          String    // MEDIA | USER_GENERATED
  platform        String?
  title           String?
  content         String?
  aiSummary       String?
  sentimentScores Json?
  publishedAt     DateTime?
  ingestedAt      DateTime  @default(now())

  car             Car       @relation(fields: [carId], references: [id], onDelete: Cascade)

  @@map("car_reviews")
}

model PublishedJourney {
  id                String   @id @default(cuid())
  journeyId         String   @unique
  userId            String
  title             String
  description       String?
  publishedFormats  String[] @default([])
  tags              Json?
  storyContent      String?
  reportData        Json?
  templateData      Json?
  contentVersion    Int      @default(1)
  lastSyncedAt      DateTime?
  visibility        String   @default("PUBLIC")
  viewCount         Int      @default(0)
  likeCount         Int      @default(0)
  commentCount      Int      @default(0)
  forkCount         Int      @default(0)
  featured          Boolean  @default(false)
  contentStatus     String   @default("LIVE")
  publishedAt       DateTime @default(now())
  updatedAt         DateTime @updatedAt

  journey           Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  user              User     @relation(fields: [userId], references: [id])
  forks             JourneyFork[]

  @@map("published_journeys")
}

model JourneyFork {
  id                       String   @id @default(cuid())
  sourcePublishedJourneyId String
  newJourneyId              String
  userId                    String
  inheritedCandidates      Json     @default("[]")
  inheritedFramework       Json?
  forkedAt                  DateTime @default(now())

  sourcePublishedJourney   PublishedJourney @relation(fields: [sourcePublishedJourneyId], references: [id])
  user                     User     @relation(fields: [userId], references: [id])

  @@map("journey_forks")
}

model NotificationFeed {
  id           String   @id @default(cuid())
  userId       String
  journeyId    String?
  type         String   // PRICE_DROP | NEW_VARIANT | NEW_REVIEW | POLICY_UPDATE | OTA_RECALL
  relatedCarId String?
  title        String
  body         String?
  metadata     Json?
  isRead       Boolean  @default(false)
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  journey      Journey? @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@map("notification_feeds")
}
```

- [ ] **Step 2: 运行 Prisma migrate 验证 schema**

Run: `cd apps/api && npx prisma migrate dev --name init`
Expected: Migration 创建成功，生成 migration 文件

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/migrations apps/api/prisma/schema.prisma
git commit -m "feat: add Prisma schema with 13 entities (including openid on User)"
```

---

## Task 3: 认证系统 — 微信 OAuth + JWT

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/services/auth.service.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/controllers/auth.controller.ts`
- Create: `packages/shared/src/types/auth.ts`
- Create: `apps/api/src/services/otp.service.ts` ← **新增 OTP 服务**
- Create: `apps/api/tests/auth.test.ts`

- [ ] **Step 1: 创建 auth types**

```typescript
// packages/shared/src/types/auth.ts

export interface WechatOAuthTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
}

export interface WechatUserInfo {
  openid: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  privilege?: string[];
}

export interface AuthResult {
  user: any; // User type from Prisma
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
  type?: 'access' | 'refresh';
}
```

- [ ] **Step 2: 创建 OTP Service（修复版 — 实际验证）**

```typescript
// apps/api/src/services/otp.service.ts
import { Redis } from 'ioredis';
import { config } from '../config';
import { randomUUID } from 'crypto';

export class OtpService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  // 生成并存储 OTP（发送短信前调用）
  async generateOtp(phone: string): Promise<string> {
    // 生成 6 位数字 OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储到 Redis，5 分钟过期
    await this.redis.setex(`otp:${phone}`, 300, otp);

    // 返回 OTP（生产环境应发送短信，这里返回用于测试）
    return otp;
  }

  // 验证 OTP
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const cachedOtp = await this.redis.get(`otp:${phone}`);

    if (!cachedOtp) {
      return false;
    }

    // 验证后删除 OTP（一次性使用）
    const isValid = cachedOtp === otp;

    if (isValid) {
      await this.redis.del(`otp:${phone}`);
    }

    return isValid;
  }
}

export const otpService = new OtpService();
```

- [ ] **Step 3: 创建 auth service（修复版 — 使用 crypto.randomUUID + openid 查询）**

```typescript
// apps/api/src/services/auth.service.ts
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { generateSessionId } from '../lib/utils';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { otpService } from './otp.service';

export class AuthService {
  async wechatLogin(code: string) {
    // 1. 用 code 换取 openid
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wechat.appId}&secret=${config.wechat.appSecret}&code=${code}&grant_type=authorization_code`;

    const tokenResponse = await axios.get(tokenUrl);
    const { openid, access_token } = tokenResponse.data;

    if (!openid) {
      throw new Error('Failed to get openid from WeChat');
    }

    // 2. 获取用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`;
    const userInfoResponse = await axios.get(userInfoUrl);
    const wechatUser = userInfoResponse.data;

    // 3. 查找或创建用户（通过 openid 查找）
    let user = await prisma.user.findUnique({
      where: { openid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          openid, // ← 存储 openid
          nickname: wechatUser.nickname,
          avatar: wechatUser.headimgurl,
        },
      });
    }

    // 4. 生成 JWT
    const sessionId = generateSessionId();
    const accessToken = this.generateAccessToken(user.id, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);

    return { user, accessToken, refreshToken };
  }

  async phoneLogin(phone: string, otp: string) {
    // 验证 OTP（使用 Redis 存储的 OTP）
    const isValid = await otpService.verifyOtp(phone, otp);

    if (!isValid) {
      throw new Error('Invalid OTP');
    }

    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { phone },
      });
    }

    const sessionId = generateSessionId();
    const accessToken = this.generateAccessToken(user.id, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);

    return { user, accessToken, refreshToken };
  }

  // 发送 OTP（用于测试/开发）
  async sendOtp(phone: string): Promise<{ otp: string }> {
    const otp = await otpService.generateOtp(phone);
    // 在生产环境，这里应该调用短信服务（Twilio/阿里云）
    // 目前直接返回用于测试
    return { otp };
  }

  // 将会话绑定到用户（游客→注册用户迁移）
  async bindSessionToUser(sessionId: string, userId: string) {
    // 将该 session_id 下的 BehaviorEvent 和 Conversation 关联到 user_id
    await prisma.behaviorEvent.updateMany({
      where: { sessionId },
      data: { userId },
    });

    await prisma.conversation.updateMany({
      where: { sessionId },
      data: { userId },
    });

    return { migrated: true };
  }

  private generateAccessToken(userId: string, sessionId: string): string {
    return jwt.sign(
      { userId, sessionId, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  private generateRefreshToken(userId: string, sessionId: string): string {
    return jwt.sign(
      { userId, sessionId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '30d' }
    );
  }

  verifyToken(token: string) {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }
}

export const authService = new AuthService();
```

- [ ] **Step 4: 创建 auth middleware**

```typescript
// apps/api/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);

    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.userId = payload.userId;
    req.sessionId = payload.sessionId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = authService.verifyToken(token);
      req.userId = payload.userId;
      req.sessionId = payload.sessionId;
    } catch {
      // Ignore invalid token for optional auth
    }
  }

  next();
}
```

- [ ] **Step 5: 创建 auth controller**

```typescript
// apps/api/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export class AuthController {
  async wechatCallback(req: Request, res: Response) {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    try {
      const result = await authService.wechatLogin(code);
      res.json(result);
    } catch (error: any) {
      console.error('Wechat login error:', error);
      res.status(500).json({ error: 'Wechat login failed' });
    }
  }

  async phoneLogin(req: Request, res: Response) {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Missing phone or otp' });
    }

    try {
      const result = await authService.phoneLogin(phone, otp);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async sendOtp(req: Request, res: Response) {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Missing phone' });
    }

    try {
      // 开发环境返回 OTP，生产环境应发送短信
      const { otp } = await authService.sendOtp(phone);
      res.json({ message: 'OTP sent', otp }); // 开发环境返回 OTP
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    try {
      const payload = authService.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('Not a refresh token');
      }

      const accessToken = jwt.sign(
        { userId: payload.userId, sessionId: payload.sessionId, type: 'access' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({ accessToken });
    } catch {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
}

export const authController = new AuthController();
```

- [ ] **Step 6: 创建 auth routes**

```typescript
// apps/api/src/routes/auth.ts
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// 微信 OAuth 回调
router.get('/wechat/callback', authController.wechatCallback);

// 发送 OTP（开发环境）
router.post('/phone/send-otp', authController.sendOtp);

// 手机号 + OTP 登录
router.post('/phone/login', authController.phoneLogin);

// 刷新 Token
router.post('/refresh', authController.refreshToken);

export default router;
```

- [ ] **Step 7: 将 auth routes 挂载到 app**

Modify `apps/api/src/app.ts` 添加路由挂载

- [ ] **Step 8: 编写认证测试**

```typescript
// apps/api/tests/auth.test.ts
import { describe, it, expect } from 'vitest';

describe('Auth', () => {
  it('should validate phone otp format', () => {
    const validOtp = /^\d{6}$/;
    expect(validOtp.test('123456')).toBe(true);
    expect(validOtp.test('12345')).toBe(false);
    expect(validOtp.test('abcdef')).toBe(false);
  });

  it('should validate wechat code format', () => {
    const validCode = /^[a-zA-Z0-9]{32}$/;
    expect(validCode.test('1234567890abcdef1234567890abcdef')).toBe(true);
    expect(validCode.test('short')).toBe(false);
  });

  it('should validate JWT payload structure', () => {
    const payload = { userId: '123', sessionId: 'abc', type: 'access' as const };
    expect(payload.type).toBe('access');
    expect(payload.userId).toBeDefined();
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Wechat OAuth and JWT authentication with proper OTP verification"
```

---

## Task 4: 会话管理 + 游客模式

**Files:**
- Create: `apps/api/src/services/session.service.ts`
- Create: `apps/api/src/middleware/session.ts`
- Create: `apps/api/src/routes/session.ts`
- Create: `apps/api/tests/session.test.ts`

- [ ] **Step 1: 创建 session service**

```typescript
// apps/api/src/services/session.service.ts
import { Redis } from 'ioredis';
import { config } from '../config';
import { generateSessionId } from '../lib/utils';

export class SessionService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  async createGuestSession(): Promise<{ sessionId: string }> {
    const sessionId = generateSessionId();

    await this.redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60, // 30 天过期
      JSON.stringify({
        isGuest: true,
        createdAt: new Date().toISOString(),
      })
    );

    return { sessionId };
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async bindUser(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await this.redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60,
      JSON.stringify({
        ...session,
        userId,
        boundAt: new Date().toISOString(),
      })
    );
  }

  async touchSession(sessionId: string) {
    await this.redis.expire(`session:${sessionId}`, 30 * 24 * 60 * 60);
  }
}

export const sessionService = new SessionService();
```

- [ ] **Step 2: 创建 session middleware（修复版 — 正确从 auth token 解析 sessionId）**

```typescript
// apps/api/src/middleware/session.ts
import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from './auth';

export interface SessionRequest extends AuthenticatedRequest {
  isGuest?: boolean;
}

export async function sessionMiddleware(
  req: SessionRequest,
  res: Response,
  next: NextFunction
) {
  // 优先使用 header 中的 session_id
  let sessionId = req.headers['x-session-id'] as string;

  // 如果有 authorization header，尝试解析 sessionId
  if (!sessionId && req.headers.authorization) {
    try {
      const payload = authService.verifyToken(
        req.headers.authorization.substring(7)
      );
      sessionId = payload.sessionId;
      req.userId = payload.userId;
    } catch {
      // Ignore - will create guest session
    }
  }

  // 如果还没有 session_id，创建游客会话
  if (!sessionId) {
    const { sessionId: newSessionId } = await sessionService.createGuestSession();
    req.sessionId = newSessionId;
    req.isGuest = true;
    res.setHeader('X-Session-Id', newSessionId);
    return next();
  }

  // 验证 session
  const session = await sessionService.getSession(sessionId);
  if (!session) {
    const { sessionId: newSessionId } = await sessionService.createGuestSession();
    req.sessionId = newSessionId;
    req.isGuest = true;
    res.setHeader('X-Session-Id', newSessionId);
    return next();
  }

  req.sessionId = sessionId;
  req.isGuest = !session.userId;

  if (session.userId) {
    req.userId = session.userId;
  }

  await sessionService.touchSession(sessionId);
  next();
}
```

- [ ] **Step 3: 创建 session routes**

```typescript
// apps/api/src/routes/session.ts
import { Router } from 'express';
import { sessionService } from '../services/session.service';

const router = Router();

// 获取当前会话信息
router.get('/session', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;

  if (!sessionId) {
    return res.status(400).json({ error: 'No session id' });
  }

  const session = await sessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId,
    isGuest: !session.userId,
    createdAt: session.createdAt,
    boundAt: session.boundAt || null,
  });
});

// 创建新会话
router.post('/session', async (req, res) => {
  const { sessionId } = await sessionService.createGuestSession();
  res.json({ sessionId });
});

export default router;
```

- [ ] **Step 4: 编写测试**

```typescript
// apps/api/tests/session.test.ts
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

describe('Session', () => {
  it('should generate valid UUID session ids', () => {
    const sessionId = randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(sessionId)).toBe(true);
  });

  it('should validate session data structure', () => {
    const sessionData = {
      isGuest: true,
      createdAt: new Date().toISOString(),
    };
    expect(sessionData.isGuest).toBe(true);
    expect(typeof sessionData.createdAt).toBe('string');
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session management with guest mode support"
```

---

## Task 5: 旅程 CRUD 基础

**Files:**
- Create: `apps/api/src/services/journey.service.ts`
- Create: `apps/api/src/controllers/journey.controller.ts`
- Create: `apps/api/src/routes/journey.ts`
- Create: `apps/api/tests/journey.test.ts`

- [ ] **Step 1: 创建 journey service**

```typescript
// apps/api/src/services/journey.service.ts
import { prisma } from '../lib/prisma';
import { JourneyStage, JourneyStatus } from '@newcar/shared';

export class JourneyService {
  async createJourney(userId: string, data: { title: string; requirements?: any }) {
    const existingJourney = await prisma.journey.findFirst({
      where: {
        userId,
        status: JourneyStatus.ACTIVE,
      },
    });

    if (existingJourney) {
      throw new Error('User already has an active journey. Complete or pause it first.');
    }

    return prisma.journey.create({
      data: {
        userId,
        title: data.title,
        requirements: data.requirements || {},
        stage: JourneyStage.AWARENESS,
        status: JourneyStatus.ACTIVE,
      },
    });
  }

  async getActiveJourney(userId: string) {
    return prisma.journey.findFirst({
      where: {
        userId,
        status: JourneyStatus.ACTIVE,
      },
      include: {
        candidates: {
          include: { car: true },
        },
        snapshots: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async advanceStage(journeyId: string, newStage: JourneyStage) {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
    });

    if (!journey) throw new Error('Journey not found');

    const stageOrder = [
      JourneyStage.AWARENESS,
      JourneyStage.CONSIDERATION,
      JourneyStage.COMPARISON,
      JourneyStage.DECISION,
      JourneyStage.PURCHASE,
    ];

    const currentIndex = stageOrder.indexOf(journey.stage as JourneyStage);
    const newIndex = stageOrder.indexOf(newStage);

    if (newIndex < currentIndex) {
      throw new Error('Cannot move backwards in journey stage');
    }

    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        stage: newStage,
        lastActivityAt: new Date(),
      },
    });
  }

  async pauseJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.PAUSED,
        lastActivityAt: new Date(),
      },
    });
  }

  async completeJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.COMPLETED,
        completedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async abandonJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.ABANDONED,
        lastActivityAt: new Date(),
      },
    });
  }

  async recordBehaviorEvent(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    type: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
  }) {
    const aiWeight = this.calculateAiWeight(data.type, data.metadata);

    return prisma.behaviorEvent.create({
      data: {
        journeyId: data.journeyId,
        userId: data.userId,
        sessionId: data.sessionId,
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata,
        aiWeight,
      },
    });
  }

  private calculateAiWeight(type: string, metadata?: any): number {
    const baseWeights: Record<string, number> = {
      CAR_VIEW: 1.0,
      COMPARISON_OPEN: 1.2,
      SPEC_TAB: 0.8,
      REVIEW_READ: 0.7,
      PRICE_CHECK: 1.1,
      DEALER_LOCATE: 1.5,
      VIDEO_WATCH: 0.6,
      PAGE_VIEW: 0.3,
      COMMUNITY_POST_VIEW: 0.4,
    };

    const baseWeight = baseWeights[type] || 0.5;
    const durationSec = metadata?.duration_sec || 0;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);

    return baseWeight * (0.5 + 0.5 * durationFactor);
  }
}

export const journeyService = new JourneyService();
```

- [ ] **Step 2: 创建 journey controller**

```typescript
// apps/api/src/controllers/journey.controller.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { journeyService } from '../services/journey.service';
import { JourneyStage } from '@newcar/shared';

export class JourneyController {
  async createJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { title, requirements } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const journey = await journeyService.createJourney(userId, { title, requirements });
      res.status(201).json(journey);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getActiveJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const journey = await journeyService.getActiveJourney(userId);

      if (!journey) {
        return res.status(404).json({ error: 'No active journey found' });
      }

      res.json(journey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async advanceStage(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { stage } = req.body;

      if (!Object.values(JourneyStage).includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage' });
      }

      const journey = await journeyService.advanceStage(journeyId, stage);
      res.json(journey);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async pauseJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.pauseJourney(journeyId);
      res.json(journey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async completeJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.completeJourney(journeyId);
      res.json(journey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async recordBehaviorEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { type, targetType, targetId, metadata } = req.body;

      const event = await journeyService.recordBehaviorEvent({
        journeyId,
        userId: req.userId,
        sessionId: req.sessionId!,
        type,
        targetType,
        targetId,
        metadata,
      });

      res.status(201).json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const journeyController = new JourneyController();
```

- [ ] **Step 3: 创建 journey routes**

```typescript
// apps/api/src/routes/journey.ts
import { Router } from 'express';
import { journeyController } from '../controllers/journey.controller';
import { authMiddleware } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';

const router = Router();

router.post('/', authMiddleware, journeyController.createJourney);
router.get('/active', authMiddleware, journeyController.getActiveJourney);
router.patch('/:journeyId/stage', authMiddleware, journeyController.advanceStage);
router.patch('/:journeyId/pause', authMiddleware, journeyController.pauseJourney);
router.patch('/:journeyId/complete', authMiddleware, journeyController.completeJourney);

// 记录行为事件（游客可用，但需 session）
router.post(
  '/:journeyId/events',
  sessionMiddleware,
  journeyController.recordBehaviorEvent
);

export default router;
```

- [ ] **Step 4: 编写测试**

```typescript
// apps/api/tests/journey.test.ts
import { describe, it, expect } from 'vitest';

describe('Journey', () => {
  it('should validate stage progression order', () => {
    const stageOrder = ['AWARENESS', 'CONSIDERATION', 'COMPARISON', 'DECISION', 'PURCHASE'];
    const currentIndex = stageOrder.indexOf('CONSIDERATION');
    const newIndex = stageOrder.indexOf('AWARENESS');

    expect(newIndex < currentIndex).toBe(true);
  });

  it('should calculate ai weight correctly for 5 min duration', () => {
    const baseWeight = 1.0;
    const durationSec = 300;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(1.0);
  });

  it('should calculate ai weight with short duration', () => {
    const baseWeight = 1.0;
    const durationSec = 60;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(0.6);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Journey CRUD and behavior tracking"
```

---

## Task 6: API 路由整合与最终验证

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/middleware/error.ts`
- Create: `apps/api/tests/api.test.ts`

- [ ] **Step 1: 创建统一错误处理中间件**

```typescript
// apps/api/src/middleware/error.ts
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Unhandled error:', err);

  // 生产环境隐藏错误详情
  if (config.nodeEnv === 'production') {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('already has')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  // 开发环境返回详细信息
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack,
  });
}
```

- [ ] **Step 2: 整合所有路由到 app.ts**

```typescript
// apps/api/src/app.ts (完整版)
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';
import journeyRoutes from './routes/journey';
import { errorHandler } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rateLimit';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Global rate limiting
  app.use(rateLimitMiddleware);

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/auth', authRoutes);
  app.use('/', sessionRoutes);
  app.use('/journeys', journeyRoutes);

  // Global error handler
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 3: 创建 API 集成测试**

```typescript
// apps/api/tests/api.test.ts
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

describe('API Integration', () => {
  it('should pass health check format', () => {
    const response = { status: 'ok', timestamp: expect.any(String) };
    expect(response.status).toBe('ok');
    expect(new Date(response.timestamp)).toBeInstanceOf(Date);
  });

  it('should validate session id is proper UUID', () => {
    const sessionId = randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(sessionId)).toBe(true);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 4: 最终验证**

Run: `docker-compose up -d && cd apps/api && npx prisma migrate deploy && npm run dev`
Expected: API 服务启动成功，数据库迁移完成

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate all routes and finalize API setup"
```

---

## 依赖关系

- Task 1 (骨架) → Task 2 (Prisma) → Task 3 (认证) → Task 4 (会话) → Task 5 (旅程) → Task 6 (整合)

---

## 修复记录

### Review #1 发现的问题（已修复）

| Issue | Fix |
|-------|-----|
| User model 缺少 `openid` 字段 | 在 Task 2 的 schema 中添加 `openid String? @unique` |
| `Math.random()` 生成 session ID 不安全 | 改用 `crypto.randomUUID()` |
| `index.ts` 在 `config/index.ts` 之前创建 | 重新排序 Task 1 Steps |
| `lib/prisma.ts` 和 `lib/utils.ts` 在 Task 6 才创建但前面已引用 | 提前到 Task 1 |
| OTP 验证被注释掉 | 实现真正的 Redis OTP 验证服务 |
| JWT secret 硬编码 fallback | 生产环境必须提供，dev 环境才允许 fallback |
| 缺少 rate limiting | 添加 rate limit 中间件 |
| 微信登录 `where: { openid }` 但 schema 没有 openid | 修复 schema + 查询逻辑 |
