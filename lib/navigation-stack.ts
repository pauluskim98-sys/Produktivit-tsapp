export type ViewStep = {
  owner: object;
  back: () => void;
  forward: () => void;
  before: string;
};
export class NavigationStack {
  past: ViewStep[] = [];
  future: ViewStep[] = [];
  push(step: ViewStep) {
    this.past.push(step);
    this.past = this.past.slice(-4);
    this.future = [];
  }
  back(owner?: object) {
    const index = owner
      ? this.past.findLastIndex((s) => s.owner === owner)
      : this.past.length - 1;
    if (index < 0) return false;
    const [step] = this.past.splice(index, 1);
    this.future.push(step);
    step.back();
    return true;
  }
  forward() {
    const step = this.future.pop();
    if (!step) return false;
    this.past.push(step);
    step.forward();
    return true;
  }
  close(owner: object, value: string, closed?: ViewStep) {
    const index = this.past.findLastIndex(
      (s) => s.owner === owner && s.before === value,
    );
    if (index >= 0) {
      const steps = this.past.splice(index);
      if (!closed) this.future.push(...steps.reverse());
    }
    if (closed) this.rememberClosed(closed);
  }
  rememberClosed(step: ViewStep) {
    this.future.push(step);
    this.future = this.future.slice(-4);
  }
  remove(owner: object) {
    this.past = this.past.filter((s) => s.owner !== owner);
    this.future = this.future.filter((s) => s.owner !== owner);
  }
}
