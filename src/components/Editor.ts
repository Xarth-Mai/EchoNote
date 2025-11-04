// Markdown 编辑器组件

import { state, setViewMode, toggleEditorFullscreen, setCurrentBody, getSummary, upsertSummary } from '../utils/state';
import type { DiaryEntry } from '../types';
import { getEntryBody, saveEntryByDate } from '../utils/backend';

export class Editor {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement | null = null;
  private autoSaveTimer: number | null = null;
  private lastRenderedDate: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /** 渲染编辑器 */
  private render(): void {
    const currentDate = state.currentDate;
    const content = state.currentBody || '';
    const isLandscape = state.layoutMode === 'landscape';
    const isFullscreen = state.editorFullscreen;

    // 记录当前渲染所对应的日期，用于在切换日期前冲刷未完成的自动保存
    this.lastRenderedDate = currentDate;

    // 根据布局模式决定按钮
    let backButtonHtml = '';
    if (isLandscape) {
      // 横屏模式：全屏/分屏切换按钮
      backButtonHtml = `
        <button id="toggle-fullscreen-btn"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)"
        >
          ${isFullscreen ? '⊟ 分屏' : '⊡ 全屏'}
        </button>
      `;
    } else {
      // 竖屏模式：返回主页按钮
      backButtonHtml = `
        <button id="back-btn"
          class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)"
          aria-label="返回主页"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          <span>主页</span>
        </button>
      `;
    }

    this.container.innerHTML = `
      <div class="editor h-full flex flex-col">
        <!-- 工具栏 -->
        <div class="flex items-center justify-between px-5 py-3 border-b backdrop-blur-md border-(--color-border-primary) bg-(--color-bg-tertiary)">
          ${backButtonHtml}
          <h2 class="text-base font-semibold tracking-tight text-(--color-text-primary)">${currentDate}</h2>
          <div class="flex items-center gap-2 text-xs text-(--color-text-secondary)">
            <div class="w-2 h-2 rounded-full animate-pulse bg-(--color-success)"></div>
            <span>自动保存</span>
          </div>
        </div>

        <!-- 编辑区域 -->
        <textarea
          id="editor-textarea"
          class="flex-1 px-6 py-5 resize-none outline-none bg-transparent text-base leading-relaxed text-(--color-text-primary)"
          placeholder="开始写作..."
        >${content}</textarea>
      </div>
    `;

    this.attachEventListeners();

    // 进入编辑器或切换日期时按需加载正文
    void this.ensureBodyLoaded(currentDate);
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
    }, 10000); // 10秒后保存
  }

  /** 保存内容 */
  private save(dateOverride?: string, contentOverride?: string): void {
    if (!this.textarea && contentOverride === undefined) return;

    const targetDate = dateOverride || state.currentDate;
    const body = contentOverride !== undefined ? contentOverride : (this.textarea ? this.textarea.value : '');

    const existing = getSummary(targetDate) || { date: targetDate } as DiaryEntry;
    const summary: DiaryEntry = { ...existing, updatedAt: Math.floor(Date.now() / 1000) };

    // 更新本地缓存（正文与摘要）
    setCurrentBody(body);
    upsertSummary(summary);

    // 持久化到后端
    void saveEntryByDate(summary, body);
  }

  /** 更新编辑器内容 */
  public update(): void {
    // 在重渲染前，如存在待触发的自动保存，先将当前缓冲区内容保存到上一次渲染的日期，避免误保存到新日期并丢失内容
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
      if (this.textarea) {
        const dateToFlush = this.lastRenderedDate || state.currentDate;
        const contentToFlush = this.textarea.value;
        this.save(dateToFlush, contentToFlush);
      }
    }

    this.render();
  }

  /** 确保当前日期的正文已加载（进入编辑器或切换日期时调用） */
  private async ensureBodyLoaded(date: string): Promise<void> {
    // 如果 lastRenderedDate 变化或当前正文为空，则拉取
    if (this.lastRenderedDate !== date || state.currentBody === null) {
      const body = await getEntryBody(date);
      setCurrentBody(body ?? '');
      // 不直接再次 render，订阅会驱动 update
    }
  }
}

