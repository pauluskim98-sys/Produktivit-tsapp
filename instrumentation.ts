export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startCalendarScheduler } = await import("./lib/calendar/scheduler");
    startCalendarScheduler();
  }
}
