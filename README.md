# AWS Mondai — 双语刷题网站

中日英三语 AWS 认证考试刷题网站。支持浏览学习和模拟答题。

## 当前题库

| 考试 | 题数 | 题目语言 | 解析语言 |
|------|------|---------|---------|
| **CLF-C02** Cloud Practitioner | 533 | 日文 | 日文 + 中文 |
| **SAA-C03** Solutions Architect | 1040 | 英文 | 中文 |
| **DEA-C01** Data Engineer | 199 | 英文 | 中文 |
| **总计** | **1772** | | |

## 快速开始

```bash
pnpm install
pnpm dev          # 本地开发 http://localhost:3000
pnpm build        # 生产构建，输出到 out/
```

## 使用指南

### 语言切换

顶部导航栏右边：**中文** / **日文** / **中日双语**
- 首次打开默认双语：中文大字在上，日文灰色小字在下
- 切换即时生效，偏好自动保存

### 浏览模式

首页点击考试 → 题目列表 → 点击进入详情（题干+选项+解析+学习资料）

### 刷题模式

考试页面点「开始测验」→ 选择题数和模式 → 答题 → 看结果
- 点选项即提交，立刻反馈对错
- 自由前后翻，已答可改答案
- 中断后恢复，进度不丢

### 键盘快捷键

按 `?` 查看全部：
`←/→` 翻题 · `1-4` 选选项 · `b` 收藏

---

## 数据处理（核心概念）

所有格式最终都变成同一个标准结构，给前端消费。处理方式只有两步：

### 第一步：转成标准格式

```
你有的文件                   用什么命令
───────────────────────────────────────────
Ping-t 日文格式              pnpm process
英文含 textZh 的             pnpm adapt xxx.json
纯英文 / 自定义格式          pnpm adapt-quiz xxx.json
已有题库追加新题             pnpm merge xxx.json examId
```

### 第二步：加中文翻译（LLM 自动）

转成标准格式后，脚本会自动调 LLM API 把文本翻译成中文。已经翻过的不会再翻（缓存）。

### 环境变量

```env
OPENAI_API_KEY=sk-xxx              # 必填
OPENAI_BASE_URL=https://api.xxx    # 默认 https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini              # 默认 gpt-4o-mini
```

---

## 遇到新格式怎么办？

**直接找我。** 你把 JSON 文件扔到 `data/raw/` 里告诉我就行，我分析格式后当场给你写成适配器。

核心只需要这 3 个字段就能工作：

```
题目文本  +  选项列表  +  正确答案
```

其他字段（解析、图片、知识点分类）都是可选的，有就保留，没有也不影响。

---

## 项目结构

```
aws-mondai/
├── data/
│   ├── raw/                    ← 你放原始 JSON 的地方
│   ├── processed/              ← 脚本输出，前端直接读
│   │   ├── manifest.json       ← 总索引
│   │   ├── clf-c02.json        ← 533题
│   │   ├── saa-c03.json        ← 1040题
│   │   └── dea-c01.json        ← 199题
│   └── translations/
│       └── cache.json          ← LLM 翻译缓存
├── scripts/
│   ├── process.ts              ← Ping-t 日文格式 → 翻译
│   ├── adapt-english.ts        ← 英文含中文预翻 → 标准格式
│   ├── adapt-quiz-results.ts   ← quiz_results 格式 → 标准格式
│   ├── translate-and-merge.ts  ← 翻译 + 去重合并
│   ├── translate.ts            ← LLM 翻译模块
│   └── copy-data.ts            ← 复制到 public/ 供前端
├── app/                        ← 前端页面
├── components/                 ← React 组件
└── lib/                        ← 核心逻辑
```

## 技术栈

Next.js 15 + Tailwind CSS 4 + pnpm / 静态导出 / LLM 翻译
