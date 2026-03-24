# 主题系统 — 架构与扩展指南

> **主题切换是零 JS 的 CSS 系统。** 新增主题仅需在 `globals.css` 中添加一个 CSS 块，无需改动组件代码。

---

## 主题架构

### 实现原理

NewCar 通过 HTML `data-theme` 属性和 CSS 变量实现主题切换：

```html
<!-- 默认主题（橙暖） -->
<html data-theme="orange">
  <!-- ... -->
</html>

<!-- 用户切换后变为 -->
<html data-theme="indigo">
  <!-- ... -->
</html>
```

所有样式通过 CSS 变量而非直接颜色值定义，不同主题定义不同的变量值：

```css
/* 主题 1：橙暖 */
:root, [data-theme="orange"] {
  --accent: #f97316;
  --accent-hover: #ea580c;
  /* ... */
}

/* 主题 2：靛蓝 */
[data-theme="indigo"] {
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  /* ... */
}
```

### 核心特点

1. **零 JS 样式切换** — 仅修改 `data-theme` 属性，CSS 变量自动响应
2. **持久化存储** — 用户选择保存在 `localStorage('theme')`
3. **防闪烁（FOUC）** — `<head>` 内联脚本在渲染前注入 `data-theme`
4. **完全独立** — 主题切换无需页面重载或组件改动

---

## 文件结构与职责

| 文件 | 职责 | 实现者 |
|------|------|--------|
| `apps/web/src/app/globals.css` | 所有 CSS 变量定义、两套主题值、默认样式 | 开发者 |
| `apps/web/src/app/layout.tsx` | `<head>` 防闪脚本、字体变量注入 | 开发者 |
| `apps/web/src/hooks/useTheme.ts` | React hook，暴露 `theme` 和 `setTheme` | 开发者 |
| `apps/web/src/components/ui/ThemeToggle.tsx` | 主题切换 UI 组件 | 开发者 |
| `docs/design-system/tokens.md` | 所有 token 定义和用途说明 | 设计 / 开发 |

---

## 防闪脚本（Anti-FOUC）

### 问题描述

用户打开页面时，若延迟加载主题脚本，可能出现"主题闪烁"（FOUC — Flash of Unstyled Content）：
1. 页面短暂显示默认样式
2. 然后突然切换到用户选中的主题

### 解决方案

在 `layout.tsx` 的 `<head>` 中添加**内联脚本**，在任何样式加载前执行：

```tsx
// apps/web/src/app/layout.tsx

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 从 localStorage 读取用户偏好，默认为 'orange'
                var theme = localStorage.getItem('theme') || 'orange';
                // 在样式加载前设置 data-theme，避免闪烁
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
```

### 执行时机

- **何时运行**：在 `<head>` 解析完成、`<body>` 开始渲染之前
- **阻塞渲染**：脚本是同步的，确保在任何样式应用前执行
- **性能影响**：极小（<1ms），不影响页面加载速度

---

## useTheme Hook API

### 类型定义

```typescript
type Theme = 'orange' | 'indigo'

interface UseThemeReturn {
  theme: Theme
  setTheme: (theme: Theme) => void
}

function useTheme(): UseThemeReturn
```

### 实现示例

```typescript
// apps/web/src/hooks/useTheme.ts

'use client'

import { useEffect, useState } from 'react'

type Theme = 'orange' | 'indigo'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('orange')
  const [mounted, setMounted] = useState(false)

  // 初始化：从 localStorage 或 data-theme 读取当前主题
  useEffect(() => {
    const htmlElement = document.documentElement
    const currentTheme = (htmlElement.getAttribute('data-theme') || 'orange') as Theme
    setThemeState(currentTheme)
    setMounted(true)
  }, [])

  const setTheme = (newTheme: Theme) => {
    // 更新 DOM
    document.documentElement.setAttribute('data-theme', newTheme)
    // 更新 localStorage
    localStorage.setItem('theme', newTheme)
    // 更新状态
    setThemeState(newTheme)
  }

  return { theme: mounted ? theme : 'orange', setTheme }
}
```

### 使用示例

```tsx
// 任何组件中使用
import { useTheme } from '@/hooks/useTheme'

export function MyComponent() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <p>当前主题：{theme}</p>
      <button onClick={() => setTheme(theme === 'orange' ? 'indigo' : 'orange')}>
        切换主题
      </button>
    </div>
  )
}
```

---

## ThemeToggle 组件

### 功能

提供用户友好的主题切换 UI。

### 样式与位置

- **位置**：全局导航栏右侧或设置页面
- **样式**：ghost 变体按钮（`Button variant="ghost" size="sm"`）
- **图标**：
  - 当前为 `orange` 时显示 🌙（Moon icon）
  - 当前为 `indigo` 时显示 ☀️（Sun icon）

### 实现框架

```tsx
// apps/web/src/components/ui/ThemeToggle.tsx

'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from './Button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'orange' ? 'indigo' : 'orange')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'orange' ? 'indigo' : 'orange'} theme`}
    >
      {theme === 'orange' ? (
        <Moon size={20} />
      ) : (
        <Sun size={20} />
      )}
    </Button>
  )
}
```

### 集成到导航栏

```tsx
// apps/web/src/components/Navbar.tsx

import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function Navbar() {
  return (
    <nav className="flex items-center justify-between">
      <div>Logo</div>
      <div className="flex items-center gap-4">
        <a href="/community">社区</a>
        <ThemeToggle />
        <button>登录</button>
      </div>
    </nav>
  )
}
```

---

## 如何添加第三套主题

### 步骤 1：定义新主题的 CSS 变量

在 `globals.css` 中添加新的 `[data-theme="xxx"]` 块：

```css
/* 现有的两套主题 */
:root,
[data-theme="orange"] {
  --accent: #f97316;
  --accent-hover: #ea580c;
  /* ... 其他变量 ... */
}

[data-theme="indigo"] {
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  /* ... 其他变量 ... */
}

/* 新增第三套主题：绿色自然 */
[data-theme="green"] {
  --bg: #f0fdf4;                    /* 绿色浅底 */
  --bg-gradient: none;
  --surface: #ffffff;
  --surface-subtle: #f7fee7;
  --border: #d1e7dd;
  --border-soft: #d1e7dd;
  --accent: #16a34a;                /* 绿色强调 */
  --accent-hover: #15803d;
  --accent-muted: #f0fdf4;
  --accent-border: #c6e48b;
  --accent-text: #15803d;
  --accent-text-soft: #22c55e;
  /* ... 继续填充其他变量 ... */
}
```

### 步骤 2：更新 Theme 类型定义

```typescript
// apps/web/src/hooks/useTheme.ts

type Theme = 'orange' | 'indigo' | 'green'  // 新增 'green'
```

### 步骤 3：更新 ThemeToggle（可选）

若新主题需要新的图标或切换逻辑，更新 `ThemeToggle.tsx`：

```tsx
const themeIcons = {
  orange: <Sun size={20} />,
  indigo: <Moon size={20} />,
  green: <Leaf size={20} />,
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes: Theme[] = ['orange', 'indigo', 'green']
  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length]

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
    >
      {themeIcons[theme]}
    </Button>
  )
}
```

### 步骤 4：更新文档

在本文件中补充新主题的说明（设计哲学、色彩来源等）。

### 就这样！

无需修改任何组件代码，新主题会自动在整个应用中生效。

---

## CSS 变量的作用域

### 继承规则

CSS 变量定义在 `[data-theme]` 上，所有子元素自动继承：

```html
<html data-theme="indigo">
  <body>
    <header>
      <!-- 自动继承 --indigo 主题的所有变量 -->
      <button style="background: var(--accent);">
        <!-- 使用靛蓝的强调色 -->
      </button>
    </header>
  </body>
</html>
```

### 局部覆盖（不推荐）

若需在特定元素中临时覆盖主题，可使用内联样式（极少见）：

```html
<!-- ❌ 不推荐 — 避免硬编码值 -->
<div style="--accent: #ff0000; background: var(--accent);">
  特殊色块
</div>

<!-- ✅ 推荐 — 如必须，在 CSS 中定义 -->
<style>
  .special-block {
    --accent: var(--warning);  /* 使用另一个语义色 */
  }
</style>
```

---

## 深色模式检测（可选）

若要根据系统偏好自动切换主题，可在防闪脚本中添加检测逻辑：

```typescript
// apps/web/src/app/layout.tsx

<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        var stored = localStorage.getItem('theme');
        if (stored) {
          document.documentElement.setAttribute('data-theme', stored);
        } else {
          // 检测系统深色模式偏好
          var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var theme = isDark ? 'indigo' : 'orange';
          document.documentElement.setAttribute('data-theme', theme);
        }
      })();
    `,
  }}
/>
```

---

## 性能考虑

### CSS 变量的性能

- **加载时间**：无影响（CSS 变量在渲染时处理）
- **内存占用**：极小（仅存储几十个变量）
- **运行时性能**：变量查询极快，无动画卡顿

### 优化建议

1. **避免过多变量** — 只定义必要的 token，不要为每个颜色定义变量
2. **避免嵌套变量引用** — `var(--color-a) = var(--color-b)` 可接受，但避免链式引用
3. **预加载主题 CSS** — 无需单独加载，全部在 `globals.css` 中

---

## 测试主题切换

### 手动测试清单

- [ ] 打开页面时，显示默认主题（orange）
- [ ] 点击 ThemeToggle，主题立即切换
- [ ] 刷新页面，显示上次选中的主题（从 localStorage 恢复）
- [ ] 清除 localStorage 后刷新，回到默认主题
- [ ] 所有组件颜色正确响应主题变化
- [ ] 焦点状态、hover 状态在两个主题下都可见
- [ ] 移动设备上测试（响应式）

### 自动化测试示例

```typescript
// __tests__/useTheme.test.ts

import { renderHook, act } from '@testing-library/react'
import { useTheme } from '@/hooks/useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('should initialize with default theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('orange')
  })

  it('should switch theme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('indigo')
    })

    expect(result.current.theme).toBe('indigo')
    expect(document.documentElement.getAttribute('data-theme')).toBe('indigo')
    expect(localStorage.getItem('theme')).toBe('indigo')
  })

  it('should restore theme from localStorage', () => {
    localStorage.setItem('theme', 'indigo')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('indigo')
  })
})
```

---

## 常见问题

### Q: 如何在 SSR 中处理主题？

**A:** 主题通过 `data-theme` 属性在 HTML 元素上设置，不涉及组件状态。防闪脚本在 `<head>` 中同步执行，确保 hydration 前主题已确定。

```tsx
// 无需特殊处理，防闪脚本自动解决
```

### Q: 能否根据时间自动切换主题？

**A:** 可以，在 `useTheme` hook 中添加 `useEffect`：

```typescript
useEffect(() => {
  const hour = new Date().getHours()
  const autoTheme = hour >= 18 ? 'indigo' : 'orange'
  setTheme(autoTheme)
}, [])
```

### Q: 新增主题后，需要修改组件代码吗？

**A:** 不需要。所有组件通过 CSS 变量引用颜色，无需改动。仅需在 `globals.css` 中添加新主题的变量定义。

### Q: 能否混合使用多套主题（如部分页面用不同主题）？

**A:** 可以，但不推荐。若必须，可在特定容器元素上设置 `data-theme`：

```html
<div data-theme="indigo">
  <!-- 该容器及其子元素使用靛蓝主题 -->
</div>
```

### Q: 主题变量如何处理透明度？

**A:** 使用 `rgba()` 函数，变量值包含完整的 RGBA：

```css
--focus-glow: rgba(249,115,22,0.22);  /* 包含透明度 */
```

在组件中直接使用：

```css
box-shadow: 0 0 0 3px var(--focus-glow);  /* 自动应用透明度 */
```

---

## 迭代与维护

### 添加新主题时的检查清单

- [ ] 定义所有必要的 CSS 变量（至少 40+ 个）
- [ ] 测试所有组件在新主题下的外观
- [ ] 确保对比度符合 WCAG AA
- [ ] 在 `useTheme` 类型中添加新的 Theme 值
- [ ] 更新本文档的主题列表
- [ ] 更新 ThemeToggle 的图标/逻辑（如需）
- [ ] 运行无障碍检查工具（axe DevTools）
- [ ] 在移动设备上测试

### 修改现有主题时

- 只修改 `[data-theme="xxx"]` 块内的变量值
- 不修改变量名称（保持向后兼容）
- 在 PR 中说明颜色变更的原因
- 更新 `tokens.md` 中的颜色表格
- 进行完整的视觉回归测试

---

## 相关文档

- [tokens.md](./tokens.md) — 完整的 token 定义和对比
- [components.md](./components.md) — 组件如何使用主题 token
- [2026-03-24 视觉升级方案](../superpowers/specs/2026-03-24-visual-upgrade-design.md) — 主题设计背景
