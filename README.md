# EchoNote 🪞

*EchoNote — a minimal, LLM-powered, multilingual journaling and writing app.*

English | [简体中文](./README.zhs.md) | [繁體中文](./README.zht.md) | [日本語](./README.jp.md)

---

EchoNote focuses on an elegant, distraction-free writing experience with **AI-assisted writing and reflection** at its core. You can journal in any language, store everything as local Markdown files, and then ask AI to summarize, polish, or translate your entries.

---

## 🤖 AI Capabilities

- **AI journaling assistant**
  - Chat with AI / continue writing to generate a full-day journal
  - Real-time spellchecking and grammar hints
  - Whole-line smart completion and sentence-level semantic suggestions
  - Post-writing analysis with revision suggestions

- **Multilingual writing & translation**
  - Write in multiple languages (not limited to Chinese and English)
  - AI summaries try to preserve the original language and tone
  - Built-in translation workflow that works well as a language-learning partner

- **AI summaries & review**
  - Generate an emoji + concise summary for each day
  - Quickly review your recent days from the timeline view

---

## ✨ Features

### 📝 Calendar editor

- **Rich Markdown support**
  - Live syntax highlighting and inline formatting
  - Auto-save while you write
  - Support for headings, lists, code blocks, blockquotes, and more

### 📅 Writing calendar & timeline

- **Calendar**
  - Visual calendar showing per-day emoji and writing status

- **Timeline**
  - Linear preview of recent entries plus AI summaries

### 🌐 Multilingual support

- Learn to write in different languages with the help of translation
- AI summaries keep the same language and perspective as the original text where possible

### 🖥️ Cross-platform

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Android, iOS, iPadOS

---

## 🧠 Multiple AI API Providers

EchoNote works with multiple OpenAI-compatible APIs, and you can choose or disable AI as needed:

- [x] ChatGPT (OpenAI API)
- [x] DeepSeek
- [x] Custom OpenAI-compatible providers (configure `baseUrl` in Settings)
- [x] No AI (pure local Markdown writing mode)
- [ ] Claude (Anthropic)
- [ ] Azure OpenAI
- [ ] Gemini (Google)
- [ ] Cloudflare
- [ ] Others

> You can switch the active provider in **Settings**, or add custom configurations for any compatible service.

---

## 🧱 Tech Stack

- **Frontend**: Bun + SvelteKit + Vite + CSS
- **Backend**: Tauri + Rust

## 🚀 Development

```bash
bun install
bun run dev          # Start web dev server
bun run tauri dev    # Start desktop shell (after `bun run build`)
```

## 🎯 Principles

- **Minimal writing experience**: clean UI that stays out of your way
- **AI as assistant**: non-intrusive suggestions and summaries
- **Data ownership**: all entries are plain Markdown files, easy to open and back up
- **Consistent cross-platform UX**: same layout and flows across desktop platforms

## 📄 License

See [LICENSE](./LICENSE) for details.
