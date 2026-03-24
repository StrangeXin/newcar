# Token 系统 — CSS 变量与主题定义

> **所有样式必须通过 CSS 变量引用，禁止硬编码颜色值。** 新增 token 前请先在本文档中定义。

---

## 主题架构

通过 `html[data-theme]` 属性切换两套主题，所有组件仅引用语义化 CSS 变量，主题切换零代码改动。

```css
/* 默认主题：无需 data-theme 属性，直接定义在 :root */
:root,
[data-theme="orange"] { /* 主题 1：橙暖（默认） */ }

[data-theme="indigo"]  { /* 主题 2：靛蓝极简 */ }
```

用户偏好通过 `localStorage('theme')` 持久化，页面加载时在 `<head>` 内联脚本注入 `data-theme` 属性，避免主题闪烁（FOUC）。

---

## 颜色 Token

### 2.1 主题化颜色（根据 data-theme 切换）

| Token | 橙暖（主题 1） | 靛蓝（主题 2） | 用途 |
|-------|-----------|-----------|------|
| `--bg` | `#fff9f4` | `#f8fafc` | 页面底色（纯色 fallback） |
| `--bg-gradient` | 见下注 | `none` | body 背景渐变层 |
| `--surface` | `#ffffff` | `#ffffff` | 卡片/面板容器 |
| `--surface-subtle` | `#fdfaf6` | `#f8fafc` | 次级面板/背景区域 |
| `--border` | `#f0e6d8` | `#e2e8f0` | 卡片/输入框边框 |
| `--border-soft` | `#e8ddd0` | `#e8edf5` | 分隔线/次级边框 |
| `--accent` | `#f97316` | `#6366f1` | 主强调色（按钮/高亮） |
| `--accent-hover` | `#ea580c` | `#4f46e5` | 强调色 hover 态 |
| `--accent-muted` | `#fff7ed` | `#eef2ff` | 强调浅底（badge/chip） |
| `--accent-border` | `#fed7aa` | `#c7d2fe` | 强调边框 |
| `--accent-text` | `#c2410c` | `#4338ca` | 强调文字色 |
| `--accent-text-soft` | `#9a3412` | `#3730a3` | 次强调文字 |
| `--text` | `#0f172a` | `#0f172a` | 主正文文字 |
| `--text-soft` | `#475569` | `#475569` | 次要文字/说明 |
| `--text-muted` | `#94a3b8` | `#94a3b8` | 占位符/辅助文字 |
| `--focus-ring` | `#ea580c` | `#6366f1` | 焦点轮廓（input 边框） |
| `--focus-glow` | `rgba(249,115,22,0.22)` | `rgba(99,102,241,0.2)` | 焦点发光（box-shadow） |
| `--shadow-card` | `0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(249,115,22,0.05)` | `0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(99,102,241,0.05)` | 卡片阴影 |
| `--shadow-accent` | `0 2px 8px rgba(249,115,22,0.30)` | `0 2px 8px rgba(99,102,241,0.25)` | 强调按钮阴影 |
| `--selection-bg` | `rgba(249,115,22,0.2)` | `rgba(99,102,241,0.15)` | 文本选中背景 |
| `--selection-color` | `#7c2d12` | `#312e81` | 文本选中文字色 |

#### `--bg-gradient` 详细定义

**主题 1（橙暖）完整 CSS 值：**

```css
--bg-gradient:
  radial-gradient(64rem 44rem at -6% -2%, #ffe4d6 0%, rgba(255,228,214,0) 70%),
  radial-gradient(44rem 34rem at 102% 8%, #ffe9d0 0%, rgba(255,233,208,0) 68%),
  radial-gradient(50rem 40rem at 80% 100%, #daf6ec 0%, rgba(218,246,236,0) 68%);
```

**应用方式：**

```css
body {
  background: var(--bg-gradient), var(--bg);
}
```

**主题 2（靛蓝）：** 使用 `--bg-gradient: none;`，body 背景仅为 `var(--bg)` 纯色。

### 2.2 语义化颜色（两套主题共用）

| Token | 值 | 用途 |
|-------|-----|------|
| `--success` | `#22c55e` | 成功/已成交/在线状态点 |
| `--success-muted` | `#f0fdf4` | 成功浅底 |
| `--success-border` | `#bbf7d0` | 成功边框 |
| `--success-text` | `#166534` | 成功文字 |
| `--warning` | `#f59e0b` | 警告/待确认 |
| `--warning-muted` | `#fffbeb` | 警告浅底 |
| `--warning-border` | `#fde68a` | 警告边框 |
| `--warning-text` | `#92400e` | 警告文字 |
| `--error` | `#ef4444` | 错误/删除状态 |
| `--info` | `#3b82f6` | 信息提示 |

---

## 字型比例（Typography Scale）

```css
--text-xs:   0.6875rem;  /* 11px  — label, tag, caption */
--text-sm:   0.75rem;    /* 12px  — caption, metadata */
--text-base: 0.875rem;   /* 14px  — body, 默认正文 */
--text-md:   1rem;       /* 16px  — body large, 段落标题 */
--text-lg:   1.125rem;   /* 18px  — section heading */
--text-xl:   1.25rem;    /* 20px  — page heading */
--text-2xl:  1.5rem;     /* 24px  — card title, hero heading */
--text-3xl:  1.875rem;   /* 30px  — display heading */
--text-4xl:  2.25rem;    /* 36px  — hero display, 大标题 */

/* 行高 */
--leading-tight:   1.2;    /* 紧凑（标题） */
--leading-snug:    1.35;   /* 略紧（小标题） */
--leading-normal:  1.5;    /* 正常（默认正文） */
--leading-relaxed: 1.65;   /* 宽松（说明文字） */

/* 字间距 */
--tracking-tight:   -0.025em;  /* 紧缩（标题） */
--tracking-normal:   0;         /* 正常 */
--tracking-wide:     0.08em;    /* 宽松 */
--tracking-widest:   0.16em;    /* 最宽（label 大写） */
```

### 字号使用指南

| Token | 场景 |
|-------|------|
| `--text-xs` | 标签、badge、小 caption |
| `--text-sm` | 元数据、时间戳、说明 |
| `--text-base` | 默认正文、表单输入 |
| `--text-md` | 较大正文、段落标题 |
| `--text-lg` | 分段标题、卡片小标题 |
| `--text-xl` | 页面副标题 |
| `--text-2xl` | 卡片标题、模态框标题 |
| `--text-3xl` | 展示标题、hero section |
| `--text-4xl` | 大型 hero 标题 |

---

## 间距与圆角

### 间距（8pt grid）

```css
--space-1:  0.25rem;   /* 4px */
--space-2:  0.5rem;    /* 8px */
--space-3:  0.75rem;   /* 12px */
--space-4:  1rem;      /* 16px — 基础间距 */
--space-5:  1.25rem;   /* 20px */
--space-6:  1.5rem;    /* 24px */
--space-8:  2rem;      /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
```

### 圆角（Border Radius）

```css
--radius-sm:   0.375rem;  /* 6px   — badge, chip, 小按钮 */
--radius-md:   0.5625rem; /* 9px   — button, input, 默认 */
--radius-lg:   0.625rem;  /* 10px  — card, 标准卡片 */
--radius-xl:   0.75rem;   /* 12px  — large card, feed card */
--radius-2xl:  1rem;      /* 16px  — modal, sheet, 大组件 */
--radius-full: 9999px;    /* pill  — 完全圆形 */
```

---

## 阴影层级

### 非主题化阴影（两套主题共用）

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 1px 4px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
--shadow-md: 0 2px 8px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
```

### 主题化阴影

主题化阴影（`--shadow-card`、`--shadow-accent`）已在 **2.1 颜色 Token** 表格中定义，通过 `data-theme` 自动覆盖，无需在此重复。

---

## Token 使用指南

### 颜色选择

| 场景 | 推荐 Token |
|------|-----------|
| 页面背景 | `--bg`（配合 `--bg-gradient`） |
| 卡片/面板 | `--surface` |
| 次级背景区 | `--surface-subtle` |
| 卡片边框 | `--border` |
| 分隔线 | `--border-soft` |
| 主按钮背景 | `--accent` |
| 主按钮 hover | `--accent-hover` |
| Badge/Chip 浅底 | `--accent-muted` |
| Badge/Chip 边框 | `--accent-border` |
| Badge/Chip 文字 | `--accent-text` |
| 正文 | `--text` |
| 次要文字/说明 | `--text-soft` |
| 占位符 | `--text-muted` |
| Input 焦点边框 | `--focus-ring` |
| Input 焦点 shadow | `--focus-glow` |

### 禁止的做法

```css
/* ❌ 错误 — 硬编码颜色值 */
button {
  background: #f97316;
  color: #ffffff;
}

/* ✅ 正确 — 使用 CSS 变量 */
button {
  background: var(--accent);
  color: white;
}
```

---

## 主题切换示例

```html
<!-- 默认渲染 data-theme="orange" -->
<html data-theme="orange">
  <head>
    <style>
      :root, [data-theme="orange"] {
        --accent: #f97316;
        --accent-hover: #ea580c;
        /* ... */
      }
      [data-theme="indigo"] {
        --accent: #6366f1;
        --accent-hover: #4f46e5;
        /* ... */
      }
    </style>
  </head>
  <body>
    <button style="background: var(--accent)">
      <!-- 点击主题切换后，button 背景自动变化，无重载 -->
    </button>
  </body>
</html>
```

---

## 迭代规范

每次视觉更新，遵循以下流程：

1. **查阅本文档** — 优先复用已有 token，确认是否需要新增
2. **定义新 token** — 若无合适 token，先在本文档中按分类添加
3. **更新代码** — 在样式表中引用 CSS 变量，注入 `globals.css`
4. **补充说明** — 在"用途"列注明使用场景，便于日后查阅

禁止在组件代码中硬编码颜色值、字号、间距。所有样式参数必须来自本文档的 token 定义。
