# Walkthrough Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 walkthrough issues (homepage centering, theme icon, journey carousel, button theming, login page theme, mock API, inner page theme) and add i18n infrastructure.

**Architecture:** Client-side i18n using `useSyncExternalStore` + localStorage, mirroring the existing theme hook pattern. A global `FloatingToolbar` in root layout provides theme and language switching on all pages. All hardcoded Tailwind colors replaced with CSS custom properties.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, CSS custom properties, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-25-walkthrough-fixes-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/app/page.tsx` | Hero centering wrapper + replace static preview with JourneyCarousel + remove ThemeToggle from navbar |
| Modify | `apps/web/src/components/ui/ThemeToggle.tsx` | Replace Sun/Moon with half-circle SVG |
| Create | `apps/web/src/components/home/JourneyCarousel.tsx` | Auto-rotating 5-stage journey preview |
| Modify | `apps/web/src/components/community/ForkButton.tsx` | Replace hardcoded orange with CSS vars |
| Modify | `apps/web/src/app/login/page.tsx` | Replace all hardcoded colors with CSS vars |
| Modify | `apps/web/src/components/auth/OtpForm.tsx` | Replace hardcoded colors with CSS vars |
| Modify | `apps/web/src/components/auth/WechatLoginButton.tsx` | Replace hardcoded colors with CSS vars |
| Create | `apps/web/src/components/ui/FloatingToolbar.tsx` | Global theme + locale toggle |
| Modify | `apps/web/src/app/layout.tsx` | Mount FloatingToolbar + merge locale anti-FOUC script |
| Modify | `apps/web/src/lib/api.ts` | Add POST mock routes for auth |
| Modify | `apps/web/src/components/chat/ChatInput.tsx` | Fix bg-white on textarea |
| Create | `apps/web/src/hooks/useLocale.ts` | Locale state hook (localStorage + useSyncExternalStore) |
| Create | `apps/web/src/lib/i18n.ts` | Translation dictionary (zh/en) + getMessages() helper |
| Create | `apps/web/src/hooks/useT.ts` | useT hook — encapsulates useLocale + getMessages for components |
| Modify | `apps/web/src/app/globals.css` | Remove hardcoded sky-* remap overrides (no longer needed after proper theming) |
| Modify | `apps/web/src/app/community/page.tsx` | Apply i18n (no ThemeToggle to remove — confirmed not present) |

---

## Task 1: Mock Login API Fix

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add POST mock routes to `getMockResponse`**

In `api.ts`, update `getMockResponse` to also accept a `method` parameter and add auth routes:

```ts
function getMockResponse<T>(path: string, method: HttpMethod = 'GET'): T | null {
  if (!MOCK_MODE) return null;

  // POST routes
  if (method === 'POST') {
    if (path === '/auth/phone/send-otp') return { message: '验证码已发送', otp: '123456' } as T;
    if (path === '/auth/phone/login') return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' } as T;
    if (path.match(/\/community\/[^/]+\/fork/)) return { id: 'mock-journey-id' } as T;
    return {} as T;
  }

  // existing GET routes...
```

- [ ] **Step 2: Update `post`, `patch`, `del` to use `getMockResponse`**

Replace lines 83-96:

```ts
export async function post<T>(path: string, body?: unknown): Promise<T> {
  const mock = getMockResponse<T>(path, 'POST');
  if (mock !== null) return mock;
  return request<T>(path, 'POST', body);
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const mock = getMockResponse<T>(path, 'PATCH');
  if (mock !== null) return mock;
  return request<T>(path, 'PATCH', body);
}

export async function del<T>(path: string): Promise<T> {
  const mock = getMockResponse<T>(path, 'DELETE');
  if (mock !== null) return mock;
  return request<T>(path, 'DELETE');
}
```

- [ ] **Step 3: Verify in browser**

Run: Open http://localhost:3001/login, enter any phone number and submit. It should show OTP input. Enter `123456` and submit — it should redirect to `/journey`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "fix: add mock POST routes for login auth flow"
```

---

## Task 2: Theme Toggle Icon — Half-Circle SVG

**Files:**
- Modify: `apps/web/src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Replace ThemeToggle implementation**

Replace entire file content with:

```tsx
'use client';

import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'orange' ? 'indigo' : 'orange';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      aria-label={`切换到${next === 'orange' ? '橙暖' : '靛蓝'}主题`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <clipPath id="left-half">
          <rect x="0" y="0" width="10" height="20" />
        </clipPath>
        <clipPath id="right-half">
          <rect x="10" y="0" width="10" height="20" />
        </clipPath>
        <circle cx="10" cy="10" r="8" fill="#f97316" clipPath="url(#left-half)"
          opacity={theme === 'orange' ? 1 : 0.35} className="transition-opacity" />
        <circle cx="10" cy="10" r="8" fill="#6366f1" clipPath="url(#right-half)"
          opacity={theme === 'indigo' ? 1 : 0.35} className="transition-opacity" />
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3001 — the navbar should show a half-orange/half-indigo circle. Click it to toggle themes; the active half should be bright, the other dimmed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/ThemeToggle.tsx
git commit -m "fix: replace Sun/Moon theme icon with half-circle color swatch"
```

---

## Task 3: ForkButton + ChatInput Theme Fix

**Files:**
- Modify: `apps/web/src/components/community/ForkButton.tsx:36`
- Modify: `apps/web/src/components/chat/ChatInput.tsx:53`

- [ ] **Step 1: Fix ForkButton hardcoded colors**

In `ForkButton.tsx` line 36, replace:
```
bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600
```
with:
```
bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]
```

- [ ] **Step 2: Fix ChatInput bg-white**

In `ChatInput.tsx` line 53, replace `bg-white` with `bg-[var(--surface)]`.

- [ ] **Step 3: Verify in browser**

Switch to indigo theme. Visit `/community` — "从此出发" buttons should be indigo, not orange. Visit `/journey` — chat input textarea should use theme surface color.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/community/ForkButton.tsx apps/web/src/components/chat/ChatInput.tsx
git commit -m "fix: replace hardcoded colors in ForkButton and ChatInput with CSS vars"
```

---

## Task 4: Login Page Theme Adaptation

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/components/auth/OtpForm.tsx`
- Modify: `apps/web/src/components/auth/WechatLoginButton.tsx`

- [ ] **Step 1: Replace login page hardcoded colors**

In `login/page.tsx`, apply these replacements:
- `border-slate-200 bg-white/90` → `border-[var(--border)] bg-[var(--surface)]/90`
- `border-slate-200 bg-white p-6` (section) → `border-[var(--border)] bg-[var(--surface)] p-6`
- `text-sky-700` → `text-[var(--accent-text-soft)]`
- `text-slate-900` (h1) → `text-[var(--text)]`
- `text-orange-600` (icons) → `text-[var(--accent)]`
- `text-slate-600` (paragraphs) → `text-[var(--text-soft)]`
- `border-slate-200 bg-slate-50` (right section) → `border-[var(--border)] bg-[var(--surface-subtle)]`
- `text-slate-900` (h2) → `text-[var(--text)]`
- `text-slate-600` (ul) → `text-[var(--text-soft)]`
- `border-slate-200 bg-white` (li items) → `border-[var(--border)] bg-[var(--surface)]`
- `text-emerald-700` → `text-[var(--success-text)]`
- `text-slate-800` (微信快捷登录) → `text-[var(--text)]`

- [ ] **Step 2: Replace OtpForm hardcoded colors**

In `OtpForm.tsx`, apply replacements:
- `text-slate-700` (labels) → `text-[var(--text-soft)]`
- `border-slate-300 bg-white` (inputs) → `border-[var(--border)] bg-[var(--surface)]`
- `ring-sky-300` → `ring-[var(--accent-border)]`
- `bg-slate-900 text-white` (submit buttons) → `bg-[var(--accent)] text-white`
- `text-slate-800` → `text-[var(--text)]`
- `border-slate-400` → `border-[var(--border-soft)]`
- `border-slate-300` → `border-[var(--border)]`
- `bg-amber-50 text-amber-700` (dev hint) → `bg-[var(--warning-muted)] text-[var(--warning-text)]`
- `text-red-600` (error) → `text-[var(--error)]`

- [ ] **Step 3: Replace WechatLoginButton hardcoded colors**

In `WechatLoginButton.tsx` line 9, replace:
```
border-emerald-700/35 bg-emerald-50 text-emerald-900/70
```
with:
```
border-[var(--success-text)]/35 bg-[var(--success-muted)] text-[var(--success-text)]/70
```

- [ ] **Step 4: Remove sky-* remap overrides from globals.css**

In `globals.css`, delete lines 203-235 (the `.text-sky-700`, `.bg-sky-50`, etc. overrides and trailing blank line). These were band-aids for hardcoded sky classes; after this task, all components use CSS variables directly.

- [ ] **Step 5: Verify in browser**

Open http://localhost:3001/login in both orange and indigo themes. All text, borders, backgrounds, and buttons should change color appropriately.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/components/auth/OtpForm.tsx apps/web/src/components/auth/WechatLoginButton.tsx apps/web/src/app/globals.css
git commit -m "fix: replace all hardcoded colors on login page with theme CSS vars"
```

---

## Task 5: i18n Infrastructure

**Files:**
- Create: `apps/web/src/hooks/useLocale.ts`
- Create: `apps/web/src/lib/i18n.ts`

- [ ] **Step 1: Create `useLocale` hook**

Create `apps/web/src/hooks/useLocale.ts`:

```ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'locale';
const DEFAULT_LOCALE: Locale = 'zh';

function getLocaleSnapshot(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return (localStorage.getItem(STORAGE_KEY) as Locale) || DEFAULT_LOCALE;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function subscribe(callback: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) callback();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocaleSnapshot, getServerSnapshot);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-locale', next);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }, []);

  return { locale, setLocale };
}
```

- [ ] **Step 2: Create `i18n.ts` with translation dictionary and `useT` hook**

Create `apps/web/src/lib/i18n.ts`:

```ts
import type { Locale } from '@/hooks/useLocale';

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    // Navbar / global
    'nav.community': '社区',
    'nav.login': '登录',

    // Homepage
    'home.badge': 'NewCar Workspace',
    'home.title': '让购车决策像项目管理一样清晰',
    'home.subtitle': 'Your car buying journey, organized.',
    'home.desc': '从需求澄清、候选筛选到最终成交，把分散的信息变成同一条可追踪的 Journey，减少纠结和决策噪音。',
    'home.cta.start': '开始我的旅程',
    'home.cta.community': '浏览社区',
    'home.preview.title': 'AI Journey Preview',
    'home.feature.kanban.title': '旅程看板',
    'home.feature.kanban.desc': '每个候选车型的证据、风险和结论都在同一处沉淀，团队协同更高效。',
    'home.feature.ai.title': 'AI 对话驱动',
    'home.feature.ai.desc': '用自然语言补全需求、对比车型并生成下一步行动建议，减少信息盲区。',
    'home.feature.review.title': '结果可复盘',
    'home.feature.review.desc': '关键决策路径与依据自动保留，方便回看与沉淀可复用的购车方法论。',

    // Carousel stages
    'carousel.stage.needs': '需求分析',
    'carousel.stage.recommend': '智能推荐',
    'carousel.stage.compare': '对比评测',
    'carousel.stage.testdrive': '试驾预约',
    'carousel.stage.finance': '金融方案',

    // Login page
    'login.badge': 'Authentication',
    'login.title': '登录 NewCar 工作台',
    'login.desc': '使用手机号验证码快速登录。后续会支持微信小程序 OAuth。',
    'login.why.title': '为什么使用 NewCar',
    'login.why.1': '对话即需求，自动沉淀为可执行购车清单。',
    'login.why.2': '候选车型比较过程透明，避免反复横跳。',
    'login.why.3': '关键结论和依据可追踪，便于复盘和协作。',
    'login.wechat': '微信快捷登录',

    // Community page
    'community.title': '社区广场',
    'community.desc': '浏览真实购车历程，并从模板快速开始你的旅程。',
    'community.loading': '加载中...',

    // Auth form
    'auth.phone.label': '手机号',
    'auth.phone.placeholder': '请输入手机号',
    'auth.send_code': '获取验证码',
    'auth.sending': '发送中...',
    'auth.otp.label': '验证码',
    'auth.otp.placeholder': '请输入验证码',
    'auth.login': '登录',
    'auth.logging_in': '登录中...',
    'auth.back': '返回',
    'auth.dev_hint': '开发模式：验证码为 123456',
    'auth.wechat': '微信登录（即将上线）',
  },
  en: {
    // Navbar / global
    'nav.community': 'Community',
    'nav.login': 'Login',

    // Homepage
    'home.badge': 'NewCar Workspace',
    'home.title': 'Make car buying as clear as project management',
    'home.subtitle': 'Your car buying journey, organized.',
    'home.desc': 'From clarifying needs to shortlisting candidates to closing the deal — turn scattered info into one trackable Journey, reducing hesitation and decision noise.',
    'home.cta.start': 'Start My Journey',
    'home.cta.community': 'Browse Community',
    'home.preview.title': 'AI Journey Preview',
    'home.feature.kanban.title': 'Journey Board',
    'home.feature.kanban.desc': 'Evidence, risks, and conclusions for each candidate car — all in one place for efficient team collaboration.',
    'home.feature.ai.title': 'AI-Driven Dialogue',
    'home.feature.ai.desc': 'Use natural language to refine needs, compare models, and generate next-step recommendations.',
    'home.feature.review.title': 'Reviewable Results',
    'home.feature.review.desc': 'Key decision paths and rationale automatically preserved for review and reusable methodology.',

    // Carousel stages
    'carousel.stage.needs': 'Needs Analysis',
    'carousel.stage.recommend': 'Smart Match',
    'carousel.stage.compare': 'Comparison',
    'carousel.stage.testdrive': 'Test Drive',
    'carousel.stage.finance': 'Financing',

    // Login page
    'login.badge': 'Authentication',
    'login.title': 'Sign in to NewCar',
    'login.desc': 'Quick login with phone verification code. WeChat Mini Program OAuth coming soon.',
    'login.why.title': 'Why NewCar',
    'login.why.1': 'Conversations become requirements, auto-organized into actionable checklists.',
    'login.why.2': 'Transparent comparison process — no more going back and forth.',
    'login.why.3': 'Key conclusions and rationale trackable for review and collaboration.',
    'login.wechat': 'WeChat Quick Login',

    // Community page
    'community.title': 'Community',
    'community.desc': 'Browse real car-buying journeys and start yours from a template.',
    'community.loading': 'Loading...',

    // Auth form
    'auth.phone.label': 'Phone Number',
    'auth.phone.placeholder': 'Enter phone number',
    'auth.send_code': 'Send Code',
    'auth.sending': 'Sending...',
    'auth.otp.label': 'Verification Code',
    'auth.otp.placeholder': 'Enter code',
    'auth.login': 'Login',
    'auth.logging_in': 'Logging in...',
    'auth.back': 'Back',
    'auth.dev_hint': 'Dev mode: code is 123456',
    'auth.wechat': 'WeChat Login (Coming Soon)',
  },
};

export function getMessages(locale: Locale): Record<string, string> {
  return messages[locale] || messages.zh;
}
```

- [ ] **Step 3: Create `useT` hook**

Create `apps/web/src/hooks/useT.ts`:

```ts
'use client';

import { useLocale } from './useLocale';
import { getMessages } from '@/lib/i18n';

export function useT() {
  const { locale } = useLocale();
  return getMessages(locale);
}
```

This encapsulates `useLocale` + `getMessages` so components only need `const t = useT()`.

- [ ] **Step 4: Update layout.tsx — merge locale anti-FOUC + mount FloatingToolbar**

In `apps/web/src/app/layout.tsx`, update the inline script to read locale too:

```ts
__html: `(function(){try{var t=localStorage.getItem('theme')||'orange';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('locale')||'zh';document.documentElement.setAttribute('data-locale',l);}catch(e){}})();`
```

(FloatingToolbar mounting is in Task 6)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useLocale.ts apps/web/src/lib/i18n.ts apps/web/src/hooks/useT.ts apps/web/src/app/layout.tsx
git commit -m "feat: add client-side i18n infrastructure (useLocale, useT hooks + translation dict)"
```

---

## Task 6: FloatingToolbar + Remove Navbar ThemeToggle

**Files:**
- Create: `apps/web/src/components/ui/FloatingToolbar.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx` (remove ThemeToggle from navbar)

- [ ] **Step 1: Create FloatingToolbar component**

Create `apps/web/src/components/ui/FloatingToolbar.tsx`:

```tsx
'use client';

import { useLocale } from '@/hooks/useLocale';
import { ThemeToggle } from './ThemeToggle';

export function FloatingToolbar() {
  const { locale, setLocale } = useLocale();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border border-[var(--border)]/60 bg-[var(--surface)]/80 px-1.5 py-1 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <ThemeToggle />
      <div className="h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={() => setLocale(nextLocale)}
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-2 text-[11px] font-semibold text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
        aria-label={`Switch to ${nextLocale === 'zh' ? '中文' : 'English'}`}
      >
        {locale === 'zh' ? 'EN' : '中'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Mount FloatingToolbar in root layout**

In `apps/web/src/app/layout.tsx`, add import and render:

```tsx
import { FloatingToolbar } from '@/components/ui/FloatingToolbar';
```

In the body, add before `{children}`:

```tsx
<body className="antialiased">
  <FloatingToolbar />
  {children}
</body>
```

- [ ] **Step 3: Remove ThemeToggle from homepage navbar**

In `apps/web/src/app/page.tsx`:
- Remove import: `import { ThemeToggle } from '@/components/ui/ThemeToggle';`
- Remove line 17: `<ThemeToggle />`

- [ ] **Step 4: Verify in browser**

Open http://localhost:3001 — floating toolbar should appear in top-right with theme toggle and language button. Navigate to `/login`, `/community`, `/journey` — toolbar should be visible on all pages.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/FloatingToolbar.tsx apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "feat: add global FloatingToolbar with theme and locale toggles"
```

---

## Task 7: Homepage Vertical Centering

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Wrap Hero section in centering div**

In `page.tsx`, wrap the Hero `<section>` (the `grid items-center gap-8 md:grid-cols-2` section) with a centering container. Replace line 24-112:

Before (structure):
```tsx
<main className="mx-auto w-full max-w-6xl px-6 pb-12 pt-20">
  <section className="grid items-center gap-8 md:grid-cols-2">
    ...hero content...
  </section>
  <section className="mt-8 grid gap-4 md:grid-cols-3">
```

After:
```tsx
<main className="mx-auto w-full max-w-6xl px-6 pb-12 pt-20">
  <div className="flex min-h-[calc(100vh-5rem)] items-center">
    <section className="grid w-full items-center gap-8 md:grid-cols-2">
      ...hero content (unchanged)...
    </section>
  </div>
  <section className="mt-8 grid gap-4 md:grid-cols-3">
```

Note: `5rem` matches the `pt-20` padding on `<main>`, ensuring the Hero fills the viewport below the navbar.

- [ ] **Step 2: Verify in browser**

Open http://localhost:3001 — Hero section should be vertically centered in viewport. Feature cards should flow normally below.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "fix: vertically center homepage Hero section in viewport"
```

---

## Task 8: Journey Carousel Component

**Files:**
- Create: `apps/web/src/components/home/JourneyCarousel.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create JourneyCarousel component**

Create `apps/web/src/components/home/JourneyCarousel.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface Stage {
  key: string;
  labelKey: string;
  content: React.ReactNode;
}

type Messages = Record<string, string>;

const INTERVAL = 4000;

const stages: Stage[] = [
  {
    key: 'needs',
    labelKey: 'carousel.stage.needs',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">您好！开始之前，我想了解几个关键问题：</p>
        </div>
        <div className="space-y-1.5">
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">预算范围？</span>
            <span className="ml-2 text-[var(--text-soft)]">20-30万</span>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">主要用途？</span>
            <span className="ml-2 text-[var(--text-soft)]">家用通勤</span>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">动力偏好？</span>
            <span className="ml-2 text-[var(--text-soft)]">增程优先</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'recommend',
    labelKey: 'carousel.stage.recommend',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">根据您「家用、预算25万、增程优先」的需求，为您筛选了3款候选车型：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { name: '理想 L6', spec: '增程 · 五座 · 24.98万起', score: 92 },
            { name: '问界 M7', spec: '增程 · 五座 · 24.98万起', score: 85 },
            { name: '小鹏 G6', spec: '纯电 · 五座 · 20.99万起', score: 78 },
          ].map((car) => (
            <div key={car.name} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold text-[var(--text)]">{car.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{car.spec}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-12 rounded-full bg-[var(--accent-border)]">
                  <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${car.score}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-[var(--accent)]">{car.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'compare',
    labelKey: 'carousel.stage.compare',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">以下是三款车型的核心参数横向对比：</p>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                <th className="px-2 py-1.5 text-left font-medium text-[var(--text-muted)]">参数</th>
                <th className="px-2 py-1.5 text-center font-semibold text-[var(--accent)]">理想 L6</th>
                <th className="px-2 py-1.5 text-center font-medium text-[var(--text)]">问界 M7</th>
                <th className="px-2 py-1.5 text-center font-medium text-[var(--text)]">小鹏 G6</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-soft)]">
              <tr className="border-b border-[var(--border)]">
                <td className="px-2 py-1.5 text-[var(--text-muted)]">纯电续航</td>
                <td className="px-2 py-1.5 text-center">212km</td>
                <td className="px-2 py-1.5 text-center">200km</td>
                <td className="px-2 py-1.5 text-center">580km</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-2 py-1.5 text-[var(--text-muted)]">空间</td>
                <td className="px-2 py-1.5 text-center">★★★★★</td>
                <td className="px-2 py-1.5 text-center">★★★★☆</td>
                <td className="px-2 py-1.5 text-center">★★★★☆</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 text-[var(--text-muted)]">智驾</td>
                <td className="px-2 py-1.5 text-center">AD Max</td>
                <td className="px-2 py-1.5 text-center">ADS 2.0</td>
                <td className="px-2 py-1.5 text-center">XNGP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    key: 'testdrive',
    labelKey: 'carousel.stage.testdrive',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">已为您找到附近3家门店，选择时间即可预约试驾：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { store: '理想汽车 · 望京体验中心', dist: '2.3km', time: '周六 10:00' },
            { store: '理想汽车 · 朝阳大悦城店', dist: '4.1km', time: '周六 14:00' },
            { store: '理想汽车 · 中关村店', dist: '6.8km', time: '周日 10:00' },
          ].map((s) => (
            <div key={s.store} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold text-[var(--text)]">{s.store}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{s.dist}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-text)]">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'finance',
    labelKey: 'carousel.stage.finance',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">理想 L6 的购车金融方案对比：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { plan: '全款购车', price: '24.98万', monthly: '-', total: '24.98万', tag: '最省' },
            { plan: '低首付贷款', price: '首付5万', monthly: '4,280/月', total: '30.4万', tag: '月供低' },
            { plan: '36期免息', price: '首付8.3万', monthly: '4,633/月', total: '24.98万', tag: '推荐' },
          ].map((f) => (
            <div key={f.plan} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[var(--text)]">{f.plan}</p>
                <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--accent-text)]">{f.tag}</span>
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--text-muted)]">
                <span>{f.price}</span>
                {f.monthly !== '-' && <span>月供 {f.monthly}</span>}
                <span>总计 {f.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export function JourneyCarousel({ t }: { t: Messages }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % stages.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <div
      className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-subtle)] p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em] text-[var(--accent-text-soft)]">
          AI Journey Preview
        </p>

        {/* Stage indicators */}
        <div className="mt-3 flex gap-1.5">
          {stages.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              className={`cursor-pointer rounded-full px-2 py-0.5 text-[9px] font-medium transition ${
                i === active
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--accent-muted)] text-[var(--accent-text)] hover:bg-[var(--accent-border)]'
              }`}
            >
              {t[s.labelKey] || s.labelKey}
            </button>
          ))}
        </div>

        {/* Content area with fade transition */}
        <div className="relative mt-3 min-h-[200px]">
          {stages.map((s, i) => (
            <div
              key={s.key}
              className={`transition-opacity duration-500 ${
                i === active ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
              }`}
            >
              {s.content}
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {stages.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${
                i === active ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--accent-border)] hover:bg-[var(--accent)]'
              }`}
              aria-label={t[s.labelKey] || s.labelKey}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace static preview in page.tsx with JourneyCarousel**

In `apps/web/src/app/page.tsx`:

Add import:
```tsx
import { JourneyCarousel } from '@/components/home/JourneyCarousel';
```

Replace the entire static preview block (the outer `<div className="rounded-[var(--radius-xl)]...">` from line 44 to line 111) with:
```tsx
<JourneyCarousel t={t} />
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3001 — the preview should auto-rotate through 5 stages every 4 seconds. Hover to pause. Click stage pills or dots to jump. Theme toggle should change all carousel colors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/JourneyCarousel.tsx apps/web/src/app/page.tsx
git commit -m "feat: add auto-rotating 5-stage journey carousel on homepage"
```

---

## Task 9: Apply i18n to Homepage

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Convert homepage to client component with i18n**

The homepage needs `useT` (client hook), so add `'use client'` directive and import:

```tsx
'use client';

import Link from 'next/link';
import { CarFront, MessageSquareText, Route } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { JourneyCarousel } from '@/components/home/JourneyCarousel';
import { useT } from '@/hooks/useT';
```

At the top of the component function:
```tsx
export default function HomePage() {
  const t = useT();
  return (
```

Then replace all hardcoded Chinese/English strings with `t['key']` references. For example:
- `社区` → `{t['nav.community']}`
- `登录` → `{t['nav.login']}`
- The h1 text → `{t['home.title']}`
- etc.

- [ ] **Step 2: Verify in browser**

Toggle language via FloatingToolbar — all homepage text should switch between Chinese and English.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: apply i18n translations to homepage"
```

---

## Task 10: Apply i18n to Login Page

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/components/auth/OtpForm.tsx`
- Modify: `apps/web/src/components/auth/WechatLoginButton.tsx`

- [ ] **Step 1: Convert login page to client component with i18n**

Add `'use client'` and `import { useT } from '@/hooks/useT'` to `login/page.tsx`. Use `const t = useT()` and replace all hardcoded strings with `t['login.*']` keys.

- [ ] **Step 2: Apply i18n to OtpForm**

Import `useT` in `OtpForm.tsx`. Use `const t = useT()` and replace hardcoded labels/placeholders/button text with `t['auth.*']` keys.

- [ ] **Step 3: Apply i18n to WechatLoginButton**

Import `useT` and use `t['auth.wechat']` for the button label.

- [ ] **Step 4: Verify in browser**

Toggle language on `/login` — all form labels, buttons, and descriptions should switch.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/login/page.tsx apps/web/src/components/auth/OtpForm.tsx apps/web/src/components/auth/WechatLoginButton.tsx
git commit -m "feat: apply i18n translations to login page and auth components"
```

---

## Task 11: Apply i18n to Community Page

**Files:**
- Modify: `apps/web/src/app/community/page.tsx`

- [ ] **Step 1: Add i18n to community page**

Import `useT` from `@/hooks/useT`. Use `const t = useT()` and replace:
- `社区广场` → `t['community.title']`
- The description text → `t['community.desc']`
- `加载中...` → `t['community.loading']`

- [ ] **Step 2: Verify in browser**

Toggle language on `/community` — header title and description should switch.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/community/page.tsx
git commit -m "feat: apply i18n translations to community page"
```

---

## Task 12: Final Verification

- [ ] **Step 1: Full walkthrough in orange theme (zh)**

Visit all pages: `/` → `/login` → `/journey` → `/community`. Verify colors, layout, carousel, and translations.

- [ ] **Step 2: Switch to indigo theme**

Repeat the walkthrough. All accent colors should be indigo. FloatingToolbar visible on every page.

- [ ] **Step 3: Switch to English**

Repeat the walkthrough. All user-facing text on homepage, login, and community pages should be in English.

- [ ] **Step 4: Test login flow**

On `/login`, submit phone number → enter `123456` → should redirect to `/journey`.

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix: final walkthrough adjustments"
```
