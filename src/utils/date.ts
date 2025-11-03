// 日期工具函数

/** 获取指定月份的所有日期 */
export function getMonthDates(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // 添加上月末尾的日期（填充第一周）
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    dates.push(date);
  }
  
  // 添加当月所有日期
  for (let day = 1; day <= lastDay.getDate(); day++) {
    dates.push(new Date(year, month, day));
  }
  
  // 添加下月开头的日期（填充最后一周）
  const remainingDays = 42 - dates.length; // 6周 * 7天
  for (let i = 1; i <= remainingDays; i++) {
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

