"use client";
import { useCallback, useLayoutEffect, useRef } from "react";
import { NavigationStack } from "./navigation-stack";
const navigation = new NavigationStack();
export const goBackView = () => navigation.back();
export const goForwardView = () => navigation.forward();
const transientOwner = {};
export function rememberViewChange(back: () => void, forward: () => void) {
  navigation.push({ owner: transientOwner, before: "", back, forward });
}
export function rememberViewClose(back: () => void, forward: () => void) {
  navigation.rememberClosed({
    owner: transientOwner,
    before: "",
    back,
    forward,
  });
}
// Shared view history never changes saved tasks or notes.
export function useViewHistory<T>(
  value: T,
  restore: (value: T) => void,
  ready = true,
  closing?: (before: T, after: T) => boolean,
) {
  const owner = useRef({});
  const current = useRef(value);
  const initialized = useRef(ready);
  const restoring = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const apply = useCallback((view: T) => {
    restoring.current = true;
    restoreRef.current(view);
  }, []);
  useLayoutEffect(() => {
    if (!ready) return;
    if (!initialized.current) {
      initialized.current = true;
      current.current = value;
      return;
    }
    if (JSON.stringify(current.current) === JSON.stringify(value)) return;
    if (restoring.current) restoring.current = false;
    else if (closing?.(current.current, value)) {
      const before = current.current;
      navigation.close(owner.current, JSON.stringify(value), {
        owner: owner.current,
        before: JSON.stringify(value),
        back: () => apply(value),
        forward: () => apply(before),
      });
    } else {
      const before = current.current;
      navigation.push({
        owner: owner.current,
        before: JSON.stringify(before),
        back: () => apply(before),
        forward: () => apply(value),
      });
    }
    current.current = value;
  });
  useLayoutEffect(() => {
    const id = owner.current;
    return () => navigation.remove(id);
  }, []);
  return useCallback(() => navigation.back(owner.current), []);
}
