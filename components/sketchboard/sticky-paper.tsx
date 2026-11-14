import type { ShapeData } from "@/lib/sketchboard";

export const stickyStyles = {
  pin: "Pinnadel",
  spiral: "Spiralblock",
  stack: "Papierstapel",
  heart: "Herz",
  clip: "Klammer",
  punched: "Lochrand",
  scallop: "Wellenrand",
  frame: "Rahmen",
  circle: "Rund",
} as const;

export function StickyPaper({
  paper,
  className,
}: {
  paper: Pick<ShapeData, "fill" | "stickyStyle" | "stickyMask" | "paper">;
  className?: string;
}) {
  const style = paper.stickyStyle ?? "pin";
  if (paper.stickyMask)
    return (
      <span
        className={className}
        style={{
          background: paper.fill,
          maskImage: `url("${paper.stickyMask}")`,
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        }}
      />
    );
  const outline =
    style === "heart"
      ? "M50 94C36 84 3 61 3 33C3 7 34 0 50 25C66 0 97 7 97 33C97 61 64 84 50 94Z"
      : style === "scallop"
        ? "M13 9Q8 0 20 5H83Q95 0 93 13Q102 20 94 28V77Q102 90 92 92Q89 103 78 94H21Q9 103 8 92Q0 88 6 77V24Q-2 13 13 9Z"
        : style === "circle"
          ? "M50 3A47 47 0 1 0 50 97A47 47 0 1 0 50 3Z"
          : style === "pin" || style === "clip"
            ? "M6 8H79L94 23V94Q50 99 5 95Z"
            : "M7 8H94V94H7Z";
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {(style === "stack" || style === "clip") && (
        <path
          d="M10 13L97 10L96 98L3 96Z"
          fill={paper.fill}
          stroke="#41364c"
          strokeOpacity=".25"
        />
      )}
      <path
        d={outline}
        fill={paper.fill}
        stroke="#473c50"
        strokeOpacity=".24"
      />
      {paper.paper !== "plain" &&
        (paper.paper === "lines" ||
          paper.paper === "grid" ||
          style === "spiral") && (
          <path
            d={
              Array.from({ length: 5 }, (_, i) => `M20 ${25 + i * 12}H80`).join(
                " ",
              ) +
              (paper.paper === "grid"
                ? " M32 25V73 M44 25V73 M56 25V73 M68 25V73"
                : "")
            }
            stroke="#473c50"
            strokeOpacity=".18"
            fill="none"
          />
        )}
      {style === "pin" && (
        <>
          <path d="M79 8L77 25L94 23Z" fill="#000" opacity=".13" />
          <path d="M51 9L48 21" stroke="#43475d" strokeWidth="2" />
          <circle cx="53" cy="7" r="6" fill="#52659a" />
        </>
      )}
      {(style === "spiral" || style === "punched") &&
        Array.from({ length: 6 }, (_, i) => (
          <circle
            key={i}
            cx={18 + i * 12}
            cy="13"
            r="2.5"
            fill="#493c55"
            opacity=".55"
          />
        ))}
      {style === "clip" && (
        <>
          <rect x="37" y="4" width="26" height="13" rx="2" fill="#413b4e" />
          <path
            d="M44 12L42 5Q40 0 50 1Q60 0 58 5L56 12"
            fill="none"
            stroke="#c9c6ce"
            strokeWidth="1.4"
          />
        </>
      )}
      {["heart", "scallop", "punched", "stack"].includes(style) && (
        <path d="M68 10L94 5L97 17L71 22Z" fill="#fff3" stroke="#fff7" />
      )}
      {style === "frame" && (
        <>
          <rect
            x="14"
            y="17"
            width="73"
            height="68"
            rx="2"
            fill="#fff"
            opacity=".45"
          />
          <path d="M19 4H32V28L25 23L19 28Z" fill="#8b557a" />
        </>
      )}
      {style === "circle" && (
        <circle
          cx="50"
          cy="50"
          r="41"
          stroke="#493c55"
          strokeOpacity=".36"
          strokeDasharray="3 3"
          fill="none"
        />
      )}
    </svg>
  );
}
