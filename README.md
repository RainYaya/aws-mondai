# AWS Mondai — 双语刷题网站

从 [Ping-t](https://mondai.ping-t.com) 爬取 AWS 认证考试试题（日文），经 LLM 批量翻译后，以**中文为主导、日文为辅助**的形式提供双语刷题体验。

## 功能

- **双语渲染**：中文 / 日文 / 中日双语三种模式，顶部导航栏一键切换
- **浏览模式**：按考试浏览所有题目，查看解析和学习资料
- **刷题模式**：配置题数和顺序，逐题作答，即时反馈，结果总结
- **进度持久化**：刷题中断后恢复、错题记录、收藏管理

## 快速开始

### 准备环境

需要 Node.js 20+ 和 pnpm：

```bash
# 安装 pnpm（如果还没有）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:3000 即可看到首页。目前包含 sample.json 的处理结果（CLF-C02 样题）。

### 生产构建

```bash
pnpm build
pnpm start
```

静态导出文件在 `out/` 目录，可直接部署到 Vercel、Cloudflare Pages 等。

---

## 数据管线

### 添加新题库

1. 把爬取到的 JSON 文件放到 `data/raw/` 目录下（文件名随意，支持多个文件）
2. 运行处理脚本：

```bash
pnpm process
```

脚本会自动完成：
- 合并所有文件
- 按 `questionId` 去重
- 从 `metadata.course` 字段提取考试代码（如 `AWS クラウドプラクティショナー(CLF-C02)` → `clf-c02`）
- 按考试分组
- 调用 LLM 翻译题目为简体中文
- 输出到 `data/processed/{examId}.json` + `manifest.json`

### 翻译环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | — | API Key（必填） |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 地址，可换成 Claude / DeepSeek 等 |
| `LLM_MODEL` | `gpt-4o-mini` | 模型名 |

示例（.env 文件）：

```
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### 自定义翻译风格

在 `data/raw/prompt.txt` 放一个自定义 system prompt 覆盖默认：

```text
您是一位专业的AWS认证翻译。请将以下日语翻译成简体中文。
保留所有AWS专业术语（例如 VPC、EC2、S3、IAM）的英文原词。
保持语法准确，适合备考阅读。
```

### 自定义考试名称和排序

在 `data/raw/courses.json` 配置展示名：

```json
{
  "CLF-C02": { "displayName": "AWS Cloud Practitioner", "order": 1 },
  "SAA-C03": { "displayName": "AWS Solutions Architect", "order": 2 }
}
```

### 图片离线下载（可选）

如需离线环境也能查看题目图片：

```bash
pnpm download-images
```

> 默认情况下，图片直接引用 Ping-t 的原始 CDN URL。下载后图片会保存到 `public/images/`，无需改动代码即可离线使用。

---

## 使用指南

### 语言切换

顶部导航栏右侧有三个按钮：**中文** / **日文** / **中日双语**

- 首次访问默认**双语模式**：中文大字深色在上，日文小字灰色在下
- 切换即时生效，无需刷新页面
- 偏好自动保存在浏览器，下次访问沿用

提示：页面底部有 `中文翻译由 AI 生成，仅供参考` 的免责声明。

### 浏览模式

1. 首页点击考试卡片进入该考试
2. 看到分页的题目列表（每页 20 题），显示题号、预览、知识点标签
3. 点击题目进入详情页，可看到：
   - 题干（含图片）
   - 选项列表（正确答案绿色高亮）
   - 解析（可折叠/展开）
   - 学习资料（可折叠/展开）
   - 上一题/下一题按钮
   - 收藏按钮

### 刷题模式

1. 在考试页面点击「开始测验」
2. 选择题数（10 / 20 / 50 / 全部）和模式（顺序 / 随机 / 只做错题）
3. 点击「开始」进入答题
4. 点击选项即提交答案（一步式），立刻看到对错反馈 + 解析
5. 可自由前后翻题（←/→ 键或点击进度条），已答题目可以改答案
6. 所有题目完成后进入结果页，查看正确率和错题回顾
7. 结果页提供「重做全部」和「只做错题」按钮

### 键盘快捷键

按 `?` 查看完整快捷键列表：

| 键 | 功能 |
|------|------|
| `←` / `→` | 上一题 / 下一题 |
| `j` / `k` | 上一题 / 下一题（vim 风格） |
| `1` – `9` | 选择选项（答题模式下） |
| `b` | 收藏 / 取消收藏 |
| `?` | 显示快捷键帮助 |

### 进度与恢复

- 刷题进度保存在浏览器，**关闭页面后再次进入该考试时会提示是否恢复**
- 超过 7 天未活动的 session 自动清理
- 不同考试的进度互不影响

---

## 项目结构

```
aws-mondai/
├── data/                    # 数据文件
│   ├── raw/                 # ← 爬取的 JSON 放在这里
│   ├── translations/
│   │   └── cache.json       # 翻译缓存（按文本哈希）
│   └── processed/           # 脚本输出
│       ├── manifest.json    # 总索引
│       └── clf-c02.json     # 每个考试一个文件
├── scripts/
│   ├── process.ts           # 主脚本（合并→分组→翻译）
│   ├── translate.ts         # 翻译模块
│   ├── copy-data.ts         # 复制数据到 public/
│   └── download-images.ts   # 图片离线下载
├── app/                     # Next.js App Router 页面
│   ├── [examId]/            # 按考试动态路由
│   │   ├── [questionId]/    # 题目详情
│   │   └── quiz/            # 刷题页面
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 首页
├── components/              # React 组件
│   ├── rich-block-renderer.tsx    # 富文本渲染（双语）
│   ├── nav-bar.tsx                # 顶部导航
│   ├── keyboard-shortcuts-modal.tsx
│   └── ...
├── lib/                     # 核心逻辑
│   ├── quiz-engine.ts       # 刷题引擎（纯函数）
│   ├── storage.ts           # localStorage 封装
│   └── language-context.tsx # 语言偏好上下文
└── public/data/             # 运行时数据（构建时复制）
    ├── manifest.json
    └── clf-c02.json
```

---

## 技术栈

- **框架**：Next.js 15 (App Router)
- **构建工具**：pnpm
- **样式**：Tailwind CSS 4
- **翻译**：LLM API（OpenAI 兼容格式）
- **部署**：静态导出（`pnpm build` → `out/`）

## 文档

- `CONTEXT.md` — 领域术语表
- `docs/adr/0001-pre-translation-overlay.md` — 翻译 overlay 架构决策
- `docs/adr/0002-hybrid-data-loading.md` — 混合数据加载策略
