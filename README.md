# EchoNote 🪞

*EchoNote（回声记）— A minimal intelligent bilingual diary & writing app powered by LLM.*

English | [中文](./README_CN.md)

---

EchoNote provides an elegant, distraction-free writing experience. It combines AI assistance for expression, reflection, and summarization while maintaining full offline capabilities.

---

## ✨ Features

### 📝 Smart Markdown Editor (Core)

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

### 📅 Mood Calendar & Timeline View

- **Calendar Interface**
  - Visual calendar view showing daily moods and writing status
  - Emoji-based mood markers for each date
  - Click any date to open/edit the corresponding entry
  - Manual mood editing (syncs with metadata)

- **Timeline View**
  - Displays recent entries with summaries
  - Auto-loads older content on scroll
  - Shows AI summaries and entry previews
  - Responsive layout:
    - **Portrait**: Calendar + timeline (compact, expandable)
    - **Landscape**: Split view (calendar on left, editor on right with optional fullscreen)

### 🖥️ Cross-Platform Support

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Android, iOS, iPadOS

---

## 🧱 Tech Stack

- **Frontend**: HTML + TypeScript + Tailwind CSS
- **Backend**: Tauri + Rust

## 🎯 Core Principles

- **Minimal Writing**: Clean interface that doesn't distract from creativity
- **AI Assistance**: Non-intrusive intelligent corrections and summaries
- **Data Ownership**: All diaries are Markdown files that can be opened directly and backed up
- **Consistent Cross-Platform Experience**: Same interface logic across desktop platforms

---

## 📄 License

See [LICENSE](./LICENSE) for details.
