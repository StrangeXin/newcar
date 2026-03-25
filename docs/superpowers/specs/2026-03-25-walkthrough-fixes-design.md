# Walkthrough Issues Fix — Design Spec

Date: 2026-03-25

## Background

走查发现 7 个问题，涉及首页布局、主题一致性、动态展示、i18n 基础设施和 mock API 补全。

## Issues & Solutions

### 1. 首页内容垂直居中

**现状:** Hero 区域用 `pt-20` 顶部对齐，未垂直居中。

**方案:** 给 Hero 区域容器添加 `min-h-screen flex items-center`，使首屏 Hero 在视口内垂直居中。底部 feature cards 保持正常文档流。

**改动文件:** `apps/web/src/app/page.tsx`

---

### 2. 主题切换 icon 替换为半圆色块

**现状:** 使用 lucide-react 的 Sun/Moon 图标，但主题是 orange/indigo 配色方案，不是 light/dark 模式。

**方案:** 用一个 24px 圆形 SVG，左半橙色右半靛蓝。当前激活的一半高亮，另一半半透明。纯 CSS/SVG 实现，不依赖图标库。

**改动文件:** `apps/web/src/components/ui/ThemeToggle.tsx`

---

### 3. 首页 AI Journey Preview 自动轮播

**现状:** 纯静态硬编码 JSX 卡片，展示固定的推荐结果。

**方案:** 改为自动轮播组件，展示完整购车旅程 5 个阶段：

1. **需求分析** — AI 对话气泡，确认预算、用途、偏好
2. **智能推荐** — 匹配车型卡片，带评分（92%、85%）
3. **对比评测** — 多车横向对比表格（参数对比）
4. **试驾预约** — 门店选择 + 时间选择 UI
5. **金融方案** — 贷款/全款方案对比卡片

交互行为：
- 每 4 秒自动切换到下一阶段，循环播放
- 底部有进度指示点（dots），可点击跳转
- hover 时暂停自动播放
- 切换时使用淡入淡出过渡动画

数据定义在 `mock-data.ts` 中，纯前端实现。

**新建文件:** `apps/web/src/components/home/JourneyCarousel.tsx`
**改动文件:** `apps/web/src/app/page.tsx`, `apps/web/src/lib/mock-data.ts`

---

### 4. Community "从此出发"按钮主题适配

**现状:** `ForkButton.tsx` 中硬编码 `bg-orange-500 hover:bg-orange-600`。

**方案:** 替换为 CSS 变量 `bg-[var(--accent)] hover:bg-[var(--accent-hover)]`。

**改动文件:** `apps/web/src/components/community/ForkButton.tsx`

---

### 5. 登录页主题适配 + 全局浮动工具栏

#### 5a. 登录页主题适配

**现状:** 全部硬编码 Tailwind 颜色（`bg-white`, `text-slate-900`, `border-slate-200`），不跟随主题。

**方案:** 所有硬编码颜色替换为 CSS 变量（`bg-[var(--bg)]`, `text-[var(--text)]`, `border-[var(--border)]` 等）。同时检查并修复 `OtpForm.tsx` 和 `WechatLoginButton.tsx` 的硬编码颜色。

**改动文件:** `apps/web/src/app/login/page.tsx`, `apps/web/src/components/auth/OtpForm.tsx`, `apps/web/src/components/auth/WechatLoginButton.tsx`

#### 5b. 全局浮动工具栏 FloatingToolbar

**现状:** 只有首页和社区页导航栏中有 ThemeToggle，登录页和 Journey 内页没有任何切换入口。

**方案:** 新建 `FloatingToolbar` 组件：
- 包含：主题切换（半圆色块）+ 语言切换（中/EN 文字切换按钮）
- 样式：`fixed top-4 right-4 z-50`，小巧的圆角胶囊，半透明背景
- 挂载位置：根 `layout.tsx`，所有页面自动继承
- 显示逻辑：
  - 首页/社区页：导航栏已有主题切换，浮动栏仅在滚动超过导航栏时显示（或始终显示语言切换部分）
  - 登录页/内页：始终显示完整浮动栏

**新建文件:** `apps/web/src/components/ui/FloatingToolbar.tsx`
**改动文件:** `apps/web/src/app/layout.tsx`

---

### 6. Mock 登录接口补全

**现状:** `MOCK_MODE = true`，但只 mock 了 GET 请求。POST 请求（发送验证码、登录验证）返回 `undefined`，导致登录流程失败。

**方案:** 在 `api.ts` 的 `getMockResponse` 中补充 POST 路由：
- `POST /auth/send-code` → `{ success: true, message: "验证码已发送" }`
- `POST /auth/verify` → `{ token: "mock-jwt-token", user: { id: "1", name: "Mock User", phone: "138****0000" } }`

同时修复 `request()` 函数中 POST/PATCH/DELETE 在 mock 模式下的处理逻辑，使其也经过 `getMockResponse`。

**改动文件:** `apps/web/src/lib/api.ts`

---

### 7. 内页主题检查与修复

**现状:** Journey 内页组件（JourneyShell, ChatPanel, StageProgress）已使用 CSS 变量，基本适配。但 auth 相关组件可能有硬编码颜色。

**方案:** 逐一检查以下组件，将硬编码 Tailwind 颜色替换为 CSS 变量：
- `ChatInput.tsx`
- `MessageBubble.tsx`
- `StageProgress.tsx`
- `JourneyShell.tsx`
- `ChatPanel.tsx`

**改动文件:** 上述组件中存在硬编码颜色的文件

---

### i18n 基础设施

**现状:** 无任何国际化支持。

**方案:** 客户端 i18n，与 theme 切换模式统一：

1. **`useLocale` hook** — 类似 `useTheme`，用 `useSyncExternalStore` + localStorage（key: `'locale'`），默认 `'zh'`
2. **`lib/i18n.ts`** — 翻译字典结构：
   ```ts
   const messages = {
     zh: { 'home.hero.title': '...', ... },
     en: { 'home.hero.title': '...', ... },
   }
   ```
3. **`useT` hook** — 返回 `t(key)` 函数，从当前 locale 对应的字典取值
4. **翻译范围:** 本次覆盖首页、登录页、社区页的用户可见文案。Journey 内页文案后续补充。
5. **anti-FOUC:** 在 `layout.tsx` 的 head script 中同步读取 localStorage locale，设置 `data-locale` 属性

**新建文件:** `apps/web/src/hooks/useLocale.ts`, `apps/web/src/lib/i18n.ts`, `apps/web/src/hooks/useT.ts`
**改动文件:** `apps/web/src/app/layout.tsx`, 以及所有需要翻译的页面组件

---

## Architecture Notes

- 主题系统保持现有 CSS 变量 + `data-theme` 属性方案不变
- i18n 采用同构模式（localStorage + `useSyncExternalStore`），与主题切换一致
- FloatingToolbar 作为全局 UI 元素在根 layout 挂载，避免各页面重复引入
- Journey Preview 轮播组件独立封装，数据驱动，便于后续接入真实 API
