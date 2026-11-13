"use client";
import dynamic from "next/dynamic";
const Board = dynamic(() => import("./sketchboard"), {
  ssr: false,
  loading: () => <div style={{ padding: 32 }}>LifeMap wird geöffnet …</div>,
});
export default function SketchboardLoader() {
  return <Board />;
}
