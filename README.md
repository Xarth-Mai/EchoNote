# EchoNote 🪞

*EchoNote（回声记）— A minimal intelligent bilingual diary & writing app powered by LLM.*

English | [中文](./README_CN.md)

---

EchoNote provides an elegant, distraction-free writing experience. It combines AI assistance for expression, reflection, and summarization while maintaining full offline capabilities.

---

## ✨ Features

### 📝 Smart Journal Editor

- **Rich Markdown Support**
  - Real-time syntax highlighting & inline formatting
  - Auto-save functionality
  - Support for headings, lists, code blocks, quotes, etc.

- **AI-Assisted Writing**
  - Real-time spelling & grammar error detection with lightweight hints
  - Tab key to accept suggestions
  - Auto-completion & semantic prompts (sentence-level)
  - Optional translation hints when selecting text

- **AI Summary & Analysis**
  - Automatic analysis after writing completion
  - Grammar & logic corrections (when necessary)
  - Generates: writing summary, emotion analysis, keyword extraction
  - Saves to front matter's `ai_summary` field

### 📅 Creation Calendar & Timeline

- **Calendar Component**
  - Visual calendar view showing each day's writing status
  - Click any date to view the corresponding entry

- **Timeline Component**
  - Displays recent diary entries together with their AI summaries

### 🖥️ Cross-Platform Support

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Android, iOS, iPadOS

---

## 🧱 Tech Stack

- **Frontend**: Bun + SvelteKit + Vite + CSS
- **Backend**: Tauri + Rust

## 🚀 Development

```bash
bun install
bun tuari dev
```

## 🎯 Core Principles

- **Minimal Writing**: Clean interface that doesn't distract from creativity
- **AI Assistance**: Non-intrusive intelligent corrections and summaries
- **Data Ownership**: All diaries are Markdown files that can be opened directly and backed up
- **Consistent Cross-Platform Experience**: Same interface logic across desktop platforms

---

## 📄 License

See [LICENSE](./LICENSE) for details.
