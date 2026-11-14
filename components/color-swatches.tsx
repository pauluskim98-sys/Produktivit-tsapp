"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const defaults = ["#30333b", "#7155b6", "#438265", "#cf645d", "#ffffff"];
const hues = [0, 26, 51, 95, 151, 183, 215, 258, 290, 330];
function hex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  return (
    "#" +
    [0, 8, 4]
      .map((n) => {
        const k = (n + h / 30) % 12;
        return Math.round(
          255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
        )
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
const colors = [
  ...Array.from({ length: 10 }, (_, i) => hex(0, 0, 0.06 + i * 0.1)),
  ...[0.88, 0.74, 0.6, 0.47, 0.33, 0.21].flatMap((l) =>
    hues.map((h) => hex(h, 0.62, l)),
  ),
];

export default function ColorSwatches({
  name,
  value,
  onChange,
  presets = defaults,
  compactBackground = false,
}: {
  name: string;
  value?: string;
  onChange: (event: { target: { value: string } }) => void;
  presets?: string[];
  compactBackground?: boolean;
}) {
  const key = "lifemap-color-presets:" + name;
  const [favorites, setFavorites] = useState(presets.slice(0, 5));
  const [panel, setPanel] = useState<{
    x: number;
    y: number;
    slot: number | null;
  } | null>(null);
  const [custom, setCustom] = useState(false);
  const popup = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        Array.isArray(saved) &&
        saved.length === 5 &&
        saved.every((c) => /^#[0-9a-f]{6}$/i.test(c))
      )
        setFavorites(saved);
    } catch {}
  }, [key]);
  useEffect(() => {
    if (!panel) return;
    const close = (e: PointerEvent) => {
      if (!popup.current?.contains(e.target as Node)) setPanel(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);
  const open = (target: HTMLElement, slot: number | null) => {
    const rect = target.getBoundingClientRect();
    setCustom(false);
    setPanel({
      x: Math.max(8, Math.min(innerWidth - 280, rect.left)),
      y: Math.max(8, Math.min(innerHeight - 290, rect.bottom + 6)),
      slot,
    });
  };
  const choose = (color: string) => {
    if (panel?.slot != null) {
      const next = favorites.map((c, i) => (i === panel.slot ? color : c));
      setFavorites(next);
      localStorage.setItem(key, JSON.stringify(next));
    }
    onChange({ target: { value: color } });
  };
  return (
    <span className="color-swatches" role="group" aria-label={name}>
      {!compactBackground &&
        favorites.map((color, i) => (
          <button
            type="button"
            key={i}
            className="color-dot"
            style={{ background: color }}
            title={color + " · Doppelklick zum Ändern"}
            aria-label={name + " " + color}
            aria-pressed={value === color}
            onClick={() => onChange({ target: { value: color } })}
            onDoubleClick={(e) => open(e.currentTarget, i)}
          />
        ))}
      <button
        type="button"
        className="color-more"
        title={compactBackground ? name : "Weitere Farben"}
        aria-label={name + " – weitere Farben"}
        aria-expanded={!!panel}
        style={
          compactBackground
            ? { background: value || "transparent" }
            : value && !favorites.includes(value)
              ? { boxShadow: "inset 0 0 0 2px " + value }
              : undefined
        }
        onClick={(e) => open(e.currentTarget, null)}
      >
        {compactBackground ? "A" : "+"}
      </button>
      {panel &&
        createPortal(
          <span
            ref={popup}
            className="color-popup"
            role="dialog"
            aria-label={name}
            style={{ left: panel.x, top: panel.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <strong>
              {panel.slot === null ? "Weitere Farben" : "Vorauswahl ersetzen"}
            </strong>
            <span className="color-grid">
              {colors.map((color, i) => (
                <button
                  type="button"
                  key={i}
                  className="color-dot"
                  title={color}
                  aria-label={color}
                  style={{ background: color }}
                  onClick={() => {
                    choose(color);
                    setPanel(null);
                  }}
                />
              ))}
            </span>
            {compactBackground && (
              <button
                type="button"
                onClick={() => {
                  choose("transparent");
                  setPanel(null);
                }}
              >
                Transparent
              </button>
            )}
            {custom ? (
              <input
                type="color"
                aria-label="Individuelle Farbe"
                value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#30333b"}
                onChange={(e) => choose(e.target.value)}
              />
            ) : (
              <button
                type="button"
                className="color-custom"
                onClick={() => setCustom(true)}
              >
                Individuelle Farbe
              </button>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
