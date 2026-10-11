import type { CalendarEvent } from "./types";
const subjects: [RegExp, string, string][] = [
  [/\b(allgemeinmedizin|loma)\b/i, "Allgemeinmedizin", "#50a19c"],
  [/\b(soziolog\w*)\b/i, "Soziologie", "#c47fa9"],
  [/\b(kiss?|punktion\w*)\b/i, "Klinische Fertigkeiten", "#bb9460"],
  [/\b(biochemie|biochemistry)\b/i, "Biochemie", "#e78043"],
  [/\b(physik|physics)\b/i, "Physik", "#5391c9"],
  [/\b(chemie|chemistry)\b/i, "Chemie", "#9772c8"],
  [/\b(anatomie|anatomy)\b/i, "Anatomie", "#d86e83"],
  [/\b(neuro\w*|neurowissenschaft\w*)\b/i, "Neurowissenschaften", "#6982ca"],
  [/\b(biolog\w*|genetik|ecology)\b/i, "Biologie", "#51a17a"],
  [/\b(mathemat\w*|mathe|analysis|algebra)\b/i, "Mathematik", "#d59e42"],
  [/\b(statistik|statistics|datenanalyse)\b/i, "Statistik", "#7c90a8"],
  [
    /\b(informatik|computer science|programmier\w*)\b/i,
    "Informatik",
    "#4da2a6",
  ],
  [/\b(medizin|medizin\w*|pharmak\w*)\b/i, "Medizin", "#bf738d"],
  [/\b(physiolog\w*)\b/i, "Physiologie", "#58a89c"],
  [/\b(psycholog\w*)\b/i, "Psychologie", "#aa7fc0"],
  [/\b(linguistik|sprach\w*|literatur|germanistik)\b/i, "Sprachen", "#647ec3"],
  [
    /\b(seminar|tutorium|übung|uebung|praktikum|vorlesung)\b/i,
    "Lehrveranstaltung",
    "#738376",
  ],
];
export function eventPresentation(event: CalendarEvent, fallback = "#708078") {
  // Course titles take precedence: descriptions often mention other disciplines.
  const specific = subjects.filter(
    ([, label]) => label !== "Lehrveranstaltung",
  );
  const hit = specific.find(([pattern]) => pattern.test(event.title));
  if (hit) return { label: hit[1], color: hit[2] };
  if (/kompetenzfeld/i.test(event.title)) {
    const course = event.title
      .replace(/\s+(VO|SE|PR|KS|AG)\b.*$/i, "")
      .replace(/\s+\d+$/, "")
      .trim();
    const colors = [
      "#da7951",
      "#769c55",
      "#a36ca9",
      "#5487ba",
      "#b59643",
      "#5aa5a0",
    ];
    const hash = Array.from(course).reduce(
      (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
      0,
    );
    return { label: course, color: colors[hash % colors.length] };
  }
  return { label: "", color: fallback };
}
