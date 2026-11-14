"use client";
import dynamic from "next/dynamic";
const Board = dynamic(() => import("./sketchboard"), {
  ssr: false,
  loading: () => null,
});
export default function SketchboardLoader() {
  return <Board />;
}
