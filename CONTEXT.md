# AWS Mondai

AWS 认证考试双语刷题网站。从 ping-t.com 爬取日文题库，经 LLM 预翻译后以中文为主导、日文为辅助进行展示。

## Language

**Exam（考试）**:
一个 AWS 认证考试，如 AWS Certified Cloud Practitioner (CLF-C02)。一个 exam 下面包含若干道题目。
_Avoid_: Course, 题库, certification

**Question（题目）**:
一道完整的试题，包含题干、选项、正确答案、解析和学习资料。来自原始数据的一条记录。
_Avoid_: 题目条目, problem

**Quiz Session（刷题会话）**:
一次刷题活动的完整生命周期。从用户选择题数和模式开始，到完成所有题目或手动退出为止。每个 exam 独立维护各自的 session。未完成的 session 保留在 localStorage 中，关闭页面后再次打开时弹框恢复，超过 7 天未活动自动清理。
_Avoid_: 考试实例, quiz instance

**Mistake（错题）**:
答题时答错的题目记录。按 exam 独立存储，自动产生。用于「重做错题」功能。
_Avoid_: 错题列表, incorrect answers

**Bookmark（收藏）**:
用户手动标记的题目，用于反复回顾。按 exam 独立存储。可在浏览模式和答题中途随时添加/取消。
_Avoid_: 收藏夹, saved, favorite

**Bilingual Mode（双语模式）**:
中日文上下堆叠的渲染方式。中文（主导语言）在上，标准字号深色；日文（辅助语言）在下，小字号灰色。选项、解析、学习资料均遵循同一规则。
_Avoid_: 对照模式, side-by-side

**Rich Block（富文本块）**:
题目内容的最小渲染单元。类型包括 text（文本）、image（图片）、linebreak（换行）。由 RichBlockRenderer 组件统一解析渲染，中日文各自维护独立的 blocks 数组。
_Avoid_: content fragment, content node

**Language Preference（语言偏好）**:
用户选择的显示语言，存储在 localStorage。三选一：中文、日文、双语。首次访问默认使用双语模式。
_Avoid_: display mode, locale

**Topic（知识点）**:
从题目学习资料的章节标题中提取的知识点标签（如 "Amazon VPC"、"EC2"、"S3"）。在浏览列表的题目卡片上展示，Phase 4 加入按知识点筛选功能。
_Avoid_: tag, category, 分类

**Quiz Navigation（刷题导航）**:
刷题模式允许自由前后导航（←/→ 键或点击进度条跳转）。已提交的答案可以更改——选择新选项即覆盖旧答案并重新计分。进度条上每题用颜色标记：未答（灰）、正确（绿）、错误（红）。
_Avoid_: 锁定模式, linear quiz

