// 最小 UI 类名常量（Tailwind 原子类 + 主题变量）

export const UI = {
    // 文字按钮（幽灵）
    BTN_GHOST:
        'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)',

    // 圆形图标按钮
    ICON_BTN:
        'w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)',

    // 通用卡片
    CARD:
        'rounded-xl border border-(--color-border-primary) bg-(--color-bg-primary) transition hover:shadow-md hover:border-(--color-primary)',

    // 小标题/节标题
    SECTION_HEADER: 'text-base font-semibold tracking-tight text-(--color-text-primary)',

    // 次级文本
    MUTED: 'text-(--color-text-secondary)',

    // 日历格子基础
    DATE_CELL:
        'date-cell aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 relative select-none',

    // 时间线：内容预览
    ENTRY_PREVIEW:
        'text-sm leading-relaxed line-clamp-3 text-(--color-text-primary) opacity-80',

    // 时间线：AI 摘要块
    ENTRY_SUMMARY:
        'mt-3 px-3 py-2 rounded-lg text-xs leading-relaxed bg-(--color-primary-light) border border-(--color-border-secondary) text-(--color-text-primary) opacity-70',

    // 时间线：AI 摘要图标
    ENTRY_SUMMARY_ICON: 'text-(--color-primary)',
};
