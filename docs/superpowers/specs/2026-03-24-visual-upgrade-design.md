# NewCar 视觉升级设计方案

**日期：** 2026-03-24
**版本：** v1.0
**状态：** 已确认，待实现
**作者：** Claude Code (brainstorming session)

---

## 概述

在 Plan 1–10 功能完整上线后，对 NewCar 进行全面视觉升级。升级方向为 **暖系精致 × 明亮工具感**（B+C 融合），面向中国及海外双语用户，支持双主题切换，并建立持久的设计系统文档以保证多次迭代后的视觉一致性。

---

## 一、设计原则

### 1.1 视觉性格
- **暖而有结构**：温暖的色彩基调 + 清晰的信息层次，像"有品位的工具"而非冷冰冰的 SaaS
- **克制的表达**：不靠 emoji 堆砌，用语义化图标（Lucide）和适当插画表达意图；emoji 仅在极少数情感节点使用
- **内容优先**：字体、间距、层级服务于信息，不做纯装饰性视觉

### 1.2 图标规范
- 统一使用 **Lucide** 图标库（项目已引入）
- 全局 `stroke-width: 1.85`，`stroke-linecap: round`，`stroke-linejoin: round`
- 禁止在信息展示中使用 emoji 替代图标；emoji 仅可出现在用户生成内容或极少数情感化节点

### 1.3 国际化
- 所有视觉方案同时考虑中文和英文排版
- 字体方案须同时覆盖 Latin 和 CJK 字符集

---

## 二、设计 Token 体系

### 2.1 主题架构

通过 `html[data-theme]` 属性切换，所有组件仅引用语义化 CSS 变量，主题切换零代码改动。

```css
/* 默认主题无需 data-theme 属性，直接写在 :root */
:root,
[data-theme="orange"] { /* 主题 1：橙暖（默认） */ }
[data-theme="indigo"]  { /* 主题 2：靛蓝极简 */ }
```

用户偏好通过 `localStorage("theme")` 持久化，页面加载时在 `<head>` 内联脚本注入 `data-theme`，避免主题闪烁（FOUC）。

### 2.2 颜色 Token

| Token | 主题 1（橙暖） | 主题 2（靛蓝极简） | 用途 |
|-------|------------|----------------|------|
| `--bg` | `#fff9f4` | `#f8fafc` | 页面底色（纯色 fallback） |
| `--bg-gradient` | 见下方注释 | `none` | body 背景渐变层 |
| `--surface` | `#ffffff` | `#ffffff` | 卡片/面板 |
| `--surface-subtle` | `#fdfaf6` | `#f8fafc` | 次级面板/背景区 |
| `--border` | `#f0e6d8` | `#e2e8f0` | 卡片边框 |
| `--border-soft` | `#e8ddd0` | `#e8edf5` | 分隔线 |
| `--accent` | `#f97316` | `#6366f1` | 主强调色（按钮/高亮） |
| `--accent-hover` | `#ea580c` | `#4f46e5` | 强调色 hover 态 |
| `--accent-muted` | `#fff7ed` | `#eef2ff` | 强调浅底（badge/chip） |
| `--accent-border` | `#fed7aa` | `#c7d2fe` | 强调边框 |
| `--accent-text` | `#c2410c` | `#4338ca` | 强调文字色 |
| `--accent-text-soft` | `#9a3412` | `#3730a3` | 次强调文字 |
| `--text` | `#0f172a` | `#0f172a` | 主文字 |
| `--text-soft` | `#475569` ¹ | `#475569` | 次要文字 |
| `--text-muted` | `#94a3b8` | `#94a3b8` | 占位/辅助文字 |
| `--focus-ring` | `#ea580c` | `#6366f1` | 焦点轮廓 |
| `--focus-glow` | `rgba(249,115,22,0.22)` | `rgba(99,102,241,0.2)` | 焦点发光 |
| `--shadow-card` | `0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(249,115,22,0.05)` | `0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(99,102,241,0.05)` | 卡片阴影 |
| `--shadow-accent` | `0 2px 8px rgba(249,115,22,0.30)` | `0 2px 8px rgba(99,102,241,0.25)` | 强调按钮阴影 |
| `--selection-bg` | `rgba(249,115,22,0.2)` | `rgba(99,102,241,0.15)` | `::selection` 背景 |
| `--selection-color` | `#7c2d12` | `#312e81` | `::selection` 文字 |

> ¹ `--text-soft` 从既有代码的 `#334155`（slate-700）调整为 `#475569`（slate-600），提升可读性。属有意变更。

**`--bg-gradient` 主题 1 的完整 CSS 值：**

```css
/* 主题 1 body background（与现有 globals.css 保持一致） */
--bg-gradient:
  radial-gradient(64rem 44rem at -6% -2%, #ffe4d6 0%, rgba(255,228,214,0) 70%),
  radial-gradient(44rem 34rem at 102% 8%, #ffe9d0 0%, rgba(255,233,208,0) 68%),
  radial-gradient(50rem 40rem at 80% 100%, #daf6ec 0%, rgba(218,246,236,0) 68%);

/* body 实际 background 写法（渐变层叠加在 --bg 之上）：*/
/* background: var(--bg-gradient), var(--bg); */
/* 主题 2 中 --bg-gradient: none，body background 退为 var(--bg) 纯色 */
```

**语义色（两套主题共用）：**

| Token | 值 | 用途 |
|-------|-----|------|
| `--success` | `#22c55e` | 成功/已成交/在线状态点 |
| `--success-muted` | `#f0fdf4` | 成功浅底 |
| `--success-border` | `#bbf7d0` | 成功边框 |
| `--success-text` | `#166534` | 成功文字色 |
| `--warning` | `#f59e0b` | 警告色 |
| `--warning-muted` | `#fffbeb` | 警告浅底 |
| `--warning-border` | `#fde68a` | 警告边框 |
| `--warning-text` | `#92400e` | 警告文字色 |
| `--error` | `#ef4444` | 错误/删除 |
| `--info` | `#3b82f6` | 信息提示 |

### 2.3 字型比例

```css
--text-xs:   0.6875rem;  /* 11px — label, tag */
--text-sm:   0.75rem;    /* 12px — caption, metadata */
--text-base: 0.875rem;   /* 14px — body */
--text-md:   1rem;       /* 16px — body large */
--text-lg:   1.125rem;   /* 18px — section heading */
--text-xl:   1.25rem;    /* 20px — page heading */
--text-2xl:  1.5rem;     /* 24px — hero heading */
--text-3xl:  1.875rem;   /* 30px — display */
--text-4xl:  2.25rem;    /* 36px — hero display */

--leading-tight:  1.2;
--leading-snug:   1.35;
--leading-normal: 1.5;
--leading-relaxed:1.65;

--tracking-tight:  -0.025em;
--tracking-normal:  0;
--tracking-wide:    0.08em;
--tracking-widest:  0.16em;
```

### 2.4 间距与圆角

```css
/* 间距（8pt grid） */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */

/* 圆角 */
--radius-sm:  0.375rem;  /* 6px  — badge, chip, small button */
--radius-md:  0.5625rem; /* 9px  — button, input */
--radius-lg:  0.625rem;  /* 10px — card */
--radius-xl:  0.75rem;   /* 12px — large card, feed card */
--radius-2xl: 1rem;      /* 16px — modal, sheet */
--radius-full: 9999px;   /* pill */
```

### 2.5 阴影层级

非主题化阴影（两套主题共用）：

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 1px 4px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03);
--shadow-md: 0 2px 8px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
```

主题化阴影（`--shadow-card`、`--shadow-accent`）已在 **2.2 颜色 Token** 表格中定义，通过 `data-theme` 覆盖，不在此处重复声明。

---

## 三、字体方案

### 3.1 字体栈

既有代码中的 `--font-heading` **废弃**，统一改用 `--font-display` 作为 Serif 标题 token。`globals.css` 中的 `h1, h2, h3, h4` 全局规则改为引用 `--font-display`。

```css
--font-display: 'Playfair Display', 'Noto Serif SC', Georgia, serif;
/* --font-heading 废弃，原有引用迁移至 --font-display */
--font-body:    'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono:    'IBM Plex Mono', 'Fira Code', monospace;
```

`--surface-strong`（既有代码中存在）**废弃**，以 `--surface` 替代；实现时扫描并替换所有引用。

### 3.2 加载策略

使用 `next/font/google` 加载，`display: swap`，按需子集化：

```ts
// app/fonts.ts
import { Playfair_Display, Inter } from 'next/font/google'

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})
```

中文字体（Noto Serif SC / Noto Sans SC）通过 `@font-face` 按需加载，或直接使用系统字体 `PingFang SC` / `Microsoft YaHei` 作为 fallback，避免中文字体包体积过大。

### 3.3 排版规则

- **页面大标题、卡片标题（Latin）**：`font-family: var(--font-display)`，`font-weight: 700–800`，`letter-spacing: -0.02em`
- **页面大标题、卡片标题（CJK）**：`font-family: var(--font-display)`（回退至 Noto Serif SC / PingFang SC），`letter-spacing: 0`（CJK 字形不适用负字间距，需显式覆盖）
- **正文、标签、说明**：`font-family: var(--font-body)`，`font-weight: 400–600`
- **英文 label（全大写）**：`letter-spacing: 0.12–0.18em`，`font-size: 10–11px`
- **中文 label**：不做 `text-transform: uppercase`，保持正常大小写，`letter-spacing: 0`
- **`--font-mono` 使用场景**：AI 消息中的行内代码片段（`<code>`）、车型编号/VIN、结构化数据视图中的数字字段

---

## 四、主题切换系统

### 4.1 架构

```
html[data-theme="orange"]   ← 默认，由内联脚本在 <head> 注入
html[data-theme="indigo"]   ← 用户切换后写入 localStorage
```

### 4.2 实现文件

| 文件 | 职责 |
|------|------|
| `apps/web/src/app/globals.css` | 所有 CSS 变量定义（两套主题）、`::selection` 规则 |
| `apps/web/src/app/layout.tsx` | `<head>` 内联防闪脚本 |
| `apps/web/src/hooks/useTheme.ts` | React hook，暴露 `theme` 和 `setTheme` |
| `apps/web/src/components/ui/ThemeToggle.tsx` | 主题切换 UI 组件 |

**`useTheme` 类型签名：**

```ts
type Theme = 'orange' | 'indigo'

function useTheme(): {
  theme: Theme
  setTheme: (theme: Theme) => void
}
```

`setTheme` 同时写入 `localStorage` 并更新 `document.documentElement.dataset.theme`，不触发页面重载。

### 4.3 防闪脚本（layout.tsx）

```tsx
<script dangerouslySetInnerHTML={{
  __html: `
    (function() {
      var t = localStorage.getItem('theme') || 'orange';
      document.documentElement.setAttribute('data-theme', t);
    })();
  `
}} />
```

### 4.4 扩展性

新增第三套主题只需在 `globals.css` 添加一个 `[data-theme="xxx"]` 规则块，无需修改任何组件代码。

---

## 五、核心组件升级清单

### 5.1 Button

**变体：** primary / secondary / ghost / danger
**尺寸：** sm (h-8) / md (h-10) / lg (h-11)

```
Primary:   bg-[--accent]，color white，shadow-[--shadow-accent]，hover: bg-[--accent-hover] translate-y-[-1px]
Secondary: bg-white，border-[--border]，color-[--text]，hover: border-[--border-soft]
Ghost:     bg-transparent，color-[--accent]，hover: bg-[--accent-muted]
```

圆角统一 `var(--radius-md)`（9px），字重 `font-weight: 600`，过渡 `transition: all 180ms ease`。

### 5.2 Card / Surface

```
默认卡片: bg-[--surface]，border-[--border]，rounded-[--radius-lg]，shadow-[--shadow-card]
次级面板: bg-[--surface-subtle]，border-[--border-soft]
强调卡片: border-[--accent] border-2（当前最优选项）
```

卡片标题使用 `var(--font-display)`，内部说明文字 `var(--text-soft)`。

### 5.3 Badge / Tag

语义化颜色规则：

| 含义 | 背景 | 文字 | 边框 |
|------|------|------|------|
| 强调/品牌 | `--accent-muted` | `--accent-text` | `--accent-border` |
| 成功/已成交 | `--success-muted` | `--success-text` | `--success-border` |
| 警告/待确认 | `--warning-muted` | `--warning-text` | `--warning-border` |
| 中性/标签 | `#f8fafc` | `--text-soft` | `--border` |

圆角 `var(--radius-sm)`，字号 `var(--text-xs)`，字重 `600`。

### 5.4 ChatBubble

```
用户消息: bg-[--accent]，color white，border-radius: 12px 12px 3px 12px，右对齐，max-width 78%
AI 消息:  bg-[--surface-subtle]，border-[--border]，border-radius: 3px 12px 12px 12px，左对齐，max-width 88%
AI 消息内嵌操作按钮: ghost 样式，紧贴消息底部
```

### 5.5 JourneyFeedCard

结构从上到下：用户信息行（头像 + 姓名 + 天数）→ 成交结果 badge → Serif 大标题 → 摘要文字 → 模板标记（可选）→ 互动数据行（点赞 / 从此出发计数 + 查看链接）。

`从此出发` 链接颜色使用 `--accent`，字重 `500`。

### 5.6 StageProgress

竖向时间线布局：
- 已完成阶段：`bg-[--accent]` 实心圆 + 白色勾号图标
- 当前阶段：`bg-[--accent-muted] border-2 border-[--accent]` 空心圆，文字 `color-[--accent] font-weight:600`
- 未来阶段：`bg-slate-100 border border-slate-200` 空心圆，`opacity: 0.4`
- 连接线：已完成段 `bg-[--accent-border]`，未来段 `bg-slate-200`

### 5.7 Input / Form

```
默认态: border-[--border]，bg-[--surface-subtle]，radius-[--radius-md]
聚焦态: border-[--accent]，bg-[--surface]，box-shadow: 0 0 0 3px var(--focus-glow)
占位符: color-[--text-muted]
```

### 5.8 PageHeader / 页面标题区

```
Label（小标签行）: font-size: var(--text-xs)，text-transform: uppercase，letter-spacing: 0.16em，color-[--accent-text-soft]
标题: font-family: var(--font-display)，font-size: var(--text-2xl)，color-[--text]
说明: font-size: var(--text-base)，color-[--text-soft]
```

### 5.9 IconBadge / IconText

图标容器统一：`rounded-[--radius-sm]`，尺寸 `h-7 w-7`（小）/ `h-9 w-9`（中），内部图标 `h-4 w-4` / `h-5 w-5`。背景色从语义色 token 取值。

### 5.10 ThemeToggle

位置：全局导航栏右侧或设置页面。
样式：图标按钮（`ghost` 变体），点击切换 `data-theme` 并写入 `localStorage`。
无需重载页面，CSS 变量响应式切换。

---

## 六、页面布局升级

### 6.1 首页 Hero

**布局：** 全屏左右分栏（`md:grid-cols-[1fr_1fr]`）

- **左侧：** 双语小标签行 + Serif 大标题（中文 + 英文副标） + 说明文字 + 两个 CTA 按钮（primary + secondary）
- **右侧：** 实时 AI 旅程预览卡（模拟真实用户旅程数据），背景渐变暖色
- **顶部：** 透明粘性导航栏（`backdrop-blur`），含 Logo、社区链接、语言切换、登录按钮
- **底部：** 三特性横栏（路程看板 / AI 对话驱动 / 社区共享），每格含 Lucide 图标

### 6.2 旅程工作台（三栏）

**桌面布局（≥1280px）：**

```css
grid-template-columns: 148px 1fr 1fr;
```

**平板布局（768px–1279px）：**

保持现有实现（两栏），不引入三栏布局：左栏收窄或隐藏（折叠为汉堡菜单），主区与 AI 面板各自占满一列（各 50%），移动端行为保持不变。

**断点说明：** 三栏布局仅在 `≥xl`（1280px）生效，`lg` 及以下保持现有两栏实现，无需额外平板断点规则。

| 栏位 | 内容 | 特点 |
|------|------|------|
| 左栏（148px） | 阶段时间线进度 + 旅程摘要 | 背景略深（`--surface-subtle`），收窄聚焦 |
| 主区（1fr） | 今日洞察卡 + 候选车型评分卡 + 快捷操作栏 | 完全可交互（点击/评分/添加笔记/约试驾） |
| AI 面板（1fr） | 对话历史 + 上下文 chip + 快捷提问 + 输入框 | 等宽设计，对话为主要交互模式 |

**主区交互规范：**
- 候选卡片：内嵌「约试驾」主按钮 + 「添加笔记」次按钮 + 星级评分（可点击）
- 今日洞察卡：右上角内联「存入旅程」/ 「忽略」操作，无需打开对话
- 快捷操作栏（底部）：添加车型、填写需求清单、记录到店时间、标记阶段完成，四个独立操作均可直接触发，不依赖 AI 对话

**AI 面板规范：**
- 顶部上下文 chip：显示当前阶段 + 候选数量，背景 `--accent-muted`
- 快捷提问建议：根据当前阶段动态展示（`--accent-muted` pill 样式）
- 消息内嵌操作：AI 回复底部提供「存入旅程」和「继续追问」按钮

**移动端：** 主区全屏，AI 面板通过 FAB 触发底部 sheet（保持现有实现）

### 6.3 社区广场

- **置顶精选横幅：** 渐变暖色背景，精选旅程标题 + 「从此出发」CTA，无 emoji，仅用图标
- **粘性筛选栏：** `backdrop-blur`，pill 形 filter chips，激活态 `bg-[--accent] color-white`
- **Feed 布局：** 双列卡片流（桌面），单列（移动），卡片标题使用 `var(--font-display)`
- **模板标记：** 含可用模板的旅程显示专属 badge（「含模板」），非 emoji

---

## 七、设计系统文档维护规范

为保证多次迭代后视觉一致性，建立以下持久化规范：

### 7.1 文件结构

```
docs/design-system/
├── README.md          ← 设计系统总览与快速索引
├── tokens.md          ← 所有 CSS 变量定义与用途说明
├── components.md      ← 组件用法、变体、示例代码
├── typography.md      ← 字体规范、字号阶梯、中英文排版规则
├── icons.md           ← 图标使用规范（Lucide 规范 + 禁止 emoji 规则）
└── themes.md          ← 主题扩展指南
```

### 7.2 迭代规范

每次视觉相关改动，开发前必须：
1. 查阅 `docs/design-system/tokens.md`，优先复用已有 token
2. 若需新增 token，先在文档中定义再在代码中使用
3. 新增组件变体后，在 `docs/design-system/components.md` 补充说明
4. 禁止在组件中硬编码颜色值（如 `#f97316`），必须引用 CSS 变量

### 7.3 视觉决策记录

本文档即为视觉决策的主要记录（`docs/superpowers/specs/2026-03-24-visual-upgrade-design.md`）。
后续重大视觉决策以新 spec 文件记录，文件名格式：`YYYY-MM-DD-<topic>-design.md`。

---

## 八、实施方案（方案 C：双轨并行）

按三个轨道推进，有依赖顺序：

**Track 1 — 设计基础（先行）**
- 重写 `globals.css`：完整 token 系统 + 两套主题 + 防闪脚本
- 集成 `next/font`：Playfair Display + Inter
- 实现 `useTheme` hook + `ThemeToggle` 组件
- 创建 `docs/design-system/` 文档体系

**Track 2 — 核心组件（Track 1 完成后）**
- Button、Card、Badge、Input 视觉升级
- ChatBubble、StageProgress、JourneyFeedCard 重做
- PageHeader、IconBadge、ThemeToggle 组件

**Track 3 — 页面布局（Track 2 完成后）**
- 首页 Hero 重构
- 旅程工作台三栏布局（148px / 1fr / 1fr）+ 主区可交互性升级
- 社区广场置顶横幅 + 粘性筛选栏 + 双列 Feed

---

## 九、约束与注意事项

1. **性能**：Playfair Display 仅加载 `latin` subset，中文标题依赖系统 serif fallback（PingFang SC / Noto Serif SC）
2. **无障碍**：所有图标必须有 `aria-label` 或配合可见文字；对比度满足 WCAG AA（4.5:1）
3. **渐进增强**：Token 系统不依赖 JS，CSS 变量为纯 CSS 实现，主题切换 JS 仅用于 localStorage 持久化
4. **向后兼容**：现有 `sky-*` 颜色的全局 remap（已在 globals.css 中实现）保持不变
5. **合规**：中文内容不使用 `text-transform: uppercase`
