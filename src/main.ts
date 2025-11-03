// EchoNote 前端入口文件

import { Calendar } from './components/Calendar';
import { Editor } from './components/Editor';
import { Timeline } from './components/Timeline';
import { state, subscribe, initLayoutListener, setCalendarExpanded, initThemeListener } from './utils/state';

// 组件实例（单例，复用于横竖屏）
let calendar: Calendar;
let editor: Editor;
let timeline: Timeline;

window.addEventListener("DOMContentLoaded", () => {
  // 目前仅支持中文，后续可增加多语言支持 // TODO: 支持多语言
  document.documentElement.lang = 'zh-CN';

  // 初始化主题
  initThemeListener();

  // 初始化组件
  initComponents();

  // 初始化布局监听
  initLayoutListener();

  // 订阅状态变更
  subscribe((newState) => {
    updateLayout(newState.layoutMode, newState.viewMode, newState.editorFullscreen);
    updateToggleButton(newState.calendarExpanded);

    // 主题变化时重新渲染日历（更新主题图标）
    if (newState.theme) {
      calendar.update();
    }

    // 更新组件
    if (newState.viewMode === 'editor') {
      editor.update();
      // 横屏模式下，即使在编辑器视图也要更新日历（因为日历在左侧可见）
      if (newState.layoutMode === 'landscape' && !newState.editorFullscreen) {
        calendar.update();
        timeline.update();
      }
    } else {
      // home 模式：更新日历和时间线
      calendar.update();
      timeline.update();
    }
  });

  // 初始化视图
  updateLayout(state.layoutMode, state.viewMode, state.editorFullscreen);

  // 初始化展开/收起按钮
  initToggleButtons();
});

/** 初始化组件 */
function initComponents(): void {
  const calendarContainer = document.getElementById('calendar-container');
  const editorContainer = document.getElementById('editor-container');
  const timelineContainer = document.getElementById('timeline-container');

  if (calendarContainer && editorContainer && timelineContainer) {
    calendar = new Calendar(calendarContainer);
    editor = new Editor(editorContainer);
    timeline = new Timeline(timelineContainer);
  }
}

/** 更新布局 - 统一处理横竖屏和视图切换 */
function updateLayout(
  layoutMode: 'portrait' | 'landscape',
  viewMode: 'home' | 'editor',
  editorFullscreen: boolean
): void {
  const app = document.getElementById('app');
  const homePanel = document.getElementById('home-panel');
  const editorPanel = document.getElementById('editor-panel');

  if (!app || !homePanel || !editorPanel) return;

  // 重置布局类（保留基础类）
  app.className = 'h-full';
  homePanel.className = 'h-full flex flex-col';
  editorPanel.className = 'h-full';

  if (layoutMode === 'portrait') {
    // 竖屏：单视图切换
    if (viewMode === 'home') {
      editorPanel.classList.add('hidden');
    } else {
      homePanel.classList.add('hidden');
    }
  } else {
    // 横屏：分屏布局
    app.classList.add('flex');

    if (editorFullscreen) {
      // 全屏模式：只显示编辑器，编辑器占满全宽
      homePanel.classList.add('hidden');
      editorPanel.classList.add('flex-1');
    } else {
      // 分屏模式：左侧主页 + 右侧编辑器
      homePanel.classList.add('w-21/55', 'border-r');
      editorPanel.classList.add('flex-1');
    }
  }
}

/** 初始化展开/收起按钮 */
function initToggleButtons(): void {
  const toggleBtn = document.getElementById('toggle-calendar-btn');
  toggleBtn?.addEventListener('click', () => {
    setCalendarExpanded(!state.calendarExpanded);
  });
}

/** 更新展开/收起按钮状态 */
function updateToggleButton(isExpanded: boolean): void {
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');
  if (toggleIcon && toggleText) {
    toggleIcon.textContent = isExpanded ? '▲' : '▼';
    toggleText.textContent = isExpanded ? '收起日历' : '展开日历';
  }
}
