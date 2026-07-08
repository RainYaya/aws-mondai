# Hybrid data loading: manifest + SSG + runtime fetch

前端数据加载采用三层策略，而非单一方案：

- **manifest.json**（~50KB）：轻量索引，包含所有 exam 的元信息和题目摘要。首页和列表页在运行时 fetch，保证首屏秒开
- **SSG（generateStaticParams）**：每道题的详情页 (`/[examId]/[questionId]`) 在构建时编译为独立静态 HTML，SEO 友好、可分享链接
- **运行时 fetch**：刷题模式从 `public/data/{examId}.json` 一次性加载完整数据，支持随机、筛选、自由导航

## Considered Options

- **纯 SSG**：所有页面构建时生成。刷题模式的动态功能（随机出题、重做错题）无法实现
- **纯运行时**：所有数据客户端 fetch。首屏加载大 JSON 慢，详情页无独立 URL
- **混合（选用）**：各取所长，代价是三套加载逻辑增加代码复杂度

## Consequences

- `public/data/` 目录需在构建时从 `data/processed/` 复制
- manifest.json 需包含题目摘要（ID + 前 80 字 + topic），否则列表页需要额外请求
- generateStaticParams 的 paths 数量 = 题目总数，构建时间随题目数线性增长
