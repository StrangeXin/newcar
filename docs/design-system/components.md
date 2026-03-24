# 组件规范 — 核心 UI 组件

> **本文档列出所有核心组件的变体、尺寸、样式规则。** 代码示例将在 Track 2 实现后补充。

---

## 总览

| 组件 | 变体 | 尺寸 | 状态 |
|------|------|------|------|
| Button | primary / secondary / ghost / danger | sm / md / lg | default / hover / active / disabled |
| Card / Surface | default / subtle / accent | — | — |
| Badge / Tag | default / success / warning / error / info | — | — |
| ChatBubble | user / ai | — | — |
| JourneyFeedCard | — | — | — |
| StageProgress | — | — | completed / active / pending |
| Input / Form | text / select / textarea | sm / md / lg | default / focus / error / disabled |
| PageHeader | — | — | — |
| IconBadge / IconText | — | sm / md | — |
| ThemeToggle | — | — | — |

---

## Button — 按钮

### 变体与样式

#### Primary（主按钮）

**用途**：主要操作（提交、确认、立即购买）

```
背景：var(--accent)
文字色：white
字重：600
圆角：var(--radius-md)
过渡：all 180ms ease
阴影：var(--shadow-accent)

Hover：
  背景：var(--accent-hover)
  transform: translateY(-1px)
  阴影：加强

Active：
  背景：var(--accent-hover)
  transform: translateY(0)
```

#### Secondary（次按钮）

**用途**：次要操作（取消、保存、更多）

```
背景：white
边框：1px solid var(--border)
文字色：var(--text)
字重：600
圆角：var(--radius-md)

Hover：
  背景：var(--surface-subtle)
  边框：1px solid var(--border-soft)

Active：
  背景：var(--surface)
  边框：1px solid var(--border)
```

#### Ghost（幽灵按钮）

**用途**：链接类操作（返回、跳转、更多操作）

```
背景：transparent
文字色：var(--accent)
字重：500

Hover：
  背景：var(--accent-muted)
  圆角：var(--radius-md)

Active：
  背景：var(--accent-muted)
  opacity：0.8
```

#### Danger（危险按钮）

**用途**：删除、重置、不可逆操作

```
背景：var(--error)
文字色：white
字重：600
圆角：var(--radius-md)
阴影：var(--shadow-accent)（使用 error 色变量）

Hover：
  背景：darken(var(--error), 10%)
  transform: translateY(-1px)
```

### 尺寸

| 尺寸 | 高度 | 内边距 | 字号 | 用途 |
|------|------|--------|------|------|
| sm | 32px (h-8) | px-3 py-1 | `--text-xs` | 小操作、tag action |
| md | 40px (h-10) | px-4 py-2 | `--text-base` | 标准按钮（默认） |
| lg | 44px (h-11) | px-5 py-3 | `--text-md` | 大操作、CTA |

### 禁用状态

```
opacity: 0.5
cursor: not-allowed
pointer-events: none
```

---

## Card / Surface — 卡片

### 变体

#### Default（标准卡片）

```
背景：var(--surface)
边框：1px solid var(--border)
圆角：var(--radius-lg)
阴影：var(--shadow-card)
内边距：1.5rem (var(--space-6))
```

**用途**：数据展示卡片、候选车型卡片、旅程卡片

#### Subtle（次级面板）

```
背景：var(--surface-subtle)
边框：1px solid var(--border-soft)
圆角：var(--radius-lg)
阴影：none
内边距：1.5rem (var(--space-6))
```

**用途**：背景区域、分组容器、信息组

#### Accent（强调卡片）

```
背景：var(--surface)
边框：2px solid var(--accent)
圆角：var(--radius-lg)
阴影：var(--shadow-card)
内边距：1.5rem (var(--space-6))
```

**用途**：推荐卡片、当前选中、关键操作

### 内部元素

#### 卡片标题

```
font-family：var(--font-display)
font-size：var(--text-2xl)
font-weight：700
color：var(--text)
letter-spacing：0（CJK）或 -0.025em（Latin）
margin-bottom：0.75rem (var(--space-3))
```

#### 卡片说明

```
font-size：var(--text-sm)
color：var(--text-soft)
line-height：var(--leading-relaxed)
```

---

## Badge / Tag — 标签

### 语义颜色规则

#### 强调 / 品牌

```
背景：var(--accent-muted)
文字：var(--accent-text)
边框：1px solid var(--accent-border)
```

**用途**：品牌标记、推荐、新功能

#### 成功 / 已成交

```
背景：var(--success-muted)
文字：var(--success-text)
边框：1px solid var(--success-border)
```

**用途**：已成交、完成状态、在线标记

#### 警告 / 待确认

```
背景：var(--warning-muted)
文字：var(--warning-text)
边框：1px solid var(--warning-border)
```

**用途**：待确认、待处理、警告提示

#### 中性 / 标签

```
背景：#f8fafc
文字：var(--text-soft)
边框：1px solid var(--border)
```

**用途**：分类标签、普通 tag

### 共通样式

```
字号：var(--text-xs)
字重：600
圆角：var(--radius-sm)
内边距：px-2.5 py-1
```

---

## ChatBubble — 聊天气泡

### 用户消息

```
背景：var(--accent)
文字色：white
圆角：12px 12px 3px 12px（右上左下）
对齐：right
最大宽度：78%
内边距：px-4 py-2
font-size：var(--text-base)
```

### AI 消息

```
背景：var(--surface-subtle)
边框：1px solid var(--border)
文字色：var(--text)
圆角：3px 12px 12px 12px（左上右下）
对齐：left
最大宽度：88%
内边距：px-4 py-2
font-size：var(--text-base)
```

### 操作按钮

```
位置：消息底部
样式：ghost 变体
尺寸：sm
间距：margin-top 0.5rem (var(--space-2))
常见操作：
  - 存入旅程
  - 继续追问
  - 复制
  - 分享
```

---

## JourneyFeedCard — 旅程卡片

### 结构与样式

**从上到下分层：**

1. **用户信息行**
   - 头像：h-10 w-10 (40px)，圆角：var(--radius-full)
   - 姓名：font-weight 600，color var(--text)
   - 天数：color var(--text-muted)，font-size var(--text-sm)

2. **成交结果 Badge**
   - 语义色：success / warning / info
   - 间距：margin-top 0.75rem (var(--space-3))

3. **Serif 大标题**
   - font-family：var(--font-display)
   - font-size：var(--text-2xl)
   - font-weight：700
   - color：var(--text)
   - letter-spacing：0（CJK）
   - margin-top：1rem (var(--space-4))

4. **摘要文字**
   - font-size：var(--text-base)
   - color：var(--text-soft)
   - line-height：var(--leading-normal)
   - margin-top：0.5rem (var(--space-2))
   - max-height：3em（截断过长文字）

5. **模板标记**（可选）
   - 样式：badge，语义色为 info
   - 文字：「含模板」/ 「可用模板」
   - margin-top：0.75rem

6. **互动数据行**
   - 点赞数：icon + 数字
   - 从此出发数：icon + 数字 + CTA 链接
   - 链接颜色：var(--accent)，font-weight 500
   - 文字色：var(--text-soft)

### 卡片容器

```
background：var(--surface)
border：1px solid var(--border)
border-radius：var(--radius-xl)
padding：1.5rem (var(--space-6))
box-shadow：var(--shadow-card)
```

---

## StageProgress — 阶段进度

### 竖向时间线布局

#### 已完成阶段

```
圆圈：实心，背景 var(--accent)，直径 32px
勾号：white，stroke-width 2.5
线段：下方连接线，bg-[--accent-border]，高度 24px
```

#### 当前阶段

```
圆圈：空心，背景 var(--accent-muted)，边框 2px var(--accent)
标签：color var(--accent)，font-weight 600，font-size var(--text-base)
线段：下方连接线，bg-slate-200，高度 24px
```

#### 未来阶段

```
圆圈：空心，背景 #f1f5f9，边框 1px #cbd5e1
标签：color var(--text-soft)，opacity 0.4，font-size var(--text-sm)
线段：下方连接线，bg-slate-200，opacity 0.4
```

### 共通属性

```
整体 padding：var(--space-4) 0（阶段间距）
圆圈直径：32px
线段宽度：2px
font-family：var(--font-body)
```

---

## Input / Form — 输入框与表单

### 默认状态

```
背景：var(--surface-subtle)
边框：1px solid var(--border)
圆角：var(--radius-md)
padding：px-3 py-2
font-size：var(--text-base)
color：var(--text)
```

### 聚焦状态

```
背景：var(--surface)
边框：2px solid var(--focus-ring)
box-shadow：0 0 0 3px var(--focus-glow)
outline：none
```

### 错误状态

```
边框：2px solid var(--error)
box-shadow：0 0 0 3px rgba(239, 68, 68, 0.1)
```

### 禁用状态

```
背景：var(--surface-subtle)
color：var(--text-muted)
cursor：not-allowed
opacity：0.6
```

### 占位符

```
color：var(--text-muted)
font-size：var(--text-base)
```

### 尺寸

| 尺寸 | 高度 | 内边距 | 字号 |
|------|------|--------|------|
| sm | 32px | px-2.5 py-1.5 | `--text-sm` |
| md | 40px | px-3 py-2 | `--text-base` |
| lg | 48px | px-4 py-3 | `--text-md` |

---

## PageHeader — 页面标题区

### 结构

```
Label（可选小标签行）
├─ font-size：var(--text-xs)
├─ text-transform：uppercase
├─ letter-spacing：0.16em
└─ color：var(--accent-text-soft)

标题（主标题）
├─ font-family：var(--font-display)
├─ font-size：var(--text-3xl)
├─ font-weight：700
├─ color：var(--text)
└─ letter-spacing：0（CJK）

说明（副标题 / 描述）
├─ font-size：var(--text-base)
├─ color：var(--text-soft)
└─ line-height：var(--leading-relaxed)
```

### 间距

```
label 和标题间距：0.5rem (var(--space-2))
标题和说明间距：0.75rem (var(--space-3))
```

---

## IconBadge / IconText — 图标徽章

### 尺寸规范

#### Small（小）

```
容器：h-7 w-7 (28px)，rounded-[--radius-sm]
内部图标：h-4 w-4 (16px)
```

#### Medium（中）

```
容器：h-9 w-9 (36px)，rounded-[--radius-sm]
内部图标：h-5 w-5 (20px)
```

### 背景色规则

根据语义选择背景：

```
强调：background var(--accent-muted)，icon color var(--accent)
成功：background var(--success-muted)，icon color var(--success)
警告：background var(--warning-muted)，icon color var(--warning)
错误：background rgba(239, 68, 68, 0.1)，icon color var(--error)
中性：background var(--surface-subtle)，icon color var(--text-soft)
```

### 文字配对

若与文字并排显示：

```
布局：flex gap-2 items-center
文字：font-size var(--text-base)，color 继承
```

---

## ThemeToggle — 主题切换

### 样式与位置

```
样式：ghost 变体按钮，size sm
位置：全局导航栏右侧或设置页面
图标：Moon + Sun（取决于当前主题）
```

### 交互

```
点击：
  1. 切换 data-theme 属性
  2. 更新 localStorage('theme')
  3. CSS 变量自动响应，无页面重载

快捷键（可选）：Cmd/Ctrl + Shift + L
```

### 动画（可选）

```
图标切换：rotate 180deg
过渡：all 200ms ease
```

---

## 新增组件的流程

### 创建新组件时

1. **命名规范**
   - 大驼峰法则：`MyComponent`
   - 文件名：`MyComponent.tsx`
   - 导出默认组件

2. **Token 优先**
   - 所有颜色、间距、圆角、阴影来自 `tokens.md`
   - 不允许硬编码值

3. **变体与尺寸**
   - 在本文档中列举所有变体和尺寸
   - 记录样式规则和使用场景

4. **无障碍**
   - 图标必须有 `aria-label`
   - 按钮需要合适的 `role` 和文字
   - 对比度需满足 WCAG AA

5. **响应式**
   - 考虑移动端显示
   - 使用 Tailwind 断点（`sm:`, `md:`, `lg:`）

### 代码示例补充

**注意**：详细代码实现示例将在 Track 2 完成后补充到本文档中。当前版本作为 API 参考，Track 2 完成后将添加完整的 TypeScript 和 JSX 示例。

---

## 禁止的做法

- ❌ 硬编码颜色值（如 `#f97316`）
- ❌ 硬编码间距（如 `padding: 16px`）
- ❌ 未记录的样式变体
- ❌ 未定义 `aria-label` 的图标
- ❌ 混合使用多套颜色规范

## 必须的做法

- ✅ 引用 token 定义（`var(--accent)` 等）
- ✅ 在文档中记录变体和尺寸
- ✅ 为组件提供无障碍标签
- ✅ 支持深色主题（自动，无需特殊处理）
- ✅ 测试响应式布局

---

## 参考文档

- 颜色与 Token：[tokens.md](./tokens.md)
- 排版规范：[typography.md](./typography.md)
- 图标规范：[icons.md](./icons.md)
- 主题系统：[themes.md](./themes.md)
