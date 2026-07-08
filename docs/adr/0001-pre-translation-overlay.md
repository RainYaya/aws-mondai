# Pre-translation with overlay pattern

原始日文数据绝不修改。中文翻译通过 LLM 批量预生成，作为独立的 `translations.zh` overlay 叠加到原始数据上，而非替换原始字段。前端渲染时根据语言偏好动态选择读取 `content.*`（日文）或 `translations.zh.*`（中文）。

## Considered Options

- **预翻译 + 覆盖原始字段**：简单但丢失日文原文，无法做双语对照
- **运行时调翻译 API**：灵活但每刷一题都有延迟和 API 费用，离线不可用
- **预翻译 + overlay（选用）**：保留原文、零延迟、一次性费用、离线可用。代价是 JSON 文件体积增大 ~40%

## Consequences

- 翻译缓存 (`data/translations/cache.json`) 按文本哈希去重，跨 exam 共享——同一句日文出现在两个考试中只翻译一次
- 翻译质量依赖 LLM prompt，可在 `data/raw/prompt.txt` 自定义
- 环境变量 (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`) 决定用哪个模型
