import { invoke } from '@tauri-apps/api/core';
import type { DiaryEntry as EntrySummary } from '../types';

export async function listEntriesByMonth(
    year: number,
    month: number
): Promise<EntrySummary[]> {
    return await invoke<EntrySummary[]>('list_entries_by_month', { year, month });
}

export async function getEntryBody(date: string): Promise<string | null> {
    return await invoke<string | null>('get_entry_body_by_date', { date });
}

export async function saveEntryByDate(summary: EntrySummary, body: string): Promise<void> {
    await invoke('save_entry_by_date', { entry: summary, body });
}
