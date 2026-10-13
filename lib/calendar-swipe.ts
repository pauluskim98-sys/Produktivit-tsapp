export type SwipeGesture = {
  amount: number;
  lastEvent: number;
  lastDelta: number;
  steps: number;
  changedAt: number;
};
export function emptySwipe(): SwipeGesture {
  return { amount: 0, lastEvent: 0, lastDelta: 0, steps: 0, changedAt: 0 };
}
export function wheelSwipe(gesture: SwipeGesture, delta: number, now: number) {
  if (!delta) return 0;
  const fresh =
    now - gesture.lastEvent > 120 ||
    Math.sign(delta) !== Math.sign(gesture.lastDelta) ||
    (gesture.steps > 0 &&
      now - gesture.changedAt > 90 &&
      Math.abs(delta) >= 18 &&
      Math.abs(delta) > Math.abs(gesture.lastDelta) * 2);
  if (fresh) {
    gesture.amount = 0;
    gesture.steps = 0;
  }
  gesture.lastEvent = now;
  gesture.lastDelta = delta;
  gesture.amount += delta;
  const distance = Math.abs(gesture.amount);
  const steps =
    distance >= 1100 ? 3 : distance >= 640 ? 2 : distance >= 220 ? 1 : 0;
  const change = Math.max(0, steps - gesture.steps);
  if (change) {
    gesture.steps = steps;
    gesture.changedAt = now;
  }
  return Math.sign(delta) * change;
}
