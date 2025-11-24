# EchoNote 🪞

*EchoNote（回聲記）— 一款由 LLM 驅動的簡約智慧多語言日記與寫作應用。*

[English](./README.md) | [简体中文](./README.zhs.md) | 繁體中文 | [日本語](./README.jp.md)

---

EchoNote 提供優雅、專注的寫作體驗，重點圍繞「AI 輔助寫作與反思」。你可以使用任意語言記錄日記，由本地 Markdown 檔案保存，再交給 AI 進行摘要、潤飾與翻譯。

---

## 🤖 AI 能力

- **AI 日記助手**
  - 與 AI 對話／續寫，一次生成整天的日記
  - 即時拼字與語法檢查，給出輕量提示
  - 整行智慧補全與句子級語意補全
  - 寫作完成後自動分析內容並給出修改建議

- **多語言寫作與翻譯**
  - 支援多語言內容寫作（不限於中英文）
  - AI 摘要盡量沿用原文語言與語氣
  - 內建翻譯流程，適合作為語言學習夥伴

- **AI 摘要與回顧**
  - 依據每日內容生成 Emoji + 精簡摘要
  - 可在時間線檢視中快速回顧近期狀態

---

## ✨ 功能特性

### 📝 日曆編輯器

- **豐富的 Markdown 支援**
  - 即時語法高亮與行內格式化
  - 自動儲存功能
  - 支援標題、清單、程式碼區塊、引用等

### 📅 創作日曆與時間線

- **日曆**
  - 以視覺化日曆呈現每日 Emoji 與寫作狀態

- **時間線**
  - 線性預覽近期日記與 AI 摘要

### 🌐 多語言支援

- 可結合翻譯功能，練習以不同語言創作
- AI 摘要預設維持與使用者母語相同的語言與視角

### 🖥️ 跨平臺支援

- **桌面端**：Windows、macOS、Linux
- **行動裝置**：Android、iOS、iPadOS


## 🧠 多家 AI API 彈性接入

支援多家主流與相容的 AI API，可以依需求啟用或關閉（模型名稱 + 發行商）：

- [x] [ChatGPT](https://openai.com/chatgpt)（OpenAI）
- [x] [DeepSeek](https://www.deepseek.com/)（DeepSeek）
- [x] [Claude](https://claude.ai/)（Anthropic）
- [x] [Gemini](https://ai.google.dev/)（Google）
- [ ] [Azure OpenAI](https://azure.microsoft.com/)（Microsoft）
- [ ] [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)（Cloudflare）
- [ ] [文心一言](https://yiyan.baidu.com/)（百度）
- [ ] [通義千問](https://qianwen.aliyun.com/)（阿里巴巴）
- [ ] [豆包](https://www.doubao.com/)（字節跳動）
- [ ] [Kimi](https://kimi.moonshot.cn/)（月之暗面 Moonshot）
- [ ] [Grok](https://x.ai/)（xAI）
- [ ] [Ollama](https://ollama.com/)（本地多模型管理）
- [ ] [LM Studio](https://lmstudio.ai/)（本地／遠端模型啟動器）
- [x] 不使用 AI（純本地 Markdown 寫作模式）

> 你可以在「設定」中切換預設模型，或為不同相容服務新增自訂配置。

---

## 🧱 技術堆疊

- **前端**：[Bun](https://bun.sh/) + [SvelteKit](https://kit.svelte.dev/) + [Vite](https://vitejs.dev/) + CSS
- **後端**：[Tauri](https://tauri.app/) + [Rust](https://www.rust-lang.org/)

## 🚀 開發方式

```bash
bun install
bun tauri dev
```

## 🎯 核心原則

- **簡約寫作**：介面簡潔，不打擾創作
- **AI 輔助**：非侵入式地提供建議與摘要
- **資料所有權**：所有日記皆為 Markdown 檔案，方便直接開啟與備份
- **一致的跨平臺體驗**：所有桌面平臺採用相同的介面與操作邏輯

## 📄 授權條款

詳情請參閱 [LICENSE](./LICENSE)。
