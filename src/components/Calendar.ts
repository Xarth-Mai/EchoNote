// 日历组件

import { getMonthDates, formatDate, isToday, isSameMonth } from '../utils/date';
import { setCurrentDate, setViewMode, getEntry, state, toggleTheme } from '../utils/state';

export class Calendar {
  private container: HTMLElement;
  private year: number;
  private month: number;

  constructor(container: HTMLElement) {
    this.container = container;
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.render();
  }

  /** 渲染日历 */
  private render(): void {
    const dates = getMonthDates(this.year, this.month);
    const isExpanded = state.calendarExpanded;

    // 获取第一周的日期（前7个）
    const firstWeekDates = dates.slice(0, 7);
    // 获取剩余的日期
    const remainingDates = dates.slice(7);

    // 主题图标
    const themeIcon = state.theme === 'dark' ? '☀️' : state.theme === 'light' ? '🌙' : '🔄';
    const themeText = state.theme === 'dark' ? '浅色' : state.theme === 'light' ? '深色' : '自动';

    this.container.innerHTML = `
      <div class="calendar">
        <!-- 月份导航和主题切换 -->
        <div class="flex items-center justify-between mb-4">
          <button id="prev-month"
            class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200"
            style="color: var(--color-primary); background-color: transparent;"
            onmouseover="this.style.backgroundColor='var(--color-primary-hover)'"
            onmouseout="this.style.backgroundColor='transparent'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 class="text-base font-semibold tracking-tight" style="color: var(--color-text-primary);">
            ${this.year}年${this.month + 1}月
          </h2>
          <div class="flex items-center gap-2">
            <button id="theme-toggle"
              class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 text-base"
              style="color: var(--color-primary); background-color: transparent;"
              onmouseover="this.style.backgroundColor='var(--color-primary-hover)'"
              onmouseout="this.style.backgroundColor='transparent'"
              title="切换主题 (当前: ${themeText})">
              ${themeIcon}
            </button>
            <button id="next-month"
              class="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200"
              style="color: var(--color-primary); background-color: transparent;"
              onmouseover="this.style.backgroundColor='var(--color-primary-hover)'"
              onmouseout="this.style.backgroundColor='transparent'">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 星期标题 -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          ${['日', '一', '二', '三', '四', '五', '六']
        .map(day => `<div class="text-center text-xs font-medium py-2" style="color: var(--color-text-secondary);">${day}</div>`)
        .join('')}
        </div>

        <!-- 第一周日期 -->
        <div class="grid grid-cols-7 gap-1 mb-1">
          ${firstWeekDates.map(date => this.renderDateCell(date)).join('')}
        </div>

        <!-- 剩余日期（可折叠） -->
        <div id="calendar-expandable" class="transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}">
          <div class="grid grid-cols-7 gap-1">
            ${remainingDates.map(date => this.renderDateCell(date)).join('')}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /** 渲染单个日期单元格 */
  private renderDateCell(date: Date): string {
    const dateStr = formatDate(date);
    const day = date.getDate();
    const isCurrentMonth = isSameMonth(date, this.year, this.month);
    const isTodayDate = isToday(date);
    const isSelected = dateStr === state.currentDate;
    const entry = getEntry(dateStr);
    const hasEntry = entry && entry.content.trim().length > 0;

    const baseClasses = 'date-cell aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative';

    // 根据状态设置样式（优先级：今日 > 选中 > 有日记 > 非当月 > 普通）
    let inlineStyle = '';
    let extraClasses = '';

    if (isTodayDate) {
      // 今日高亮
      inlineStyle = `background-color: var(--color-primary); color: var(--color-text-inverse);`;
      extraClasses = 'font-semibold shadow-sm';
    } else if (isSelected) {
      // 选中状态：边框高亮
      inlineStyle = `border: 2px solid var(--color-primary); color: var(--color-text-primary);`;
      extraClasses = 'font-semibold';
      if (hasEntry) {
        inlineStyle += ` background-color: var(--color-success-light);`;
      }
    } else if (hasEntry && isCurrentMonth) {
      // 有日记的日期
      inlineStyle = `background-color: var(--color-success-light);`;
    } else if (!isCurrentMonth) {
      // 非当月日期
      inlineStyle = `color: var(--color-text-tertiary);`;
    } else {
      // 普通日期
      inlineStyle = `color: var(--color-text-primary);`;
    }

    const classes = `${baseClasses} ${extraClasses}`;
    const hoverStyle = isTodayDate ? '' : 'onmouseover="this.style.backgroundColor=\'var(--color-bg-hover)\'" onmouseout="this.style.backgroundColor=\'\'"';

    return `
      <div class="${classes}" style="${inlineStyle}" ${hoverStyle} data-date="${dateStr}">
        <span class="text-sm font-medium">${day}</span>
        ${entry?.mood ? `<span class="text-xs mt-0.5">${entry.mood}</span>` : ''}
        ${hasEntry && !isTodayDate && !isSelected ? '<div class="absolute bottom-1.5 w-1 h-1 rounded-full" style="background-color: var(--color-success);"></div>' : ''}
      </div>
    `;
  }

  /** 绑定事件监听器 */
  private attachEventListeners(): void {
    // 主题切换
    this.container.querySelector('#theme-toggle')?.addEventListener('click', () => {
      toggleTheme();
    });

    // 上一月
    this.container.querySelector('#prev-month')?.addEventListener('click', () => {
      this.month--;
      if (this.month < 0) {
        this.month = 11;
        this.year--;
      }
      this.render();
    });

    // 下一月
    this.container.querySelector('#next-month')?.addEventListener('click', () => {
      this.month++;
      if (this.month > 11) {
        this.month = 0;
        this.year++;
      }
      this.render();
    });

    // 日期点击
    this.container.querySelectorAll('.date-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const date = target.dataset.date;
        if (date) {
          setCurrentDate(date);
          setViewMode('editor');
        }
      });
    });
  }

  /** 更新日历 */
  public update(): void {
    this.render();
  }
}

