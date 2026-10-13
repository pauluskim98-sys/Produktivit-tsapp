"use client";
import { useEffect, useRef } from "react";
export default function FitTitle({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      for (let size = base; size >= 8; size -= 0.5) {
        el.style.fontSize = `${size}px`;
        if (
          el.scrollWidth <= el.clientWidth + 1 &&
          el.scrollHeight <=
            Math.max(
              10,
              el.parentElement!.clientHeight -
                parseFloat(getComputedStyle(el.parentElement!).paddingTop) -
                parseFloat(getComputedStyle(el.parentElement!).paddingBottom),
            )
        )
          break;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el.parentElement!);
    resize();
    return () => observer.disconnect();
  }, [children]);
  return (
    <strong ref={ref} className="fit-title">
      {children}
    </strong>
  );
}
