# Plan 8 Frontend Smoke Checklist

## Prep
- [ ] 启动 API：`cd apps/api && npm run dev`
- [ ] 启动 Web：`cd apps/web && npm run dev`
- [ ] 执行社区 seed：`cd apps/api && npx tsx prisma/seed-community.ts`
- [ ] 确认 `apps/api/.env` 已配置 `JWT_SECRET` 与 AI 相关变量

## A. Auth
- [ ] 访问 `/` 页面正常加载
- [ ] 登录页请求 OTP 有响应
- [ ] 错误验证码登录失败有提示
- [ ] 正确验证码登录成功并跳转 `/journey`
- [ ] 刷新页面仍保持登录
- [ ] 退出登录后受保护页跳转 `/login`

## B. Journey Workspace
- [ ] 无旅程时显示创建旅程引导
- [ ] 创建旅程成功后看板可见
- [ ] AI 对话可发送并收到响应
- [ ] 候选车型列表与阶段进度可见
- [ ] 快照与通知模块正常展示

## C. Publish
- [ ] 点击“发布历程”进入 `/journey/publish`
- [ ] Step 1 至少选择一种形式
- [ ] Step 2 可拉取预览并展示
- [ ] Step 3 确认发布成功并跳转详情页
- [ ] 新发布内容在社区广场可见

## D. Community
- [ ] `/community` 可展示卡片列表
- [ ] 筛选（燃油/预算/场景）生效
- [ ] 排序切换生效（相关/最新/热门）
- [ ] 进入 `/community/:id` 详情页成功
- [ ] 三个 Tab（story/report/template）切换正常
- [ ] 点赞与取消点赞数变化正确
- [ ] 评论提交后在列表可见
- [ ] 有模板内容显示“从此出发”按钮
- [ ] “从此出发”成功创建新旅程并跳转

## E. Moderation (Admin)
- [ ] ADMIN 可访问审核队列
- [ ] MEMBER 访问审核队列返回 403
- [ ] 审核通过后内容在社区可见
- [ ] 审核拒绝后内容在社区不可见
- [ ] 设为精选成功
- [ ] 用户举报接口可用

## F. Mobile (Optional)
- [ ] 375px 下社区页面无横向溢出
- [ ] 旅程页底部四 Tab 显示正常
- [ ] 输入框在移动端不被遮挡
