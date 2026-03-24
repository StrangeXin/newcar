# 排版规范 — 字体与文字样式

> **字体方案与排版规则是视觉系统的基础。** 所有文字显示必须遵循本文档的规则。

---

## 字体栈定义

### CSS 变量

```css
--font-display: 'Playfair Display', 'Noto Serif SC', Georgia, serif;
--font-body:    'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono:    'IBM Plex Mono', 'Fira Code', monospace;
```

### 字体选择指南

| 变量 | 英文字体 | 中文字体 | 用途 | 示例 |
|------|---------|--------|------|------|
| `--font-display` | Playfair Display（Serif） | Noto Serif SC / PingFang SC | 标题、展示层级 | 页面大标题、卡片标题、hero heading |
| `--font-body` | Inter（Sans-serif） | Noto Sans SC / PingFang SC | 正文、说明、标签 | 段落文字、按钮、表单、metadata |
| `--font-mono` | IBM Plex Mono / Fira Code | 同左 | 代码、数据、编号 | AI 消息中的代码片段、VIN、结构化数据 |

---

## 字体加载策略

### next/font/google 集成

在 `app/fonts.ts` 中配置：

```typescript
import { Playfair_Display, Inter } from 'next/font/google'

export const playfair = Playfair_Display({
  subsets: ['latin'],           // 仅加载 Latin subset，减少包体积
  weight: ['600', '700', '800'], // 仅加载需要的字重
  variable: '--font-display',    // 注入为 CSS 变量
  display: 'swap',               // FOIT 策略：快速显示 fallback
})

export const inter = Inter({
  subsets: ['latin'],           // 仅加载 Latin subset
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})
```

在 `app/layout.tsx` 中应用：

```tsx
<html className={`${playfair.variable} ${inter.variable}`}>
  {/* body 自动继承 --font-body，标题自动继承 --font-display */}
</html>
```

### 中文字体加载

中文字体（Noto Serif SC / Noto Sans SC）通过以下方式处理：

1. **系统字体优先**：使用 `PingFang SC`（macOS）/ `Microsoft YaHei`（Windows）作为 fallback
2. **按需加载**（可选）：若必须使用 Noto 字体，通过 `@font-face` 在 `globals.css` 中定义，并使用 `font-display: swap`
3. **避免阻塞加载**：不应在关键路径上加载中文字体包

### display: swap 策略

`display: swap` 确保页面快速显示：
- 0–100ms：等待自定义字体
- 100ms 后：使用系统 fallback 字体
- 字体下载完成后：无闪烁切换（swap）

---

## 排版规则

### 标题（Heading）

#### Latin 标题（英文居多）

```css
/* 页面大标题、卡片标题等 */
font-family: var(--font-display);
font-weight: 700–800;
letter-spacing: -0.025em;  /* 紧缩，提升视觉压力感 */
line-height: var(--leading-tight);
```

**示例：**
```html
<h1 style="font-family: var(--font-display); font-weight: 700; letter-spacing: -0.025em;">
  Your Journey Starts Here
</h1>
```

#### CJK 标题（中文为主）

```css
/* 中文标题、混合标题 */
font-family: var(--font-display);
font-weight: 700–800;
letter-spacing: 0;  /* CJK 字形不适用负字间距，需显式覆盖 */
line-height: var(--leading-snug);
```

**重要：** CJK 字体在紧缩间距（负 letter-spacing）下可能产生视觉错位，必须设置 `letter-spacing: 0`。

**示例：**
```html
<h2 style="font-family: var(--font-display); font-weight: 700; letter-spacing: 0;">
  你的购车之旅
</h2>
```

### 正文（Body）

```css
font-family: var(--font-body);
font-weight: 400–500;
letter-spacing: 0;
line-height: var(--leading-normal);  /* 1.5 — 适合持续阅读 */
font-size: var(--text-base);         /* 14px 默认 */
color: var(--text);
```

**示例：**
```html
<p>
  AI 会根据你的购车需求，
  提供个性化的车型推荐和实时对话支持。
</p>
```

### 标签与 Label（全大写英文）

```css
/* 英文 label，如 "NEW FEATURE" 、"COMING SOON" */
font-family: var(--font-body);
font-weight: 600;
font-size: var(--text-xs);              /* 11px */
text-transform: uppercase;              /* 转为大写 */
letter-spacing: 0.12–0.18em;            /* 宽松间距 */
color: var(--accent-text-soft);
```

**示例：**
```html
<span style="text-transform: uppercase; letter-spacing: 0.16em;">
  Limited Edition
</span>
```

### 中文标签与说明

```css
/* 中文 label 不使用 text-transform，保持原大小写 */
font-family: var(--font-body);
font-weight: 600;
font-size: var(--text-xs);              /* 11px */
letter-spacing: 0;                      /* 不做字间距调整 */
color: var(--text-soft);
```

**示例：**
```html
<span>已成交</span>
<span>待试驾</span>
```

### 代码与数据（Mono）

```css
/* 行内代码、VIN、结构化数据字段 */
font-family: var(--font-mono);
font-size: var(--text-sm);              /* 12px */
font-weight: 500;
letter-spacing: 0;
color: var(--text-soft);
background: var(--surface-subtle);
padding: 0.25rem 0.5rem;
border-radius: var(--radius-sm);
```

**用途：**
- AI 消息中的代码片段（`<code>` 标签）
- 车型编号、VIN 码
- 数据库字段、API 响应显示

**示例：**
```html
<code>BYD·Song Pro DM-i</code>
<code>VIN: LSGA24E47NC000123</code>
```

---

## 字号阶梯速查

| Token | 大小 | 行高 | 用途 |
|-------|------|------|------|
| `--text-xs` | 11px | 1.2–1.35 | 标签、badge、小字幕 |
| `--text-sm` | 12px | 1.35–1.5 | caption、元数据、次要说明 |
| `--text-base` | 14px | 1.5 | 默认正文、表单输入 |
| `--text-md` | 16px | 1.5–1.65 | 较大正文、段落标题 |
| `--text-lg` | 18px | 1.35 | 分段标题、卡片小标题 |
| `--text-xl` | 20px | 1.35 | 页面副标题 |
| `--text-2xl` | 24px | 1.2 | 卡片标题、小 hero |
| `--text-3xl` | 30px | 1.2 | 展示标题 |
| `--text-4xl` | 36px | 1.2 | 大型 hero 标题 |

---

## 混合语言排版（双语）

### 标题中的中英混排

当标题同时包含中英文时，遵循以下规则：

```html
<!-- 方式 1：分行排版（推荐） -->
<h1 style="font-family: var(--font-display); letter-spacing: -0.025em;">
  <span style="display: block; letter-spacing: 0;">你的购车之旅</span>
  Your Journey Starts Here
</h1>

<!-- 方式 2：同行混排（需谨慎） -->
<h1 style="font-family: var(--font-display);">
  你的购车之旅
  <span style="letter-spacing: -0.025em;">Your Journey</span>
</h1>
```

**原则：**
- 中文部分：`letter-spacing: 0`
- 英文部分：`letter-spacing: -0.025em`
- 避免强制中英文使用相同的字间距

### 段落中的代码片段

若正文中需要嵌入代码或编号，使用 `<code>` 标签并应用 mono 字体：

```html
<p>
  购买 <code>BYD Song Pro</code> 后，
  可使用 VIN <code>LSGA24E47NC000123</code> 查询保修期。
</p>
```

---

## 字重选择指南

| 字重 | Token/CSS | 用途 |
|------|----------|------|
| 400 | `font-weight: 400;` | 正文、说明、轻量级 UI 文字 |
| 500 | `font-weight: 500;` | 次标题、强调正文、mono 代码 |
| 600 | `font-weight: 600;` | 标签、badge、按钮文字、小标题 |
| 700 | `font-weight: 700;` | 卡片标题、页面小标题 |
| 800 | `font-weight: 800;` | 页面大标题、hero heading（仅 Playfair） |

---

## 无障碍排版

### 最小对比度

- **正文 vs 背景**：至少 4.5:1（WCAG AA）
  - `var(--text)` on `var(--surface)` ✓ 符合
  - `var(--text-soft)` on `var(--surface)` ✓ 符合

- **标签色 vs 背景**：至少 3:1（WCAG AA）
  - `var(--accent-text)` on `var(--accent-muted)` ✓ 符合

### 行长与行高

- **最优行长**：45–75 字符（Latin）/ 20–30 字（中文）
- **最小行高**：1.5（正文）；1.2（标题）

### 焦点状态文字

```css
/* 聚焦输入框的占位符应更清晰 */
input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;  /* 提升可见度 */
}

input:focus::placeholder {
  opacity: 0.5;  /* 聚焦时适度降低 */
}
```

---

## 常见排版模式

### 卡片标题 + 说明

```html
<div class="card">
  <h3 style="font-family: var(--font-display); font-size: var(--text-2xl); letter-spacing: 0;">
    BYD Song Pro DM-i
  </h3>
  <p style="font-size: var(--text-sm); color: var(--text-soft); margin-top: 0.5rem;">
    2024 款插电混动 · 5 座 · 工信部续航 800 km
  </p>
</div>
```

### 页面标题区（Label + 标题 + 说明）

```html
<div>
  <span style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.16em; color: var(--accent-text-soft);">
    车型推荐
  </span>
  <h1 style="font-family: var(--font-display); font-size: var(--text-3xl); letter-spacing: 0;">
    为你推荐
  </h1>
  <p style="font-size: var(--text-base); color: var(--text-soft);">
    根据你的需求，我们筛选了以下候选车型。
  </p>
</div>
```

### 数据标签组

```html
<div class="data-row">
  <span style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em;">
    Price
  </span>
  <span style="font-family: var(--font-mono); font-size: var(--text-md); font-weight: 600;">
    ¥238,800
  </span>
</div>
```

---

## 迭代与维护

### 添加新字号

若需新增字号 token，遵循以下规则：

1. **不打破现有阶梯** — 新字号应保持 8px 或 4px 递进
2. **名称对齐** — 使用 `--text-{size}` 命名（如 `--text-sm`, `--text-md`）
3. **同步更新** — 在 `tokens.md` 中的"字型比例"章节添加
4. **记录用途** — 说明新字号的应用场景

### 修改已有排版规则

- 修改前必须在当前 PR 中更新本文档
- 旧规则可标记为"废弃"，但不删除（便于历史查阅）
- 新规则标记为"推荐"（✓）或"默认"

### 禁止硬编码字号

```css
/* ❌ 错误 */
.title { font-size: 24px; }

/* ✅ 正确 */
.title { font-size: var(--text-2xl); }
```

所有字号、行高、字间距、字重必须引用 token 或通过明确的 CSS 变量。
