// 时间线组件

import { getAllEntries, setState } from '../utils/state';
import { UI } from '../utils/ui';
import type { DiaryEntry } from '../types';

export class Timeline {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /** 渲染时间线 */
  private render(): void {
    const entries = getAllEntries();

    this.container.innerHTML = `
      <div class="timeline h-full flex flex-col">
        <!-- 条目列表 -->
        <div class="flex-1 overflow-y-auto px-3 py-2">
          ${entries.length > 0
        ? entries.map(entry => this.renderEntry(entry)).join('')
        : '<div class="p-12 text-center text-(--color-text-secondary)">暂无日记</div>'
      }
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /** 渲染单个条目 */
  private renderEntry(entry: DiaryEntry): string {
    const preview = this.getPreview(entry.content);
    const date = new Date(entry.date);
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];

    return `
      <div class="entry-item mb-2 p-4 backdrop-blur-md cursor-pointer ${UI.CARD}"
           data-date="${entry.date}">
        <!-- 日期和心情 -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-(--color-text-primary)">${dateStr}</span>
            <span class="text-xs ${UI.MUTED}">${weekday}</span>
          </div>
          ${entry.mood ? `<span class="text-xl">${entry.mood}</span>` : ''}
        </div>

        <!-- 内容预览 -->
        <div class="${UI.ENTRY_PREVIEW}">
          ${preview}
        </div>

        <!-- AI 摘要 -->
        ${entry.aiSummary
        ? `<div class="${UI.ENTRY_SUMMARY}">
               <span class="${UI.ENTRY_SUMMARY_ICON}">💡</span> ${entry.aiSummary}
             </div>`
        : ''
      }
      </div>
    `;
  }

  /** 获取内容预览 */
  private getPreview(content: string): string {
    if (!content) return '空白日记';

    // 移除 Markdown 标记
    const plain = content
      .replace(/^#+\s+/gm, '') // 标题
      .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
      .replace(/\*(.+?)\*/g, '$1') // 斜体
      .replace(/`(.+?)`/g, '$1') // 代码
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 链接
      .trim();

    return plain.length > 100 ? plain.slice(0, 100) + '...' : plain;
  }

  /** 绑定事件监听器 */
  private attachEventListeners(): void {
    // 条目点击（事件代理）
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('.entry-item') as HTMLElement | null;
      if (item && this.container.contains(item)) {
        const date = item.dataset.date;
        if (date) {
          setState({ currentDate: date, viewMode: 'editor' });
        }
      }
    });
  }

  /** 更新时间线 */
  public update(): void {
    this.render();
  }
}

