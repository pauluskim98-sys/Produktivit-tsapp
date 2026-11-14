type Point = [number, number];

export function smoothStroke(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const first = points[0],
    last = points[points.length - 1];
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const closed =
    points.length >= 8 &&
    Math.min(width, height) >= 14 &&
    Math.hypot(last[0] - first[0], last[1] - first[1]) <
      Math.max(10, Math.min(width, height) * 0.22);
  if (closed) {
    const rx = width / 2,
      ry = height / 2,
      cx = left + rx,
      cy = top + ry;
    const unit = points.map(([x, y]) => [(x - cx) / rx, (y - cy) / ry]);
    const mean = (values: number[]) =>
      values.reduce((a, b) => a + b, 0) / values.length;
    const quadrants = new Set(
      unit.map(([x, y]) => (x > 0 ? 1 : 0) + (y > 0 ? 2 : 0)),
    );
    if (quadrants.size === 4) {
      const ellipseError = mean(
        unit.map(([x, y]) => Math.abs(Math.hypot(x, y) - 1)),
      );
      const boxError = mean(
        unit.map(([x, y]) => Math.abs(Math.max(Math.abs(x), Math.abs(y)) - 1)),
      );
      if (boxError < 0.13 && boxError < ellipseError * 0.75)
        return [
          [left, top],
          [left + width, top],
          [left + width, top + height],
          [left, top + height],
          [left, top],
        ];
      if (ellipseError < 0.17)
        return Array.from({ length: 65 }, (_, i) => [
          cx + rx * Math.cos((i * Math.PI) / 32),
          cy + ry * Math.sin((i * Math.PI) / 32),
        ]);
    }
  }
  const result = points.map((point, i): Point => {
    if (i === 0 || i === points.length - 1) return point;
    const neighbors = points.slice(Math.max(0, i - 3), i + 4);
    const total = neighbors.reduce(
      ([x, y], [px, py]) => [x + px, y + py],
      [0, 0],
    );
    return [total[0] / neighbors.length, total[1] / neighbors.length];
  });
  if (closed) result[result.length - 1] = result[0];
  return result;
}
