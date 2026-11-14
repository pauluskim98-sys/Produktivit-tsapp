// Touchpads report two-finger movement as a burst of pixel wheel events.
export function listenForViewSwipe(
  direction: 1 | -1,
  navigate: () => void,
  allowed: (event: WheelEvent) => boolean,
) {
  let total = 0,
    last = 0,
    count = 0;
  const wheel = (event: WheelEvent) => {
    if (
      event.ctrlKey ||
      event.deltaMode !== 0 ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
      Math.sign(event.deltaY) !== direction ||
      !allowed(event) ||
      (event.target instanceof Element &&
        event.target.closest(
          "textarea,input,select,[contenteditable],.lm-settings,.lm-notepad,.calendar-bottom-notes",
        ))
    ) {
      total = 0;
      count = 0;
      return;
    }
    const now = performance.now();
    if (now - last > 160) {
      total = 0;
      count = 0;
    }
    last = now;
    total += Math.abs(event.deltaY);
    count++;
    if (total >= 170 && count >= 3) {
      total = 0;
      count = 0;
      navigate();
    }
  };
  window.addEventListener("wheel", wheel, { capture: true, passive: true });
  return () => window.removeEventListener("wheel", wheel, true);
}
