import { invoke } from '@tauri-apps/api/core';
import type { DiaryEntry as EntrySummary } from '../types';

/**
 * 获取指定年份和月份的日记条目摘要（不包含正文内容，仅返回 frontmatter）
 * @param year - 年份（如 2025）
 * @param month - 月份（1-12，自然月）
 * @returns 返回该月所有日记 frontmatter 的摘要数据，按天组成的数组
 */
export async function listEntriesByMonth(
    year: number,
    month: number
): Promise<EntrySummary[]> {
    // 调用 Tauri 后端对应的 Rust 命令：list_entries_by_month
    // 注意 month 需为 1-12 的自然月数
    return await invoke<EntrySummary[]>('list_entries_by_month', { year, month });
}

/**
 * 根据日期获取指定日记正文内容
 * @param date - YYYY-MM-DD（唯一标识）
 * @returns 正文内容（Markdown 字符串）。若找不到则返回 null
 */
export async function getEntryBody(date: string): Promise<string | null> {
    // 调用 Tauri 后端：get_entry_body_by_date
    return await invoke<string | null>('get_entry_body_by_date', { date });
}

/**
 * 根据日期保存/更新日记内容
 * @param summary - 日记元数据
 * @param body - 日记正文内容
 * @returns Promise<void> 无返回值，异常请自行捕获
 */
export async function saveEntryByDate(summary: EntrySummary, body: string): Promise<void> {
    // 调用 Tauri 后端 Rust：save_entry_by_date（前端不处理 frontmatter）
    await invoke('save_entry_by_date', { entry: summary, body });
}
