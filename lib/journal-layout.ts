import { isDateKey } from "./dates.ts";
import { moodColors, type NotebookMood } from "./notebook-layout.ts";

export type JournalField = { id: string; title: string };
export type JournalLayout = { day?: JournalField[]; future?: JournalField[] };

export const journalPageKey = (date: string) => `journal:${date}`;
export const journalLayoutKey = (date: string) => `journal-layout:${date}`;
export const journalMoodKey = (date: string) => `journal-mood:${date}`;
export const journalFieldKey = (date: string, id: string) => `journal-field:${id}:${date}`;

export function isJournalKey(key: string): boolean {
  const pattern = /^(?:journal|journal-layout|journal-mood|journal-field:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}):(\d{4}-\d{2}-\d{2})$/i;
  return key === "journal-bookmarks" || isDateKey(pattern.exec(key)?.[1]);
}

export function readJournalLayout(value?: string): JournalLayout {
  if (!value) return {};
  try {
    const data = JSON.parse(value);
    const fields = (list: unknown) => Array.isArray(list)
      ? list.filter(field => field && typeof field.id === "string" && typeof field.title === "string") as JournalField[]
      : undefined;
    return { day: fields(data?.day), future: fields(data?.future) };
  } catch {
    return {};
  }
}

export function journalFieldsFor(notes: Record<string, string>, date: string): JournalField[] {
  const exact = readJournalLayout(notes[journalLayoutKey(date)]);
  if (exact.day || exact.future) return exact.day ?? exact.future ?? [];
  for (const key of Object.keys(notes).filter(key => key.startsWith("journal-layout:") && key < journalLayoutKey(date)).sort().reverse()) {
    const future = readJournalLayout(notes[key]).future;
    if (future) return future;
  }
  return [];
}

export function readJournalMood(date: string, value: string): NotebookMood | undefined {
  try {
    const mood = JSON.parse(value);
    if (mood?.date === date && Number.isInteger(mood.score) &&
      mood.score >= 0 && mood.score < moodColors.length && typeof mood.reason === "string") return mood;
  } catch {}
}
