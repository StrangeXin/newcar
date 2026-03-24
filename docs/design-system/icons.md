# 图标规范 — Lucide 与视觉语言

> **所有信息图标必须使用 Lucide。** Emoji 禁用于信息展示，仅允许在用户生成内容或极少数情感节点。

---

## 图标库与工具

### 唯一图标库：Lucide

- **库名**：Lucide (https://lucide.dev)
- **包名**：`lucide-react`（已在项目中安装）
- **覆盖范围**：500+ 开源图标，持续维护

### 为什么选择 Lucide

1. **一致性高**：所有图标基于统一的视觉规范设计
2. **笔触细腻**：1.85 的笔触宽度适合 B2C 应用
3. **可定制性强**：支持 CSS 变量和 SVG 属性覆盖
4. **开源且活跃**：社区支持好，文档完善
5. **国际化友好**：符号通用，无歧义

---

## 全局笔触规范

所有 Lucide 图标必须遵循以下属性：

```tsx
import { Icon } from 'lucide-react'

// 全局设置方式 1：组件层级
<Icon
  size={24}
  strokeWidth={1.85}      // 全局笔触宽度
  strokeLinecap="round"   // 笔端圆形
  strokeLinejoin="round"  // 拐点圆形
  aria-label="功能描述"   // 无障碍标签
/>

// 全局设置方式 2：CSS 变量（推荐）
/* globals.css */
:root {
  --lucide-stroke-width: 1.85;
  --lucide-stroke-linecap: round;
  --lucide-stroke-linejoin: round;
}

/* 在每个使用 Lucide 的组件中应用 */
.icon {
  stroke-width: var(--lucide-stroke-width);
  stroke-linecap: var(--lucide-stroke-linecap);
  stroke-linejoin: var(--lucide-stroke-linejoin);
}
```

### 为什么是 stroke-width: 1.85?

- **1.5**：过细，在移动设备上难以辨认
- **1.85**（推荐）：视觉均衡，适合 14–24px 图标尺寸
- **2.0+**：过粗，显得呆板

---

## 图标尺寸规范

### 尺寸阶梯

| 尺寸 | 像素 | 场景 | 笔触 |
|------|------|------|------|
| xs | 16px | label、tag、超小 UI 元素 | 1.85 |
| sm | 20px | 表单 icon、小按钮、导航 icon | 1.85 |
| md | 24px | 标准按钮、卡片 icon、默认 | 1.85 |
| lg | 32px | 大按钮、hero icon | 1.85 |
| xl | 40px | 页面装饰、大展示 | 1.85 |

### CSS 变量定义

```css
/* icons.css 或 globals.css */
--icon-xs: 16px;
--icon-sm: 20px;
--icon-md: 24px;
--icon-lg: 32px;
--icon-xl: 40px;
```

### 使用示例

```tsx
// 表单输入框 icon
<Calendar size={16} className="icon-xs" />

// 按钮 icon
<Plus size={20} className="icon-sm" />

// 卡片标题 icon
<MessageCircle size={24} className="icon-md" />

// 大型操作 icon
<Heart size={32} className="icon-lg" />
```

---

## 常见图标清单

### 导航与结构

| 图标 | Lucide 名称 | 用途 |
|------|-----------|------|
| 🏠 | Home | 首页导航 |
| 📋 | ClipboardList | 工作台列表 |
| 💬 | MessageCircle | 对话/消息 |
| 👥 | Users | 社区/群组 |
| ⚙️ | Settings | 设置 |
| 📱 | Menu | 菜单/导航 |

### 操作与状态

| 图标 | Lucide 名称 | 用途 |
|------|-----------|------|
| ➕ | Plus | 添加/新建 |
| ❌ | X | 关闭/删除 |
| ✓ | Check | 完成/确认 |
| ↑ | ChevronUp | 展开/上 |
| ↓ | ChevronDown | 收起/下 |
| 🔍 | Search | 搜索 |
| ⟳ | RotateCw | 刷新/重试 |

### 语义与状态

| 图标 | Lucide 名称 | 用途 |
|------|-----------|------|
| ✓ | CheckCircle | 成功/已完成 |
| ⚠️ | AlertCircle | 警告/待确认 |
| ❌ | XCircle | 错误/失败 |
| ℹ️ | Info | 信息/提示 |
| 💡 | Lightbulb | 建议/提示 |

### 内容标记

| 图标 | Lucide 名称 | 用途 |
|------|-----------|------|
| ❤️ | Heart | 点赞/收藏 |
| ⭐ | Star | 评分/重要 |
| 🔗 | Link | 链接/分享 |
| 📤 | Share2 | 分享/导出 |
| 🏷️ | Tag | 标签 |

### 业务特定

| 图标 | Lucide 名称 | 用途 |
|------|-----------|------|
| 🚗 | Car | 车型 |
| 📅 | Calendar | 日期/日程 |
| 💰 | DollarSign | 价格/费用 |
| 📊 | BarChart3 | 数据/统计 |
| 📍 | MapPin | 位置/经销商 |

> 更多图标：访问 https://lucide.dev 搜索完整库

---

## 颜色与语境

### 色彩应用

图标颜色遵循 token 系统：

```tsx
import { Heart } from 'lucide-react'

// 强调色（主操作）
<Heart size={24} className="text-[--accent]" />

// 成功色（完成状态）
<CheckCircle size={24} className="text-[--success]" />

// 警告色（待确认）
<AlertCircle size={24} className="text-[--warning]" />

// 错误色（删除/失败）
<XCircle size={24} className="text-[--error]" />

// 中性色（默认）
<MessageCircle size={24} className="text-[--text-soft]" />
```

### 深色主题适应

Lucide 图标自动继承 `color` 属性，无需特殊处理：

```css
/* globals.css */
[data-theme="indigo"] .icon {
  color: var(--text);  /* 自动响应主题切换 */
}
```

---

## 无障碍标签（aria-label）

### 强制规则

**所有图标必须满足以下条件之一：**

1. **有 `aria-label` 属性** — 描述图标含义
2. **相邻有可见文字** — 文字描述图标功能
3. **在 `<button>` 或 `<a>` 内** — 继承父元素的 `aria-label` 或文字内容

### 示例

```tsx
// ✅ 正确 — 有 aria-label
<Heart
  size={20}
  aria-label="Add to favorites"
  className="cursor-pointer"
/>

// ✅ 正确 — 与文字配对
<button>
  <Plus size={20} />
  <span>添加车型</span>
</button>

// ✅ 正确 — 按钮标签继承
<button aria-label="Close dialog">
  <X size={20} />
</button>

// ❌ 错误 — 无标签、无文字
<Heart size={20} className="cursor-pointer" />
```

---

## Emoji 使用规范

### 绝对禁止

Emoji 禁止在以下场景使用：

1. **信息展示** — 禁用 emoji 替代图标（如 `❌` 代替 error icon）
2. **标签/badge** — 禁用 emoji（如 `🏆 精选` 而非 Star icon + "精选"）
3. **按钮** — 禁用 emoji（如 `👍 点赞` 应为 Heart icon + "点赞"）
4. **数据字段** — 禁用 emoji（如 `⭐⭐⭐⭐⭐` 应为星级评分组件）

### 严格限制

Emoji 仅允许在以下极少数场景：

1. **用户生成内容** — 用户自行输入的评论、消息、笔记（不加限制）
2. **情感化节点** — 特殊成就/里程碑时（极少使用，需设计师审核）

### 示例

```tsx
// ❌ 错误 — 用 emoji 替代图标
<div>❌ 发生错误</div>

// ✅ 正确 — 用 Lucide 图标
<div className="flex items-center gap-2">
  <XCircle size={20} className="text-[--error]" />
  <span>发生错误</span>
</div>

// ❌ 错误 — emoji 在 badge 中
<span className="badge">🏆 精选</span>

// ✅ 正确 — 图标 + 文字
<span className="badge">
  <Star size={16} className="inline mr-1" />
  精选
</span>

// ✅ 允许 — 用户生成内容中的 emoji
<div className="user-comment">
  这辆车太棒了！🚗✨ 推荐购买！
</div>
```

---

## 设计中的图标建议

### 图标选择建议

- **优先选择简单、清晰的图标** — 避免复杂、装饰性图标
- **一致性第一** — 同一功能在全应用中使用同一图标
- **考虑国际用户** — 符号应通用，避免文化歧义

### 自定义图标

若 Lucide 中没有合适的图标，可以：

1. **联系设计** — 在设计系统范围内补充
2. **临时方案** — 使用最接近的 Lucide 图标，并记录在案
3. **优先级** — 新增图标应遵循 Lucide 的笔触规范（1.85）

---

## 性能考虑

### SVG 内联化

Lucide React 默认内联 SVG，性能最优：

```tsx
import { Heart } from 'lucide-react'

// 直接渲染，无额外 HTTP 请求
<Heart size={24} />
```

### 避免的做法

```tsx
// ❌ 不要导入整个库
import * as Icons from 'lucide-react'
const Icon = Icons[iconName]  // 会导致所有图标被打包

// ✅ 只导入需要的图标
import { Heart, Star, Check } from 'lucide-react'
```

### 动态图标加载

若需动态加载图标（如从数据库读取图标名称）：

```tsx
// 预定义映射表，避免运行时动态导入
const iconMap = {
  'heart': Heart,
  'star': Star,
  'check': Check,
  // ...
}

export function DynamicIcon({ name, ...props }) {
  const IconComponent = iconMap[name]
  return IconComponent ? <IconComponent {...props} /> : null
}
```

---

## 常见问题

### Q: 能否改变 stroke-width?

**A:** 不建议。全局 `stroke-width: 1.85` 是视觉系统的基础。若特定场景需调整，应记录原因并在代码注释中说明。

```tsx
// ❌ 不推荐，但有充分理由时可用
<Heart size={24} strokeWidth={2.0} />
```

### Q: 能否使用 filled 图标?

**A:** Lucide 不提供 fill 版本，但可通过 CSS 填充：

```css
.icon-filled {
  fill: currentColor;
}
```

```tsx
<Heart size={24} className="icon-filled" />
```

### Q: 如何在深色主题中调整图标色?

**A:** 图标自动继承 `color`，使用 token 即可：

```tsx
<Heart
  size={24}
  className="text-[--text-soft]"  // 自动适应主题
/>
```

### Q: 能否混用多个图标库?

**A:** 不允许。所有图标必须来自 Lucide，确保视觉统一性。

---

## 迭代规范

### 添加新图标建议

1. **检查 Lucide 库** — 在 https://lucide.dev 搜索
2. **确认名称** — 记录 Lucide 中的准确名称
3. **本文档更新** — 在"常见图标清单"中补充
4. **使用示例** — 说明用途和适用场景

### 禁止做法

- ❌ 在组件中混用其他图标库（如 Feather、FontAwesome）
- ❌ 使用 emoji 替代图标
- ❌ 自定义 SVG 图标（应使用 Lucide）
- ❌ 改变笔触属性而不记录原因
