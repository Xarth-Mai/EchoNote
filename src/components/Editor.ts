// Markdown 编辑器组件

import { state, saveEntry, setViewMode, getEntry, toggleEditorFullscreen } from '../utils/state';
import type { DiaryEntry } from '../types';

export class Editor {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement | null = null;
  private autoSaveTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /** 渲染编辑器 */
  private render(): void {
    const currentDate = state.currentDate;
    const entry = getEntry(currentDate);
    const content = entry?.content || '';
    const isLandscape = state.layoutMode === 'landscape';
    const isFullscreen = state.editorFullscreen;

    // 根据布局模式决定按钮
    let backButtonHtml = '';
    if (isLandscape) {
      // 横屏模式：全屏/分屏切换按钮
      backButtonHtml = `
        <button id="toggle-fullscreen-btn"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
          style="color: var(--color-primary);"
          onmouseover="this.style.backgroundColor='var(--color-primary-hover)'"
          onmouseout="this.style.backgroundColor='transparent'">
          ${isFullscreen ? '⊟ 分屏' : '⊡ 全屏'}
        </button>
      `;
    } else {
      // 竖屏模式：返回主页按钮
      backButtonHtml = `
        <button id="back-btn"
          class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
          style="color: var(--color-primary);"
          onmouseover="this.style.backgroundColor='var(--color-primary-hover)'"
          onmouseout="this.style.backgroundColor='transparent'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          <span>主页</span>
        </button>
      `;
    }

    this.container.innerHTML = `
      <div class="editor h-full flex flex-col">
        <!-- 工具栏 -->
        <div class="flex items-center justify-between px-5 py-3 border-b backdrop-blur-md"
          style="border-color: var(--color-border-primary); background-color: var(--color-bg-tertiary);">
          ${backButtonHtml}
          <h2 class="text-base font-semibold tracking-tight" style="color: var(--color-text-primary);">${currentDate}</h2>
          <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-secondary);">
            <div class="w-2 h-2 rounded-full animate-pulse" style="background-color: var(--color-success);"></div>
            <span>已保存</span>
          </div>
        </div>

        <!-- 编辑区域 -->
        <textarea
          id="editor-textarea"
          class="flex-1 px-6 py-5 resize-none outline-none bg-transparent text-base leading-relaxed"
          placeholder="开始写作..."
          style="color: var(--color-text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;"
        >${content}</textarea>
      </div>
    `;

    this.attachEventListeners();
  }

  /** 绑定事件监听器 */
  private attachEventListeners(): void {
    // 返回主页按钮（竖屏模式）
    this.container.querySelector('#back-btn')?.addEventListener('click', () => {
      setViewMode('home');
    });

    // 全屏/分屏切换按钮（横屏模式）
    this.container.querySelector('#toggle-fullscreen-btn')?.addEventListener('click', () => {
      toggleEditorFullscreen();
    });

    // 编辑器输入
    this.textarea = this.container.querySelector('#editor-textarea');
    this.textarea?.addEventListener('input', () => {
      this.scheduleAutoSave();
    });
  }

  /** 计划自动保存 */
  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setTimeout(() => {
      this.save();
    }, 1000); // 1秒后保存
  }

  /** 保存内容 */
  private save(): void {
    if (!this.textarea) return;

    const entry: DiaryEntry = {
      date: state.currentDate,
      content: this.textarea.value,
    };

    saveEntry(entry);
    console.log('已保存:', entry);
    // TODO: 调用 Tauri API 保存到文件
  }

  /** 更新编辑器内容 */
  public update(): void {
    this.render();
  }
}

