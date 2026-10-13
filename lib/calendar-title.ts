import { eventBlockTitle } from "./subjects";
const names: [RegExp, string][] = [
  [/Biochemie/gi, "BC"],
  [/Physik/gi, "Phy"],
  [/Physiologie/gi, "Physio"],
  [/Anatomie/gi, "Ana"],
  [/Allgemeinmedizin/gi, "Allg. Med."],
  [/Neurowissenschaften/gi, "Neuro"],
  [/Klinische Fertigkeiten/gi, "Klin. Fert."],
  [/Chemie/gi, "Chem"],
  [/Biologie/gi, "Bio"],
  [/Mathematik/gi, "Mathe"],
  [/Vorlesung/gi, "VL"],
  [/Kleingruppe/gi, "KG"],
  [/Seminar/gi, "Sem."],
  [/Praktikum/gi, "Prakt."],
  [/Übung/gi, "Üb."],
];
export function calendarTitle(title: string) {
  let short = eventBlockTitle(title);
  for (const [pattern, replacement] of names)
    short = short.replace(pattern, replacement);
  short = short.replace(/Treffen mit /i, "Treffen · ");
  return short.length > 22 ? short.slice(0, 21).trimEnd() + "…" : short;
}
