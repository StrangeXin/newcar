# NewCar 视觉升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 NewCar 进行全面视觉升级——建立完整 Design Token 系统、双主题切换、核心 UI 组件库、页面布局重构。

**Architecture:** 四轨道推进（Track 1 设计基础 → Track 2 核心组件 → Track 3 页面布局 → Track 4 Tailwind 配置同步），Track 1-3 有依赖顺序，Track 4 可在 Track 2 之后任意时间执行。所有颜色/间距/圆角/阴影通过 CSS 变量控制，组件仅引用 token，主题切换零代码改动。

**Tech Stack:** Next.js 14 + React 18 + Tailwind CSS 3.4 + Lucide React + Zustand + Playwright (E2E)

**依赖 Spec：** `docs/superpowers/specs/2026-03-24-visual-upgrade-design.md`

---

## 文件结构概览

### 新建文件

```
apps/web/src/
├── app/fonts.ts                           # Google Fonts 加载配置
├── hooks/useTheme.ts                      # 主题切换 hook
├── components/ui/
│   ├── Button.tsx                         # 按钮组件（4 变体 × 3 尺寸）
│   ├── Card.tsx                           # 卡片组件（3 变体 + 子组件）
│   ├── Badge.tsx                          # 标签组件（4 语义变体）
│   ├── Input.tsx                          # 输入框组件
│   ├── PageHeader.tsx                     # 页面标题区组件
│   └── ThemeToggle.tsx                    # 主题切换按钮
docs/design-system/
├── tokens.md                              # CSS 变量完整定义
├── components.md                          # 组件用法与变体
├── typography.md                          # 字体规范
├── icons.md                               # 图标使用规范
└── themes.md                              # 主题扩展指南
```

### 修改文件

```
apps/web/src/app/globals.css               # 完整 Token 重写 + 双主题
apps/web/src/app/layout.tsx                # 字体 + 防闪脚本
apps/web/src/app/page.tsx                  # 首页 Hero 重构
apps/web/src/app/community/page.tsx        # 社区页升级
apps/web/src/components/ui/IconBadge.tsx   # 迁移至 token 变量
apps/web/src/components/chat/MessageBubble.tsx    # 气泡视觉升级
apps/web/src/components/chat/ChatPanel.tsx        # 面板升级
apps/web/src/components/chat/ChatInput.tsx        # 输入区升级
apps/web/src/components/journey/StageProgress.tsx # 时间线视觉升级
apps/web/src/components/journey/JourneyShell.tsx  # 三栏布局升级
apps/web/src/components/community/JourneyFeedCard.tsx  # 卡片升级
apps/web/src/components/community/FeedFilters.tsx      # 筛选栏升级
apps/web/tailwind.config.ts                # 扩展 token 引用
```

---

## Track 1：设计基础

### Task 1：重写 globals.css — 完整 Token 系统 + 双主题

**Files:**
- Modify: `apps/web/src/app/globals.css`

**上下文：** 当前 globals.css（142 行）只有少量 CSS 变量（`--bg`, `--surface`, `--accent` 等），无主题切换能力。需要全面重写 `:root` 块，增加 `[data-theme="indigo"]` 主题，保留现有的 sky-* remap 规则和 Lucide 图标规则。

- [ ] **Step 1：备份并重写 `:root` 变量块**

将 `globals.css:5-19` 的 `:root` 块替换为完整 token 系统。保留 `color-scheme: light`。

**完整的 `:root` / `[data-theme="orange"]` 变量定义（来自 spec 第二节）：**

```css
:root,
[data-theme="orange"] {
  color-scheme: light;

  /* === Font Stacks === */
  --font-display: 'Playfair Display', 'Noto Serif SC', Georgia, serif;
  --font-body: 'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'IBM Plex Mono', 'Fira Code', monospace;

  /* === Colors — Background & Surface === */
  --bg: #fff9f4;
  --bg-gradient:
    radial-gradient(64rem 44rem at -6% -2%, #ffe4d6 0%, rgba(255,228,214,0) 70%),
    radial-gradient(44rem 34rem at 102% 8%, #ffe9d0 0%, rgba(255,233,208,0) 68%),
    radial-gradient(50rem 40rem at 80% 100%, #daf6ec 0%, rgba(218,246,236,0) 68%);
  --surface: #ffffff;
  --surface-subtle: #fdfaf6;
  --border: #f0e6d8;
  --border-soft: #e8ddd0;

  /* === Colors — Accent === */
  --accent: #f97316;
  --accent-hover: #ea580c;
  --accent-muted: #fff7ed;
  --accent-border: #fed7aa;
  --accent-text: #c2410c;
  --accent-text-soft: #9a3412;

  /* === Colors — Text === */
  --text: #0f172a;
  --text-soft: #475569;
  --text-muted: #94a3b8;

  /* === Colors — Focus === */
  --focus-ring: #ea580c;
  --focus-glow: rgba(249,115,22,0.22);

  /* === Shadows (themed) === */
  --shadow-card: 0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(249,115,22,0.05);
  --shadow-accent: 0 2px 8px rgba(249,115,22,0.30);

  /* === Selection === */
  --selection-bg: rgba(249,115,22,0.2);
  --selection-color: #7c2d12;

  /* === Typography Scale === */
  --text-xs: 0.6875rem;
  --text-sm: 0.75rem;
  --text-base: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  --leading-tight: 1.2;
  --leading-snug: 1.35;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.08em;
  --tracking-widest: 0.16em;

  /* === Spacing (8pt grid) === */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* === Border Radius === */
  --radius-sm: 0.375rem;
  --radius-md: 0.5625rem;
  --radius-lg: 0.625rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;

  /* === Shadows (non-themed) === */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);

  /* === Semantic Colors (shared) === */
  --success: #22c55e;
  --success-muted: #f0fdf4;
  --success-border: #bbf7d0;
  --success-text: #166534;
  --warning: #f59e0b;
  --warning-muted: #fffbeb;
  --warning-border: #fde68a;
  --warning-text: #92400e;
  --error: #ef4444;
  --info: #3b82f6;
}
```

- [ ] **Step 2：添加靛蓝主题变量块**

在 `:root` 块之后，添加 `[data-theme="indigo"]` 覆盖块（仅覆盖与橙暖主题不同的变量）：

```css
[data-theme="indigo"] {
  --bg: #f8fafc;
  --bg-gradient: none;
  --surface-subtle: #f8fafc;
  --border: #e2e8f0;
  --border-soft: #e8edf5;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-muted: #eef2ff;
  --accent-border: #c7d2fe;
  --accent-text: #4338ca;
  --accent-text-soft: #3730a3;
  --focus-ring: #6366f1;
  --focus-glow: rgba(99,102,241,0.2);
  --shadow-card: 0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(99,102,241,0.05);
  --shadow-accent: 0 2px 8px rgba(99,102,241,0.25);
  --selection-bg: rgba(99,102,241,0.15);
  --selection-color: #312e81;
}
```

- [ ] **Step 3：更新 body 和全局规则**

更新以下全局规则以引用新 token：

```css
body {
  font-family: var(--font-body), 'PingFang SC', 'Segoe UI', sans-serif;
  margin: 0;
  min-height: 100vh;
  background: var(--bg-gradient), var(--bg);
  color: var(--text);
  line-height: var(--leading-normal);
}

h1, h2, h3, h4 {
  font-family: var(--font-display), 'PingFang SC', sans-serif;
  letter-spacing: var(--tracking-tight);
}

::selection {
  background: var(--selection-bg);
  color: var(--selection-color);
}
```

- [ ] **Step 4：删除废弃变量**

从 `:root` 中移除 `--font-heading`、`--surface-strong`、`--accent-strong`（已被 `--font-display`、`--surface`、`--accent-hover` 替代）。

- [ ] **Step 5：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`
Expected: 构建成功，无 CSS 解析错误。

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(design): rewrite globals.css with full token system and dual theme support"
```

---

### Task 2：集成 Google Fonts

**Files:**
- Create: `apps/web/src/app/fonts.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1：创建 fonts.ts**

```ts
import { Playfair_Display, Inter } from 'next/font/google';

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
```

- [ ] **Step 2：更新 layout.tsx 引入字体**

在 `layout.tsx` 中导入字体并添加到 `<html>` 的 `className`：

```tsx
import type { Metadata } from 'next';
import { playfair, inter } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'NewCar Journey',
  description: 'AI 原生购车工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`
Expected: 构建成功，字体文件被 Next.js 预加载。

```bash
git add apps/web/src/app/fonts.ts apps/web/src/app/layout.tsx
git commit -m "feat(design): integrate Playfair Display and Inter via next/font"
```

---

### Task 3：主题切换系统

**Files:**
- Create: `apps/web/src/hooks/useTheme.ts`
- Create: `apps/web/src/components/ui/ThemeToggle.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1：在 layout.tsx 添加防闪脚本**

在 `<head>` 中插入内联脚本，从 `localStorage` 读取主题并注入 `data-theme`，防止页面加载时的主题闪烁（FOUC）：

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var t=localStorage.getItem('theme')||'orange';document.documentElement.setAttribute('data-theme',t);})();`
        }} />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2：创建 useTheme hook**

```ts
// apps/web/src/hooks/useTheme.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'orange' | 'indigo';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'orange';

function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return (localStorage.getItem(STORAGE_KEY) as Theme) || DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function subscribe(callback: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) callback();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
    // Trigger re-render for same-tab updates
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }, []);

  return { theme, setTheme };
}
```

- [ ] **Step 3：创建 ThemeToggle 组件**

```tsx
// apps/web/src/components/ui/ThemeToggle.tsx
'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'orange' ? 'indigo' : 'orange';
  const Icon = theme === 'orange' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      aria-label={`切换到${next === 'orange' ? '橙暖' : '靛蓝'}主题`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
```

- [ ] **Step 4：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`
Expected: 构建成功。

```bash
git add apps/web/src/hooks/useTheme.ts apps/web/src/components/ui/ThemeToggle.tsx apps/web/src/app/layout.tsx
git commit -m "feat(design): add theme switching system with useTheme hook and anti-FOUC script"
```

---

### Task 4：废弃变量全局替换

**Files:**
- Modify: `apps/web/src/components/journey/StageProgress.tsx:52`
- Modify: `apps/web/src/app/page.tsx:10`
- Modify: 所有引用 `--font-heading` 或 `--surface-strong` 的文件

**上下文：** Spec 废弃了 `--font-heading`（→ `--font-display`）和 `--surface-strong`（→ `--surface`）。需要全局搜索并替换所有引用。同时，代码中大量使用 `text-sky-*`、`bg-sky-*` 等旧 Tailwind class（通过 globals.css remap 实现），在后续 Track 2/3 中会逐步替换为 token 引用。本 Task 仅处理 CSS 变量引用的替换。

- [ ] **Step 1：搜索 `--font-heading` 引用**

Run: `grep -rn "font-heading" apps/web/src/`

预期：可能在 globals.css（已在 Task 1 删除）和个别组件中。

- [ ] **Step 2：搜索 `--surface-strong` 引用**

Run: `grep -rn "surface-strong" apps/web/src/`

预期：可能在部分组件的 Tailwind 任意值 class 中。

- [ ] **Step 3：全局替换**

将所有 `var(--font-heading)` 替换为 `var(--font-display)`。
将所有 `var(--surface-strong)` 替换为 `var(--surface)`。
将所有 `var(--accent-strong)` 替换为 `var(--accent-hover)`。

- [ ] **Step 4：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`
Expected: 构建成功。

```bash
git add -u apps/web/src/
git commit -m "refactor(design): replace deprecated --font-heading, --surface-strong, --accent-strong tokens"
```

---

### Task 5：创建设计系统文档

**Files:**
- Create: `docs/design-system/tokens.md`
- Create: `docs/design-system/components.md`
- Create: `docs/design-system/typography.md`
- Create: `docs/design-system/icons.md`
- Create: `docs/design-system/themes.md`

**上下文：** `docs/design-system/README.md` 已存在，引用了这 5 个文件但尚未创建。从 spec `docs/superpowers/specs/2026-03-24-visual-upgrade-design.md` 提取内容。

- [ ] **Step 1：创建 tokens.md**

内容包含：spec 第二节所有 CSS 变量表格（颜色、字型、间距、圆角、阴影），双主题对照，每个 token 的用途说明。

- [ ] **Step 2：创建 typography.md**

内容包含：spec 第三节字体栈定义、加载策略、排版规则（Latin/CJK 区分）、字号阶梯。

- [ ] **Step 3：创建 icons.md**

内容包含：spec 1.2 图标规范（Lucide 统一规则、stroke-width: 1.85、emoji 禁用规则）。

- [ ] **Step 4：创建 components.md**

内容包含：spec 第五节所有组件的变体定义、尺寸、样式规则。初始版本先列出规范，Track 2 实现后补充代码示例。

- [ ] **Step 5：创建 themes.md**

内容包含：spec 第四节主题架构、如何新增第三套主题（只需添加 `[data-theme="xxx"]` 块）、`useTheme` hook 用法。

- [ ] **Step 6：提交**

```bash
git add docs/design-system/
git commit -m "docs(design-system): add tokens, typography, icons, components, themes documentation"
```

---

## Track 2：核心组件

### Task 6：Button 组件

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`

**上下文：** 当前项目无统一 Button 组件，各页面内联编写按钮样式（如 `page.tsx:20-29`、`ChatInput.tsx:55-63`）。本组件建立后，Track 3 页面升级时逐步替换。

- [ ] **Step 1：编写 Button 组件**

```tsx
// apps/web/src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)] hover:-translate-y-[1px]',
  secondary:
    'bg-white border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-soft)]',
  ghost:
    'bg-transparent text-[var(--accent)] hover:bg-[var(--accent-muted)]',
  danger:
    'bg-[var(--error)] text-white hover:opacity-90',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[var(--text-sm)]',
  md: 'h-10 px-4 text-[var(--text-base)]',
  lg: 'h-11 px-5 text-[var(--text-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-md)] font-semibold transition-all duration-[180ms] ease-out disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/Button.tsx
git commit -m "feat(ui): add Button component with 4 variants and 3 sizes"
```

---

### Task 7：Card 组件

**Files:**
- Create: `apps/web/src/components/ui/Card.tsx`

- [ ] **Step 1：编写 Card 组件**

```tsx
// apps/web/src/components/ui/Card.tsx
import { type HTMLAttributes, type ReactNode } from 'react';

type CardVariant = 'default' | 'subtle' | 'accent';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const variantClass: Record<CardVariant, string> = {
  default:
    'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]',
  subtle:
    'bg-[var(--surface-subtle)] border border-[var(--border-soft)]',
  accent:
    'bg-[var(--surface)] border-2 border-[var(--accent)]',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] ${variantClass[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`font-[var(--font-display)] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`text-[var(--text-soft)] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/Card.tsx
git commit -m "feat(ui): add Card component with default/subtle/accent variants"
```

---

### Task 8：Badge 组件

**Files:**
- Create: `apps/web/src/components/ui/Badge.tsx`

- [ ] **Step 1：编写 Badge 组件**

```tsx
// apps/web/src/components/ui/Badge.tsx
import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

type BadgeVariant = 'accent' | 'success' | 'warning' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  accent:
    'bg-[var(--accent-muted)] text-[var(--accent-text)] border-[var(--accent-border)]',
  success:
    'bg-[var(--success-muted)] text-[var(--success-text)] border-[var(--success-border)]',
  warning:
    'bg-[var(--warning-muted)] text-[var(--warning-text)] border-[var(--warning-border)]',
  neutral:
    'bg-[#f8fafc] text-[var(--text-soft)] border-[var(--border)]',
};

export function Badge({ variant = 'neutral', icon: Icon, className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[var(--text-xs)] font-semibold ${variantClass[variant]} ${className}`}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/Badge.tsx
git commit -m "feat(ui): add Badge component with 4 semantic variants"
```

---

### Task 9：Input 组件

**Files:**
- Create: `apps/web/src/components/ui/Input.tsx`

- [ ] **Step 1：编写 Input 组件**

```tsx
// apps/web/src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  error?: boolean;
}

const sizeClass: Record<InputSize, string> = {
  sm: 'h-8 text-[var(--text-sm)]',
  md: 'h-10 text-[var(--text-base)]',
  lg: 'h-11 text-[var(--text-md)]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error = false, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-[var(--radius-md)] border bg-[var(--surface-subtle)] px-3 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all duration-[180ms] ease-out focus:bg-[var(--surface)] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${
          error
            ? 'border-[var(--error)]'
            : 'border-[var(--border)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]'
        } ${sizeClass[inputSize]} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
```

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/Input.tsx
git commit -m "feat(ui): add Input component with focus glow and error state"
```

---

### Task 10：MessageBubble 视觉升级

**Files:**
- Modify: `apps/web/src/components/chat/MessageBubble.tsx`

**上下文：** 当前 MessageBubble（188 行）使用硬编码颜色（`bg-slate-900`、`bg-slate-50`、`bg-sky-50`、`bg-emerald-50`）。升级为使用 token 变量，同时调整圆角和 max-width 符合 spec。

- [ ] **Step 1：升级用户消息样式**

将 `MessageBubble.tsx:59-63` 的用户消息样式从：
```
rounded-[14px_14px_2px_14px] bg-slate-900 text-white
```
替换为：
```
rounded-[12px_12px_3px_12px] bg-[var(--accent)] text-white
```

将 AI 消息样式从：
```
rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 text-slate-700
```
替换为：
```
rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text)]
```

将 max-width 从 `max-w-[85%]` 调整为：用户消息 `max-w-[78%]`，AI 消息 `max-w-[88%]`。

- [ ] **Step 2：升级 tool_status 样式**

将 `MessageBubble.tsx:25-29` 的 tool_status 样式从：
```
border border-sky-200 bg-sky-50 ... text-sky-700
```
替换为：
```
border border-[var(--accent-border)] bg-[var(--accent-muted)] ... text-[var(--accent-text)]
```

- [ ] **Step 3：升级 side_effect 样式**

将 `MessageBubble.tsx:44-47` 的 side_effect 样式从：
```
border-emerald-200 bg-emerald-50 ... text-emerald-700
```
替换为：
```
border-[var(--success-border)] bg-[var(--success-muted)] ... text-[var(--success-text)]
```

- [ ] **Step 4：升级 AiAvatar 样式**

将 `MessageBubble.tsx:76` 的 `bg-sky-700` 替换为 `bg-[var(--accent)]`。

- [ ] **Step 5：升级流式光标颜色**

将 `MessageBubble.tsx:67` 的 `bg-sky-600` 替换为 `bg-[var(--accent)]`。

- [ ] **Step 6：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): upgrade MessageBubble to use design tokens"
```

---

### Task 11：StageProgress 视觉升级

**Files:**
- Modify: `apps/web/src/components/journey/StageProgress.tsx`

**上下文：** 当前 StageProgress（140 行）使用硬编码 Tailwind 颜色类（`border-orange-600`、`bg-emerald-50`、`text-sky-700` 等）。升级为使用 token 变量，调整视觉样式符合 spec 第 5.6 节竖向时间线设计。

- [ ] **Step 1：升级 StageItem 颜色**

将 `StageProgress.tsx:26-36` 的颜色映射替换为 token 引用：

active 态：`border-[var(--accent)] bg-[var(--accent)] text-white`
completed 态：`border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-text)]`
未完成态：`border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]`

active dot：`bg-white/20 text-white`
completed dot：`bg-[var(--success-muted)] text-[var(--success-text)]`
未完成 dot：`bg-[var(--surface-subtle)] text-[var(--text-muted)]`

- [ ] **Step 2：升级 DesktopStageProgress 颜色**

将 `StageProgress.tsx:54-94` 中的硬编码颜色替换：

- `text-orange-600` → `text-[var(--accent-text)]`
- `text-sky-700`（Route 图标）→ `text-[var(--accent)]`
- `border-orange-200 bg-orange-50` → `border-[var(--accent-border)] bg-[var(--accent-muted)]`
- `text-orange-700` → `text-[var(--accent-text)]`
- `text-orange-800` → `text-[var(--accent-text-soft)]`
- `bg-orange-200` → `bg-[var(--accent-border)]`
- `bg-[linear-gradient(90deg,#ea580c,#f97316)]` → `bg-[var(--accent)]`
- `text-orange-800/80` → `text-[var(--accent-text-soft)]`
- `border-slate-300` → `border-[var(--border)]`
- `text-slate-700` → `text-[var(--text-soft)]`

- [ ] **Step 3：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/journey/StageProgress.tsx
git commit -m "feat(journey): upgrade StageProgress to use design tokens"
```

---

### Task 12：JourneyFeedCard 视觉升级

**Files:**
- Modify: `apps/web/src/components/community/JourneyFeedCard.tsx`

**上下文：** 当前 JourneyFeedCard（67 行）使用硬编码 Tailwind 颜色（`border-slate-200`、`bg-white/90`、`text-sky-700`）。升级为使用 token 变量，标题改用 `--font-display`，「查看详情」链接颜色改用 `--accent`。

- [ ] **Step 1：升级卡片容器**

将 `JourneyFeedCard.tsx:21` 的容器样式从：
```
rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-card
```
替换为：
```
rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]
```

- [ ] **Step 2：升级标题为 Serif 字体**

将 `JourneyFeedCard.tsx:24` 的标题样式添加 `font-[family-name:var(--font-display)]`：
```
text-sm font-semibold text-slate-900
```
改为：
```
font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--text)]
```

- [ ] **Step 3：升级「查看详情」链接颜色**

将 `JourneyFeedCard.tsx:57` 的 `text-sky-700 ... hover:text-sky-800` 替换为 `text-[var(--accent)] ... hover:text-[var(--accent-hover)]`。

- [ ] **Step 4：升级其他颜色引用**

将所有 `text-slate-*`、`border-slate-*`、`bg-slate-*` 替换为对应 token：
- `text-slate-900` → `text-[var(--text)]`
- `text-slate-500` → `text-[var(--text-muted)]`
- `text-slate-600` → `text-[var(--text-soft)]`
- `text-slate-700` → `text-[var(--text-soft)]`
- `border-slate-200` → `border-[var(--border)]`
- `bg-slate-50` → `bg-[var(--surface-subtle)]`

- [ ] **Step 5：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/community/JourneyFeedCard.tsx
git commit -m "feat(community): upgrade JourneyFeedCard to use design tokens and serif headings"
```

---

### Task 13：PageHeader 组件

**Files:**
- Create: `apps/web/src/components/ui/PageHeader.tsx`

- [ ] **Step 1：编写 PageHeader 组件**

```tsx
// apps/web/src/components/ui/PageHeader.tsx
import { type ReactNode } from 'react';

interface PageHeaderProps {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function PageHeader({ label, title, description, className = '' }: PageHeaderProps) {
  return (
    <div className={className}>
      {label ? (
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text-soft)]">
          {label}
        </p>
      ) : null}
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-bold text-[var(--text)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-[var(--text-base)] text-[var(--text-soft)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
```

注意：`label` 行的 `uppercase` 仅在英文内容时生效。如果需要中文 label，调用方自行去掉 `uppercase` class 或传入中文直接展示。

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/PageHeader.tsx
git commit -m "feat(ui): add PageHeader component with label/title/description structure"
```

---

### Task 14：IconBadge 升级（Token 迁移）

**Files:**
- Modify: `apps/web/src/components/ui/IconBadge.tsx`

**上下文：** 当前 IconBadge（34 行）使用硬编码 Tailwind 颜色（`bg-orange-100 text-orange-700`）。需迁移到 token 变量，并增加 `warning` 变体。

- [ ] **Step 1：替换颜色映射**

将 `IconBadge.tsx:8-12` 的 `toneClassMap` 从：
```ts
const toneClassMap: Record<BadgeTone, string> = {
  accent: 'bg-orange-100 text-orange-700',
  success: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-slate-100 text-slate-700',
};
```
替换为：
```ts
type BadgeTone = 'accent' | 'success' | 'warning' | 'neutral';

const toneClassMap: Record<BadgeTone, string> = {
  accent: 'bg-[var(--accent-muted)] text-[var(--accent-text)]',
  success: 'bg-[var(--success-muted)] text-[var(--success-text)]',
  warning: 'bg-[var(--warning-muted)] text-[var(--warning-text)]',
  neutral: 'bg-[var(--surface-subtle)] text-[var(--text-soft)]',
};
```

- [ ] **Step 2：调整圆角和尺寸**

将 `IconBadge.tsx:14-17` 的 `sizeClassMap` 中的 `rounded-md` 替换为 `rounded-[var(--radius-sm)]`，尺寸调整为 spec 规定的 `h-7 w-7` (sm) / `h-9 w-9` (md)：

```ts
const sizeClassMap: Record<BadgeSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-7 w-7 rounded-[var(--radius-sm)]', icon: 'h-4 w-4' },
  md: { shell: 'h-9 w-9 rounded-[var(--radius-sm)]', icon: 'h-5 w-5' },
};
```

- [ ] **Step 3：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/ui/IconBadge.tsx
git commit -m "feat(ui): upgrade IconBadge to use design tokens and add warning variant"
```

---

### Task 15：ChatPanel + ChatInput 视觉升级

**Files:**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`
- Modify: `apps/web/src/components/chat/ChatInput.tsx`

**上下文：** ChatPanel（65 行）和 ChatInput（68 行）使用硬编码颜色和间距。需迁移到 token 变量。

- [ ] **Step 1：升级 ChatPanel 容器**

将 `ChatPanel.tsx:37` 的 `border-slate-200 bg-white/90` 替换为 `border-[var(--border)] bg-[var(--surface)]`。

将 `ChatPanel.tsx:39` 的 `border-b border-slate-200` 替换为 `border-b border-[var(--border-soft)]`。

将 `ChatPanel.tsx:42` 的标题 `text-slate-900` 替换为 `text-[var(--text)]`。

将 `ChatPanel.tsx:47` 的标签 `border-slate-200 bg-slate-50 ... text-slate-500` 替换为 `border-[var(--border)] bg-[var(--surface-subtle)] ... text-[var(--text-muted)]`。

将 `ChatPanel.tsx:40` 的状态点 `bg-emerald-500` / `bg-slate-300` 替换为 `bg-[var(--success)]` / `bg-[var(--text-muted)]`。

- [ ] **Step 2：升级 ChatInput 样式**

将 `ChatInput.tsx:31` 的 `border-t border-slate-200 bg-white/90` 替换为 `border-t border-[var(--border-soft)] bg-[var(--surface)]`。

将快捷操作按钮（`ChatInput.tsx:38`）的 `border-slate-200 bg-slate-50 ... text-slate-600` 替换为 `border-[var(--border)] bg-[var(--accent-muted)] ... text-[var(--accent-text)]`，并改为 pill 样式 `rounded-[var(--radius-full)]`。

将输入框（`ChatInput.tsx:53`）的 `border-slate-300 ... ring-sky-300` 替换为 `border-[var(--border)] ... focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]`。去掉 `ring-sky-300 focus:ring-2`。

将发送按钮（`ChatInput.tsx:60`）的 `bg-orange-500 ... hover:bg-orange-600` 替换为 `bg-[var(--accent)] ... hover:bg-[var(--accent-hover)]`。

- [ ] **Step 3：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/chat/ChatPanel.tsx apps/web/src/components/chat/ChatInput.tsx
git commit -m "feat(chat): upgrade ChatPanel and ChatInput to use design tokens"
```

---

## Track 3：页面布局

### Task 16：首页 Hero 重构

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**上下文：** 当前首页（92 行）使用简单居中布局和硬编码颜色。升级为 spec 第 6.1 节的全屏左右分栏布局，使用新组件和 token。

- [ ] **Step 1：添加顶部透明粘性导航栏**

在 `<main>` 顶部添加导航栏（桌面端）：

```tsx
<nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border-soft)]/50 bg-[var(--bg)]/80 px-6 py-3 backdrop-blur-md">
  <span className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--text)]">
    NewCar
  </span>
  <div className="flex items-center gap-3">
    <Link href="/community" className="text-[var(--text-sm)] font-medium text-[var(--text-soft)] hover:text-[var(--text)]">
      社区
    </Link>
    <ThemeToggle />
    <Link href="/login">
      <Button size="sm">登录</Button>
    </Link>
  </div>
</nav>
```

- [ ] **Step 2：重写 Hero 区域为左右分栏**

将 `page.tsx:7-52` 的 hero section 重写为：

```tsx
<section className="grid min-h-[calc(100vh-80px)] items-center gap-8 pt-20 md:grid-cols-2">
  <div>
    <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text-soft)]">
      NewCar Workspace
    </p>
    <h1 className="mt-4 font-[family-name:var(--font-display)] text-[var(--text-4xl)] font-extrabold leading-[var(--leading-tight)] text-[var(--text)]">
      让购车决策像项目管理一样清晰
    </h1>
    <p className="mt-1 font-[family-name:var(--font-display)] text-[var(--text-xl)] text-[var(--text-soft)]">
      Your car buying journey, organized.
    </p>
    <p className="mt-5 text-[var(--text-base)] leading-[var(--leading-relaxed)] text-[var(--text-soft)]">
      从需求澄清、候选筛选到最终成交，把分散的信息变成同一条可追踪的 Journey。
    </p>
    <div className="mt-9 flex flex-wrap gap-4">
      <Button size="lg">开始我的旅程</Button>
      <Button variant="secondary" size="lg">浏览社区</Button>
    </div>
  </div>
  <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em] text-[var(--accent-text-soft)]">
        AI Assistant Preview
      </p>
      {/* 复用现有 page.tsx 的三行预览数据，颜色在 Step 3 中迁移 */}
    </div>
  </div>
</section>
```

- [ ] **Step 3：升级右侧 AI 预览卡颜色**

将 `page.tsx:32-50` 的预览卡内容中 `text-sky-700`、`bg-sky-50`、`bg-orange-50` 等颜色替换为 token 引用：

- `text-sky-700` → `text-[var(--accent-text)]`
- `bg-sky-50` → `bg-[var(--accent-muted)]`
- `bg-orange-50` → `bg-[var(--accent-muted)]`
- `text-orange-700` → `text-[var(--accent-text)]`
- `text-orange-600` → `text-[var(--accent)]`

- [ ] **Step 4：升级底部三特性横栏颜色**

将 `page.tsx:54-88` 的三特性卡片中的硬编码颜色替换为 token：

- `border-slate-200 bg-white/90` → `border-[var(--border)] bg-[var(--surface)]`
- `text-slate-900` → `text-[var(--text)]`
- `text-slate-600` → `text-[var(--text-soft)]`
- `bg-orange-100 text-orange-700` → `bg-[var(--accent-muted)] text-[var(--accent-text)]`
- `bg-emerald-100 text-emerald-700` → `bg-[var(--success-muted)] text-[var(--success-text)]`

- [ ] **Step 5：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(home): redesign Hero with split layout, serif headings, and design tokens"
```

---

### Task 17：旅程工作台三栏布局升级

**Files:**
- Modify: `apps/web/src/components/journey/JourneyShell.tsx`

**上下文：** 当前 JourneyShell（54 行）使用 `xl:grid-cols-[260px_minmax(0,1.618fr)_minmax(360px,1fr)]`。Spec 定义桌面三栏为 `148px 1fr 1fr`（≥1280px），平板两栏保持不变。

- [ ] **Step 1：更新桌面网格列定义**

将 `JourneyShell.tsx:24` 的网格定义从：
```
xl:grid-cols-[260px_minmax(0,1.618fr)_minmax(360px,1fr)]
```
替换为：
```
xl:grid-cols-[148px_1fr_1fr]
```

- [ ] **Step 2：升级颜色到 token**

将 `JourneyShell.tsx` 中的硬编码颜色替换：

- FAB 按钮（`JourneyShell.tsx:37`）: `bg-orange-500` → `bg-[var(--accent)]`，`shadow-[0_8px_24px_rgba(249,115,22,0.35)]` → `shadow-[var(--shadow-accent)]`
- 移动端遮罩（`JourneyShell.tsx:44`）: 保持 `bg-black/35`
- 底部 sheet（`JourneyShell.tsx:46`）: `border-slate-200 bg-slate-50` → `border-[var(--border)] bg-[var(--surface-subtle)]`

- [ ] **Step 3：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/components/journey/JourneyShell.tsx
git commit -m "feat(journey): update workspace to 148px/1fr/1fr three-column layout with design tokens"
```

---

### Task 18：社区广场页面升级

**Files:**
- Modify: `apps/web/src/app/community/page.tsx`
- Modify: `apps/web/src/components/community/FeedFilters.tsx`

**上下文：** 社区页（74 行）使用硬编码颜色。升级为 spec 第 6.3 节的视觉方案：置顶横幅渐变背景 + 粘性筛选栏 + 双列 Feed。

- [ ] **Step 1：升级社区页头部**

将 `community/page.tsx:49-59` 的 header 改用 PageHeader 组件和 token 颜色：

```tsx
import { PageHeader } from '@/components/ui/PageHeader';

<header className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
  style={{ background: 'var(--bg-gradient), var(--surface)' }}
>
  <PageHeader
    label="Community"
    title={<><Sparkles className="inline h-5 w-5 text-[var(--accent)]" aria-hidden="true" /> 社区广场</>}
    description="浏览真实购车历程，并从模板快速开始你的旅程。"
  />
</header>
```

- [ ] **Step 2：升级 FeedFilters 为粘性筛选栏**

将 `FeedFilters.tsx:34` 的容器添加粘性定位和 backdrop-blur：

```
sticky top-0 z-10 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg)]/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-md
```

将 `FeedFilters.tsx:35` 的标签颜色 `text-sky-700` 替换为 `text-[var(--accent-text-soft)]`。

将所有 `<select>` 的 `border-slate-300 ... ring-sky-300` 替换为 `border-[var(--border)] ... focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]`。去掉 `ring-sky-300 focus:ring-2`。

- [ ] **Step 3：启用双列 Feed 布局**

当前 `JourneyFeedList` 使用 `space-y-3` 单列布局（`JourneyFeedList.tsx:29`）。修改 `JourneyFeedList.tsx:29` 的容器样式从 `space-y-3` 改为 `grid gap-4 md:grid-cols-2`：

```tsx
// JourneyFeedList.tsx:28-33
return (
  <div className="grid gap-4 md:grid-cols-2">
    {items.map((item) => (
      <JourneyFeedCard key={item.id} item={item} />
    ))}
  </div>
);
```

同时将 loading/empty 状态的容器颜色迁移到 token。

- [ ] **Step 4：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/src/app/community/page.tsx apps/web/src/components/community/FeedFilters.tsx
git commit -m "feat(community): upgrade community page with sticky filters, gradient banner, and dual-column feed"
```

---

## Track 4：Tailwind 配置同步

### Task 19：更新 tailwind.config.ts

**Files:**
- Modify: `apps/web/tailwind.config.ts`

**上下文：** 当前 tailwind.config.ts 有自定义 `colors`（ink/pearl/ember/pine/workspace）和 `spacing`（ws6/ws10/ws14）。需确保这些自定义值不与新 token 冲突，并可选地添加引用 CSS 变量的 Tailwind 扩展。

- [ ] **Step 1：保留现有扩展，添加 token 引用（可选）**

在 `theme.extend` 中添加常用 token 到 Tailwind，方便在模板中使用 `bg-accent` 替代 `bg-[var(--accent)]`：

```ts
colors: {
  // 保留现有 ...
  ink: '#121212',
  pearl: '#f7f5f2',
  ember: '#c95f2f',
  pine: '#1f5c4a',
  workspace: { /* ... */ },
  // 新增 token 引用
  accent: {
    DEFAULT: 'var(--accent)',
    hover: 'var(--accent-hover)',
    muted: 'var(--accent-muted)',
    border: 'var(--accent-border)',
    text: 'var(--accent-text)',
  },
},
```

注意：这是可选的便利扩展。所有组件已通过 `var(--xxx)` 任意值引用 token，不依赖此配置。

- [ ] **Step 2：验证 & 提交**

Run: `cd apps/web && npx next build 2>&1 | head -20`

```bash
git add apps/web/tailwind.config.ts
git commit -m "chore(tailwind): add CSS variable references to Tailwind config"
```

---

## 全局验收清单

完成所有 Track 后确认：

- [ ] 两套主题（orange / indigo）全页面切换无破坏
- [ ] 所有升级组件无硬编码颜色值，均引用 CSS 变量
- [ ] 所有图标使用 Lucide，stroke-width: 1.85
- [ ] 信息展示区无 emoji
- [ ] 中文内容无 `text-transform: uppercase`
- [ ] 移动端响应式不回归
- [ ] `docs/design-system/` 文档创建完成（5 个文件 + README）
- [ ] sky-* 颜色 remap 规则保持不变
- [ ] E2E 测试通过：`npx playwright test`

---

## E2E 回归验证

**最后一步：** 在所有 Track 完成后运行 Playwright E2E 测试，确保视觉升级不破坏现有功能流程。

Run: `npx playwright test --reporter=list`

预期：所有现有 E2E 测试（journey-workspace.spec.ts）通过。如有因 selector 变更导致的失败，更新测试中对应的 CSS selector / data-testid。
