// 日历组件

import { getMonthDates, formatDate, isToday, isSameMonth } from '../utils/date';
import { setState, getSummary, state, toggleTheme, setSummaries } from '../utils/state';
import { listEntriesByMonth } from '../utils/backend';
import { UI } from '../utils/ui';

export class Calendar {
  private container: HTMLElement;
  private year: number;
  private month: number;
  private lastExpanded: boolean = state.calendarExpanded;
  private lastLoadedKey: string | null = null; // 防止同月重复加载

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

    // 分组为每周（7天一组）
    const weeks: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }

    // 查找 currentDate 所在周索引；若不在当前页，使用第一周作为“选中行”，上部分为空
    const idxInDates = dates.findIndex(d => formatDate(d) === state.currentDate);
    const selectedWeekIndex = idxInDates >= 0 ? Math.floor(idxInDates / 7) : 0;
    const topWeeks = weeks.slice(0, selectedWeekIndex);
    const selectedWeek = weeks[selectedWeekIndex] || weeks[0];
    const bottomWeeks = weeks.slice(selectedWeekIndex + 1);

    // 主题图标
    const themeIcon = state.theme === 'dark' ? '☀️' : state.theme === 'light' ? '🌙' : '🔄';
    const themeText = state.theme === 'dark' ? '浅色' : state.theme === 'light' ? '深色' : '自动';

    this.container.innerHTML = `
      <div class="calendar">
        <!-- 月份导航和主题切换 -->
        <div class="flex items-center justify-between mb-4">
          <button id="prev-month"
            class="${UI.ICON_BTN}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 class="${UI.SECTION_HEADER}">
            ${this.year}年${this.month + 1}月
          </h2>
          <div class="flex items-center gap-2">
            <button id="theme-toggle"
              class="${UI.ICON_BTN} text-base"
              title="切换主题 (当前: ${themeText})">
              ${themeIcon}
            </button>
            <button id="next-month"
              class="${UI.ICON_BTN}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 星期标题 -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          ${['一', '二', '三', '四', '五', '六', '日']
        .map(day => `<div class=\"text-center text-xs font-medium py-2 ${UI.MUTED}\">${day}</div>`)
        .join('')}
        </div>

        <!-- 上部分（选中行之上） -->
        <div id="calendar-top" class="grid grid-cols-7 gap-1 mb-1 transition-all duration-300 ease-in-out overflow-hidden">
          ${topWeeks.map(week => week.map(date => this.renderDateCell(date)).join('')).join('')}
        </div>

        <!-- 选中行（始终可见） -->
        <div id="calendar-selected" class="grid grid-cols-7 gap-1 mb-1 transition-all duration-300 ease-in-out">
          ${selectedWeek.map(date => this.renderDateCell(date)).join('')}
        </div>

        <!-- 下部分（选中行之下） -->
        <div id="calendar-bottom" class="grid grid-cols-7 gap-1 transition-all duration-300 ease-in-out overflow-hidden">
          ${bottomWeeks.map(week => week.map(date => this.renderDateCell(date)).join('')).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();

    // 渲染后按需加载摘要（当月，若网格包含上月日期则同时拉取上月）
    void this.ensureMonthSummariesLoaded(dates);

    // 每次渲染后都根据当前状态校正高度；仅在状态变化时执行过渡动画
    const top = this.container.querySelector('#calendar-top') as HTMLElement | null;
    const bottom = this.container.querySelector('#calendar-bottom') as HTMLElement | null;
    if (top && bottom) {
      top.style.overflow = 'hidden';
      bottom.style.overflow = 'hidden';

      if (this.lastExpanded !== isExpanded) {
        this.applySectionHeights(isExpanded);
        this.lastExpanded = isExpanded;
      } else {
        // 状态未变：直接设置目标高度，避免误展示
        if (!isExpanded) {
          top.style.maxHeight = '0px';
          bottom.style.maxHeight = '0px';
        } else {
          top.style.maxHeight = 'none';
          bottom.style.maxHeight = 'none';
        }
      }
    }
  }

  /**
   * 根据当前日历视图按需加载摘要
   * - 始终加载当前月
   * - 若网格包含上月日期，同时加载上月
   */
  private async ensureMonthSummariesLoaded(gridDates: Date[]): Promise<void> {
    if (gridDates.length === 0) return;

    const hasPrevMonthDates = gridDates[0].getMonth() !== this.month || gridDates[0].getFullYear() !== this.year;

    const currentYear = this.year;
    const currentMonth1Based = this.month + 1; // 后端使用 1-12

    let prevYear = currentYear;
    let prevMonth1Based = currentMonth1Based - 1;
    if (prevMonth1Based === 0) {
      prevMonth1Based = 12;
      prevYear -= 1;
    }

    const loadKey = `${currentYear}-${currentMonth1Based}-${hasPrevMonthDates ? 'with-prev' : 'single'}`;
    if (this.lastLoadedKey === loadKey) return; // 已加载，无需重复
    this.lastLoadedKey = loadKey;

    try {
      if (hasPrevMonthDates) {
        const [prevSummaries, currSummaries] = await Promise.all([
          listEntriesByMonth(prevYear, prevMonth1Based),
          listEntriesByMonth(currentYear, currentMonth1Based),
        ]);
        setSummaries([...prevSummaries, ...currSummaries]);
      } else {
        const currSummaries = await listEntriesByMonth(currentYear, currentMonth1Based);
        setSummaries(currSummaries);
      }
    } catch (e) {
      console.error('加载月度摘要失败:', e);
    }
  }

  /** 渲染单个日期单元格 */
  private renderDateCell(date: Date): string {
    const dateStr = formatDate(date);
    const day = date.getDate();
    const isCurrentMonth = isSameMonth(date, this.year, this.month);
    const isTodayDate = isToday(date);
    const isSelected = dateStr === state.currentDate;
    const entry = getSummary(dateStr);
    const hasEntry = !!entry; // 仅根据摘要是否存在标记

    const baseClasses = UI.DATE_CELL;
    const commonText = isCurrentMonth ? 'text-(--color-text-primary)' : 'text-(--color-text-tertiary)';
    const hoverable = isTodayDate ? '' : 'hover:bg-(--color-bg-hover)';

    const todayClasses = 'bg-(--color-primary) text-(--color-text-inverse) font-semibold shadow-sm';
    const selectedClasses = `border-2 border-(--color-primary) text-(--color-text-primary) ${hasEntry ? 'bg-(--color-success-light)' : ''}`;
    const hasEntryClasses = hasEntry && isCurrentMonth ? 'bg-(--color-success-light)' : '';

    // 选中当前日期时增强对比度（白色 Ring）
    const selectedTodayEnhance = isTodayDate && isSelected ? 'border-2 border-white' : '';

    const extraClasses = isTodayDate
      ? `${todayClasses} ${selectedTodayEnhance}`
      : isSelected
        ? selectedClasses
        : hasEntryClasses;

    return `
      <div class="${baseClasses} ${commonText} ${hoverable} ${extraClasses}" data-date="${dateStr}" ${isTodayDate ? 'aria-current="date"' : ''} ${isSelected ? 'aria-selected="true"' : ''} tabindex="0">
        <span class="text-sm font-medium">${day}</span>
        ${entry?.mood ? `<span class="text-xs mt-0.5">${entry.mood}</span>` : ''}
        ${hasEntry && !isTodayDate && !isSelected ? '<div class="absolute bottom-1.5 w-1 h-1 rounded-full bg-(--color-success)"></div>' : ''}
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

    // 日期点击（事件代理）
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('.date-cell') as HTMLElement | null;
      if (cell && this.container.contains(cell)) {
        const dateStr = cell.dataset.date;
        if (dateStr) {
          const d = new Date(dateStr);
          const clickedMonth = d.getMonth();
          const clickedYear = d.getFullYear();
          const monthChanged = clickedMonth !== this.month || clickedYear !== this.year;
          if (monthChanged) {
            // 切换到点击的月份（先更新内部月份，再批量更新状态）
            this.month = clickedMonth;
            this.year = clickedYear;
          }
          // 合并状态更新，减少订阅触发次数；渲染交由订阅方统一调度
          setState({ currentDate: dateStr, viewMode: 'editor' });
        }
      }
    });
  }

  /** 更新日历 */
  public update(): void {
    // 统一整块渲染，利用三段容器+动态高度实现平滑动画
    this.render();
  }

  /** 为上下两部分计算并设置动态高度，避免固定 max-height 带来的闪烁 */
  private applySectionHeights(expanded: boolean): void {
    const top = this.container.querySelector('#calendar-top') as HTMLElement | null;
    const bottom = this.container.querySelector('#calendar-bottom') as HTMLElement | null;
    if (!top || !bottom) return;

    const sections = [top, bottom];
    // 确保参与过渡的属性
    sections.forEach((el) => {
      el.style.overflow = 'hidden';
    });

    if (!expanded) {
      // 折叠：从当前内容高度 -> 0
      sections.forEach((el) => {
        el.style.maxHeight = `${el.scrollHeight}px`;
      });
      // 强制回流以应用起始高度
      sections.forEach((el) => void el.getBoundingClientRect());
      // 再设为 0 触发过渡
      sections.forEach((el) => {
        el.style.maxHeight = '0px';
      });
      return;
    }

    // 展开：0 -> 内容高度，再在过渡结束后置为 none，避免后续内容变化被限制
    sections.forEach((el) => {
      el.style.maxHeight = '0px';
    });
    // 下一帧设置为内容高度
    requestAnimationFrame(() => {
      sections.forEach((el) => {
        const targetHeight = `${el.scrollHeight}px`;
        const onEnd = () => {
          el.style.maxHeight = 'none';
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd, { once: true });
        el.style.maxHeight = targetHeight;
      });
    });
  }

}
