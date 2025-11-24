# EchoNote 🪞

*EchoNote（回声记）— 一款由 LLM 驱动的简约智能多语言日记与写作应用。*

[English](./README.md) | 简体中文 | [繁體中文](./README.zht.md) | [日本語](./README.jp.md)

---

EchoNote 提供优雅、专注的写作体验，重点围绕「AI 辅助写作与反思」。你可以用任意语言记录日记，由本地 Markdown 文件保存，再交给 AI 进行摘要、润色与翻译。

---

## 🤖 AI 能力

- **AI 日记助手**
  - 与 AI 对话/续写，一次生成整天的日记
  - 实时拼写与语法检查，给出轻量提示
  - 整行智能补全与句子级语义补全
  - 写作完成后自动分析内容并给出修改建议

- **多语言写作与翻译**
  - 支持多语言内容写作（不限于中英文）
  - AI 摘要尽量沿用原文语言与语气
  - 内置实时翻译能力，适合作为语言学习搭子

- **AI 摘要与回顾**
  - 根据每日内容生成 Emoji + 精炼摘要
  - 支持在时间线视图中快速回顾近期状态

---

## ✨ 功能特性

### 📝 日历编辑器

- **丰富的 Markdown 支持**
  - 实时语法高亮和内联格式化
  - 自动保存功能
  - 支持标题、列表、代码块、引用等

### 📅 创作日历与时间线

- **日历**
  - 显示每日Emoji和写作状态的视觉日历视图

- **时间线**
  - 线性预览近期日记 + AI 摘要

### 🌐 多语言支持

- 可结合翻译功能，学习不同语言创作
- AI 摘要默认保持与使用者母语一致的语言和视角

### 🖥️ 跨平台支持

- **桌面端**：Windows, macOS, Linux
- **移动端**：Android, iOS, iPadOS

---

## 🧠 多家 AI API 灵活接入

支持多家主流与兼容的 AI API，可以按需启用或关闭（模型名称 + 发行商）：

- [x] [ChatGPT](https://openai.com/chatgpt)（OpenAI）
- [x] [DeepSeek](https://www.deepseek.com/)（DeepSeek）
- [x] [Claude](https://claude.ai/)（Anthropic）
- [x] [Gemini](https://gemini.google.com/)（Google）
- [ ] [Azure OpenAI](https://azure.microsoft.com/)（Microsoft）
- [ ] [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)（Cloudflare）
- [ ] [文心一言](https://yiyan.baidu.com/)（百度）
- [ ] [通义千问](https://qianwen.aliyun.com/)（阿里巴巴）
- [ ] [豆包](https://www.doubao.com/)（字节跳动）
- [ ] [Kimi](https://kimi.moonshot.cn/)（月之暗面 Moonshot）
- [ ] [Grok](https://x.ai/)（xAI）
- [ ] [Ollama](https://ollama.com/)
- [ ] [LM Studio](https://lmstudio.ai/)
- [x] 不使用 AI（纯本地 Markdown 写作模式）

> 你可以在「设置」中切换默认模型，或为不同兼容服务添加自定义配置。

---

## 🧱 技术栈

- **前端**：[Bun](https://bun.sh/) + [SvelteKit](https://kit.svelte.dev/) + [Vite](https://vitejs.dev/) + CSS
- **后端**：[Tauri](https://tauri.app/) + [Rust](https://www.rust-lang.org/)

## 🚀 开发方式

```bash
bun install
bun tauri dev
```

## 🎯 核心原则

- **简约写作**：简洁界面，不干扰创作
- **AI 辅助**：非侵入式智能修正和总结
- **数据所有权**：所有日记均为 Markdown 文件，可直接打开和备份
- **一致的跨平台体验**：所有桌面平台使用相同的界面逻辑

## 📄 许可证

详情请参阅 [LICENSE](./LICENSE)。
