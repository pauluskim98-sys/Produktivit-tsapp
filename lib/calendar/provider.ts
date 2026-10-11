import type { CalendarEvent } from "../types";
export interface CalendarSource {
  id: string;
  name: string;
  sourceType: "url" | "file";
  source: string;
  color: string;
}
export interface CalendarProvider {
  readonly id: string;
  connect(source: CalendarSource): Promise<CalendarEvent[]>;
  getEvents(source: CalendarSource): Promise<CalendarEvent[]>;
  sync(source: CalendarSource): Promise<CalendarEvent[]>;
  disconnect(source: CalendarSource): Promise<void>;
}
