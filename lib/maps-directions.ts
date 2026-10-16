import { isDateKey } from "./dates.ts";
/** Maps desktop data links encode local wall-clock time as a UTC-shaped timestamp. */
export function mapsDirections(
  origin: string,
  destination: string,
  mode: "bike" | "transit",
  day: string | null,
  time: string,
  returnTrip = false,
  duration = 60,
) {
  if (
    mode === "transit" &&
    day &&
    isDateKey(day) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    const wall =
      Date.parse(`${day}T${time}:00Z`) + (returnTrip ? duration * 60000 : 0);
    return `https://www.google.com/maps/dir/${encodeURIComponent(returnTrip ? destination : origin)}/${encodeURIComponent(returnTrip ? origin : destination)}/data=!4m6!4m5!2m3!6e${returnTrip ? 0 : 1}!7e2!8j${Math.floor(wall / 1000)}!3e3`;
  }
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", origin: returnTrip ? destination : origin, destination: returnTrip ? origin : destination, travelmode: mode === "bike" ? "bicycling" : "transit" })}`;
}
