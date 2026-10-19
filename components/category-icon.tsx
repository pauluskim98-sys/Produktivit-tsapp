import {
  ListTodo,
  Target,
  Utensils,
  CalendarDays,
  Heart,
  Dumbbell,
  CloudSun,
  Bookmark,
} from "lucide-react";
export const categoryIcons: Record<string, typeof Bookmark> = {
  todo: ListTodo,
  goals: Target,
  food: Utensils,
  events: CalendarDays,
  social: Heart,
  sport: Dumbbell,
  weather: CloudSun,
};
export default function CategoryIcon({
  id,
  size = 15,
}: {
  id: string;
  size?: number;
}) {
  const Icon = categoryIcons[id] || Bookmark;
  return <Icon size={size} aria-hidden="true" />;
}
