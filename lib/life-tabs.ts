import type { LifeState } from "./life";
export const baseLifeTabs = [
  ["todo", "Todo"],
  ["goals", "Ziele"],
  ["food", "Essen"],
  ["events", "Aktivitäten"],
  ["social", "Beziehungen"],
  ["sport", "Sport"],
  ["weather", "Wetter"],
];
export function lifeTabs(life: LifeState): string[][] {
  const tabs = [
    ...baseLifeTabs,
    ...life.rhythms.filter((r) => !r.tabId).map((r) => [r.id, r.name]),
  ];
  const rank = (id: string) =>
    life.tabOrder.includes(id)
      ? life.tabOrder.indexOf(id)
      : life.tabOrder.length + tabs.findIndex((t) => t[0] === id);
  return tabs
    .filter(([id]) => !life.hidden.includes(id))
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([id, name]) => [id, life.labels[id] || name]);
}
