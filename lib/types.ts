import type { TaskColor } from "./task-colors";
export type Priority = "none" | "low" | "medium" | "high";
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}
export interface Todo {
  id: string;
  title: string;
  description: string;
  notes: string;
  done: boolean;
  priority: Priority;
  reminder?: boolean;
  location?: string;
  travelBefore?: number;
  travelAfter?: number;
  travelMode?: "" | "bike" | "transit";
  seriesId?: string;
  color?: TaskColor;
  plannedDate: string | null;
  time: string;
  deadline: string | null;
  duration: number | null;
  tags: string[];
  subtasks: Subtask[];
  position: number;
  createdAt: string;
}
export interface CalendarConnection {
  id: string;
  name: string;
  provider: string;
  sourceType: "url" | "file";
  color: string;
  lastSynced: string;
  lastAttemptAt: string;
  lastError: string;
}
export interface CalendarEvent {
  originalTitle?: string;
  id: string;
  connectionId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  description: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export interface AppState {
  todos: Todo[];
  events: CalendarEvent[];
  connections: CalendarConnection[];
  dayNotes: Record<string, string>;
  aiAvailable: boolean;
}
