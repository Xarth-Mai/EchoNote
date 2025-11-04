// 日期工具函数

/** 获取指定月份的所有日期（共42天，周一开始） */
export function getMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // JS: 周日=0..周六=6 -> 周一=0..周日=6
  const firstDayOfWeekMonStart = (firstDay.getDay() + 6) % 7;

  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((firstDayOfWeekMonStart + daysInMonth) / 7) * 7; // 4-6周

  // 填充上月尾部日期（使第一行从周一开始）
  for (let i = firstDayOfWeekMonStart; i > 0; i--) {
    dates.push(new Date(year, month, 1 - i));
  }

  // 当月所有日期
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month, day));
  }

  // 填充下月日期，直到 totalCells
  const remaining = totalCells - dates.length;
  for (let i = 1; i <= remaining; i++) {
    dates.push(new Date(year, month + 1, i));
  }

  return dates;
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 判断是否为今天 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

/** 判断是否为同一个月 */
export function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

