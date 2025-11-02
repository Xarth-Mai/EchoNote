# EchoNote 🪞  
*A minimal intelligent bilingual writing & journaling app powered by LLM.*

## ✨ Features
- **📝 Smart Markdown Editor**  
  - Real-time saving & syntax highlighting  
  - AI-assisted writing (grammar, phrasing, and tab-style completions)  
  - Dual-language writing support  

- **📅 Mood Calendar & Timeline**  
  - Each date has an emoji-based mood marker  
  - Timeline view for recent entries  

- **🤖 AI Companion**  
  - Generates summaries, reflections, or emotional feedback after writing  
  - Optional interactive dialog about your day or writing style  

- **☁️ Local-First Sync**  
  - User-defined cloud backends (WebDAV / SMB / any personal cloud)  
  - Conflict detection & merge logic inspired by Git  
  - Offline-first design  

- **💾 Data Format**  
  Each entry is a single `.md` file with inline metadata:  
  ```markdown
  ---
  date: 2025-10-31
  mood: 😊
  tags: [reflection, english]
  ---
  Today I learned something new about myself...
  ```

- **🖥️ Cross-Platform UI**
	•	Built with Tauri + HTML/JS
	•	Adaptive layouts for desktop, tablet, and mobile
	•	Minimal transitions, focus on clean writing experience

- **🧱 Tech Stack**
	•	Tauri — native desktop wrapper
	•	Vanilla HTML / JS / CSS
	•	Markdown + YAML frontmatter
	•	Local storage + custom cloud sync

- **🚧 Roadmap**
	•	AI-driven editing suggestions
	•	Improved merge conflict UI
	•	Optional end-to-end encryption
	•	Mobile PWA support

