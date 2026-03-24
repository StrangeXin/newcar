# Design System — 总览

> **这是 NewCar 视觉系统的唯一真实来源。** 所有视觉相关改动，开发前必须先查阅此处。

## 文件索引

| 文件 | 内容 |
|------|------|
| [tokens.md](./tokens.md) | 所有 CSS 变量定义、两套主题对照 |
| [components.md](./components.md) | 组件变体、用法、示例 |
| [typography.md](./typography.md) | 字体规范、字号阶梯 |
| [icons.md](./icons.md) | 图标使用规范 |
| [themes.md](./themes.md) | 主题扩展指南 |

## 设计决策记录

- [2026-03-24 视觉升级方案](../superpowers/specs/2026-03-24-visual-upgrade-design.md) ← 当前

## 快速参考

### 强调色
- 主题 1（橙暖默认）：`var(--accent)` = `#f97316`
- 主题 2（靛蓝极简）：`var(--accent)` = `#6366f1`

### 字体
- 标题/展示：`var(--font-display)` = Playfair Display + Noto Serif SC
- 正文：`var(--font-body)` = Inter + Noto Sans SC

### 图标规范
- 统一使用 **Lucide**，`stroke-width: 1.85`
- **禁止**用 emoji 替代图标（仅极少数情感节点允许）

### 迭代规则
1. 优先复用已有 token，禁止硬编码颜色值
2. 新增 token 前先在 `tokens.md` 定义
3. 新组件变体在 `components.md` 补充说明
