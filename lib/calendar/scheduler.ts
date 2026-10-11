import { syncDueCalendars } from "./sync.ts";
const shared = globalThis as unknown as {
  raumCalendarTimer?: ReturnType<typeof setInterval>;
  raumCalendarTick?: boolean;
};
export function startCalendarScheduler() {
  if (shared.raumCalendarTimer) return;
  const tick = async () => {
    if (shared.raumCalendarTick) return;
    shared.raumCalendarTick = true;
    try {
      await syncDueCalendars();
    } catch {
      /* A temporary database failure is retried on the next tick. */
    } finally {
      shared.raumCalendarTick = false;
    }
  };
  shared.raumCalendarTimer = setInterval(() => {
    void tick();
  }, 60000);
  shared.raumCalendarTimer.unref();
  void tick();
}
