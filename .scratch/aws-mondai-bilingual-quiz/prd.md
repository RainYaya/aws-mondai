# PRD: AWS Mondai — 双语刷题网站

## Problem Statement

我从 ping-t.com 爬取了 AWS 认证考试题库（日文），需要用它来备考。但直接看日文效率不够高——我习惯用中文学习。同时，完全抛弃日文原文也不好，因为翻译可能有偏差，日文原文是权威来源。我需要一个以中文为主导、日文可随时对照的刷题工具，既支持浏览学习，也支持模拟答题。

## Solution

构建一个 Next.js 静态网站，核心流程：

1. **数据管线**：将爬取的日文 JSON 丢进 `data/raw/`，一条命令自动合并去重、按考试分组、LLM 批量翻译为中文、输出前端可消费的 JSON
2. **浏览模式**：按考试浏览所有题目，查看详细的日文原文 + AI 中文翻译 + 解析 + 学习资料
3. **刷题模式**：配置题库/题数/顺序，逐题作答，实时判分，结束后看总结和错题回顾

语言偏好三选一：仅中文、仅日文、中日双语（中文大字深色为主导，日文小字灰色为辅）。

## User Stories

### 数据管理

1. As a 题库管理员, I want 把爬取的 JSON 文件（任意文件名）丢进 `data/raw/` 后跑一条命令就完成所有处理, so that 不用手动整理和分组
2. As a 题库管理员, I want 同一考试分散在多个文件中的题目自动合并去重, so that 续爬的题目无缝融入已有题库
3. As a 题库管理员, I want 脚本自动从 `metadata.course` 中提取考试代码（如 CLF-C02）来分组, so that 不用手动指定每道题属于哪个考试
4. As a 题库管理员, I want LLM 批量翻译所有题目为中文并缓存结果, so that 新增题目时已翻译过的文本自动跳过
5. As a 题库管理员, I want 支持 OpenAI 兼容的 API 格式和自定义 prompt, so that 可以自由选择翻译模型和调校翻译风格
6. As a 题库管理员, I want 可选地运行图片下载脚本将远程图片本地化, so that 在离线环境中也能查看题目图片
7. As a 题库管理员, I want 可选的 `courses.json` 配置文件来覆盖课程展示名和排序, so that 首页展示更友好

### 首页与导航

8. As a 学习者, I want 在首页看到所有可用考试的题库卡片（考试名称 + 题目数量 + 知识点标签）, so that 快速选择要学习的考试
9. As a 学习者, I want 顶部导航栏始终可见并能随时切换语言偏好（中文/日文/双语）, so that 切换语言不用进入设置页面
10. As a 学习者, I want 首次访问时默认显示双语模式, so that 第一印象就感受到这个网站的独特价值

### 浏览模式

11. As a 学习者, I want 查看某个考试下所有题目的列表（题号 + 内容预览 + 知识点标签 + 做题状态）, so that 快速定位想看的题目
12. As a 学习者, I want 浏览列表支持分页, so that 题目多时不会一次加载太多
13. As a 学习者, I want 点击题目进入独立详情页（URL 可分享）, so that 可以把感兴趣的题目链接发给别人
14. As a 学习者, I want 在题目详情页看到完整的题干（含图片等富文本）, so that 理解完整的题目背景
15. As a 学习者, I want 在题目详情页看到所有选项并高亮正确答案, so that 学习正确答案是什么
16. As a 学习者, I want 在题目详情页看到详细解析（折叠/展开）, so that 理解为什么这个答案是对的
17. As a 学习者, I want 在题目详情页看到关联的学习资料（折叠/展开）, so that 深入学习相关 AWS 知识点
18. As a 学习者, I want 用键盘快捷键浏览（j/k 或 ←/→ 翻题，b 收藏）, so that 不用鼠标也能高效浏览
19. As a 学习者, I want 在浏览模式下收藏题目, so that 标记值得反复看的题目
20. As a 学习者, I want 在浏览模式下看到每道题的做题历史（做过/对/错/未做）, so that 知道自己哪些题还需要复习

### 刷题模式

21. As a 学习者, I want 在刷题配置页选择题数（10/20/50/全部）, so that 根据自己的时间灵活调整
22. As a 学习者, I want 选择题目顺序（按原始顺序/随机/只做错题）, so that 根据不同复习阶段选择合适的模式
23. As a 学习者, I want 刷题时看到进度条（当前位置 + 每题颜色标记：灰=未答、绿=正确、红=错误）, so that 一目了然地了解整体进度和表现
24. As a 学习者, I want 点击选项即直接提交并看到结果反馈, so that 答题流程高效流畅
25. As a 学习者, I want 提交后立刻看到正确/错误的视觉反馈 + 解析, so that 即时学习不积压疑问
26. As a 学习者, I want 使用键盘快捷键答题（1-4 选选项，←/→ 翻题，b 收藏，? 查看快捷键）, so that 全键盘操作提升刷题速度
27. As a 学习者, I want 在刷题模式下自由前后导航（翻题、点击进度条跳转）, so that 随时回顾之前做过的题
28. As a 学习者, I want 已经提交过的题目可以更改答案（重新选择即覆盖并重新计分）, so that 改错后能纠正分数
29. As a 学习者, I want 关闭浏览器后回来能恢复未完成的刷题 session（弹框确认）, so that 意外中断不丢进度
30. As a 学习者, I want 超过 7 天未活动的 session 自动清理, so that 不会有陈旧数据堆积
31. As a 学习者, I want 不同考试的刷题 session 互不影响, so that 同时在学多个考试时进度不混乱
32. As a 学习者, I want 完成所有题目后看到结果总结页（正确率 + 用时 + 每题结果表格）, so that 评估自己的掌握程度
33. As a 学习者, I want 结果页提供"重做全部"/"只做错题"按钮, so that 针对性强化薄弱环节
34. As a 学习者, I want 点击结果表中的错题跳转到浏览模式详情页回顾, so that 深入理解做错的题目

### 双语体验

35. As a 学习者, I want 在双语模式下中文大字深色显示在上、日文小字灰色显示在下, so that 中文为主导但日文随时可对照
36. As a 学习者, I want 语言切换即时生效无需刷新页面, so that 对比中日文表达时不用等待
37. As a 学习者, I want 看到"中文翻译由 AI 生成，仅供参考"的免责声明, so that 知道中文翻译可能有偏差、以日文原文为准
38. As a 学习者, I want 仅日文模式下所有内容恢复为原始日文, so that 可以用纯日文环境模拟真实考试

### 多选题

39. As a 学习者, I want 多选题使用严格判分（必须完全匹配正确答案才得分）, so that 判分标准与真实 AWS 考试一致
40. As a 学习者, I want 多选题渲染为复选框（而非单选按钮）, so that 清楚地知道可以选多个

### 通用

41. As a 学习者, I want 网站完全静态部署无需服务器, so that 部署到 Vercel/Cloudflare Pages 后零运维
42. As a 移动端学习者, I want 所有页面响应式适配手机屏幕, so that 在地铁上也能用手机刷题
43. As a 学习者, I want 图片加载失败时显示灰色占位框 + alt 文字, so that 图片挂了也不影响刷题体验

## Implementation Decisions

### 领域模型

项目使用统一的术语表（见 `CONTEXT.md`）：
- **Exam**：一个 AWS 认证考试（如 CLF-C02），路由 slug 为考试代码小写
- **Question**：一道试题，包含题干、选项、正确答案、解析、学习资料
- **Quiz Session**：一次刷题活动的完整生命周期
- **Mistake**：答错的题目记录，按 exam 独立存储
- **Bookmark**：用户手动收藏的题目，按 exam 独立存储
- **Topic**：从学习资料标题中提取的知识点标签
- **Rich Block**：题目内容的最小渲染单元（text/image/linebreak）
- **Bilingual Mode**：中日文上下堆叠渲染，中文主导
- **Language Preference**：用户选择的语言，首次默认双语

### 架构决策

ADR-0001 — **翻译 overlay 模式**：原始日文不修改，中文作为 `translations.zh` overlay 叠加。LLM 批量预翻译，翻译缓存按文本哈希去重、跨 exam 共享。

ADR-0002 — **混合数据加载**：manifest.json（轻量索引，运行时 fetch）→ 列表页秒开；详情页 SSG `generateStaticParams` 预渲染为独立静态 HTML；刷题模式从 `public/data/{examId}.json` 一次性加载完整数据。

### 数据管线

- `scripts/process.ts` 为主入口，扫描 `data/raw/*.json` → 合并去重 → 正则提取 exam slug → 按 exam 分组 → 调翻译模块 → 校验 → 输出 `data/processed/{examId}.json` + `manifest.json`
- `scripts/translate.ts` 为翻译模块，按文本哈希查缓存，未命中调 LLM API（OpenAI 兼容），逐条翻译
- `scripts/download-images.ts` 为可选图片下载脚本，不集成在主流程中
- `data/raw/courses.json` 可选，覆盖考试展示名和排序
- 考试代码从 `metadata.course` 字段正则提取：`/\(([A-Z]+-\d+)\)/`

### 路由设计

```
/                                        → 首页（多 exam 列表）
/[examId]                                → 浏览列表（分页）
/[examId]/[questionId]                   → 单题详情（SSG）
/[examId]/quiz                           → 刷题配置
/[examId]/quiz/session/[sessionId]       → 答题中
/[examId]/quiz/session/[sessionId]/results → 结果总结
```

### 刷题引擎

纯函数模块，无 UI 依赖：
- `createSession(pool, count, shuffle)` → session
- `submitAnswer(session, questionId, choiceValue)` → `{ correct, correctAnswer }`
- `getProgress(session)` → `{ current, total, correct, incorrect }`
- `getResults(session)` → 完整结果数组

session 状态通过 React Context + useReducer 包装，同步到 localStorage。

### 判分规则

- 单选题：选中选项的 `correct` 字段为 `true` 即得分
- 多选题：严格匹配（用户选中的选项集合与正确答案集合完全一致才得分）
- 每题一分，总分 = 答对题数

### 交互细节

- 一步式提交：点击选项即提交答案，无确认步骤
- 自由导航：刷题中可前后翻题，进度条可点击跳转，已答题目可改答案
- 会话恢复：关闭页面后 localStorage 保留 session，下次访问弹框恢复；7 天未活动自动清理
- 键盘快捷键：`1-4` 选选项、`←/→` 或 `j/k` 翻题、`b` 收藏、`?` 查看快捷键帮助
- 图片处理：直接使用 ping-t.com 原始 URL，`<img onError>` 显示灰色占位 + alt 文字
- 翻译免责：页面底部显示"中文翻译由 AI 生成，仅供参考"

### 浏览器存储结构

```
localStorage:
  language-preference          → "zh" | "ja" | "bilingual"
  quiz-session/{examId}        → { sessionId, answers, startedAt, lastActiveAt }
  mistakes/{examId}            → ["questionId1", "questionId2", ...]
  bookmarks/{examId}           → ["questionId1", "questionId2", ...]
  completed/{examId}           → ["questionId1", "questionId2", ...]
```

## Testing Decisions

### 测试原则

只测试外部行为，不测试实现细节。一个纯函数的输入-输出对就是它的外部行为；一个组件的渲染结果和交互效果就是它的外部行为。

### 测试层级

**纯函数单元测试**（Vitest）：
- `extractExamCode()` — 从日文课程名提取考试代码
- `mergeAndDedupe()` — 合并多个文件并去重
- `groupByExam()` — 按 exam 分组
- `createSession()` / `submitAnswer()` / `getProgress()` / `getResults()` — 刷题引擎全部函数
- 多选题严格判分逻辑

**组件测试**（React Testing Library）：
- `RichBlockRenderer` — 给定各类型 blocks + 语言模式，渲染正确 DOM
- `ChoiceList` — 浏览模式（正确项绿标、不可点击）/ 答题模式（可点击、选中高亮）

**E2E 冒烟测试**（Playwright）：
- 首页 → 选择 exam → 浏览列表 → 查看单题详情
- 首页 → 选择 exam → 配置 quiz → 答题 → 查看结果
- 语言切换：在三处关键页面（列表、详情、刷题）切换语言验证生效

## Out of Scope

- 用户账户系统（跨设备同步）
- 计时模式与模拟考试模式
- 错题导出 PDF / 打印
- 知识点筛选功能（Phase 4 加入，标签展示在 Phase 2 先做）
- 深色模式
- 图片离线下载集成到主流程（脚本保留但不自动跑）
- 题目难度评级

## Further Notes

- 原始数据来源：ping-t.com，格式见 `sample.json`
- 数据量级：单 exam 最多 ~1000 题，多 exam 累计；原始 JSON 可达 20 万行
- 翻译成本估算：500 题 × ~400 字符/题 = ~200K 字符 ≈ ~50K tokens → 用 Claude Sonnet 约 $0.5-1 / exam
- 部署目标：Vercel / Cloudflare Pages 静态托管
