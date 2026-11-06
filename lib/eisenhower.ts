export const quadrants = ["1", "2", "3", "4"] as const;
export type Quadrant = (typeof quadrants)[number];
export function quadrantOf(tags: string[]): Quadrant | undefined {
  return quadrants.find((q) => tags.includes(`q:${q}`));
}
export function withQuadrant(tags: string[], quadrant?: Quadrant) {
  return [...tags.filter((tag) => !/^q:[1-4]$/.test(tag)), ...(quadrant ? [`q:${quadrant}`] : [])];
}
export function parseQuadrant(text: string): { title: string; quadrant?: Quadrant } {
  const title = text.trim();
  const match = title.match(/^(.+?)(?:,\s*|\s+)([1-4])$/s);
  return match?.[1].trim() ? { title: match[1].trim(), quadrant: match[2] as Quadrant } : { title };
}
