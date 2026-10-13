"use client";
import { Check } from "lucide-react";
import {
  TASK_COLORS,
  TASK_COLOR_VALUES,
  type TaskColor,
} from "@/lib/task-colors";
export default function ColorPicker({
  value,
  onChange,
  label = "Farbe",
}: {
  value?: TaskColor;
  onChange: (color: TaskColor) => void;
  label?: string;
}) {
  return (
    <fieldset className="color-picker">
      <legend>{label}</legend>
      {TASK_COLOR_VALUES.map((color, index) => (
        <button
          key={color}
          type="button"
          className={`color-swatch color-${color}`}
          aria-label={TASK_COLORS[color]}
          title={`${TASK_COLORS[color]} · ${index === 9 ? 0 : index + 1}`}
          data-shortcut={`Taste ${index === 9 ? 0 : index + 1} · außerhalb der Texteingabe`}
          aria-pressed={(value || "green") === color}
          onClick={() => onChange(color)}
        >
          {(value || "green") === color && <Check size={15} />}
        </button>
      ))}
    </fieldset>
  );
}
