export const taskSymbols = {calendar:"📅",book:"📚",sport:"🏃",work:"💼",music:"🎵",food:"🥗",art:"🎨",friends:"☕",bike:"🚲",star:"⭐"} as const;
export function isTaskSymbol(value:string):value is keyof typeof taskSymbols {
  return Object.hasOwn(taskSymbols,value);
}
export function taskSymbolPicture(value:string) {
  return isTaskSymbol(value) ? picture(taskSymbols[value],"#e7eee9") : undefined;
}
function picture(symbol:string,background:string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="${background}"/><circle cx="270" cy="30" r="85" fill="white" opacity=".3"/><circle cx="35" cy="165" r="65" fill="white" opacity=".25"/><text x="160" y="118" text-anchor="middle" font-size="76">${symbol}</text></svg>`);
}
export function taskPicture(title: string, category = "") {
  const rules: [RegExp,string,string][] = [
    [/yoga|medit/i,"🧘","#e9e7f2"], [/fotograf/i,"📷","#e5e8ef"], [/musik|gitar|klavier/i,"🎵","#eee5f2"],
    [/jogg|lauf|sport|fitness|training/i,"🏃","#e5eee4"], [/lern|les|buch|prüf|stud|learning/i,"📚","#e9e7f2"],
    [/arbeit|work|büro|meeting/i,"💼","#e3eaf0"], [/essen|koch|food|mittag/i,"🥗","#f6eadc"],
    [/musik|gitar|klavier|hobb|malen/i,"🎨","#eee5f2"], [/freund|treffen|social|famil/i,"☕","#f5e6eb"],
    [/rad|fahrrad/i,"🚲","#e4eeee"], [/kino|film/i,"🎬","#e5e8ef"], [/schlaf|pause|ruhe/i,"🌙","#e7e8f5"],
  ];
  const [,symbol,background] = rules.find(([pattern]) => pattern.test(title)) || rules.find(([pattern]) => pattern.test(category)) || [null,"📅","#e7eee9"];
  return picture(symbol,background);
}
export const categorySuggestions: Record<string,string[]> = {
  sport:["Joggen","Yoga","Radfahren"], learning:["Lesen","Vokabeln lernen","Prüfung vorbereiten"],
  work:["Projektarbeit","Meeting vorbereiten","E-Mails bearbeiten"], hobbies:["Malen","Musik machen","Fotografieren"],
  food:["Mittagessen kochen","Wochenmenü planen","Einkaufen"], events:["Ins Kino gehen","Ausflug planen","Spazieren gehen"], social:["Freunde treffen","Familie besuchen","Gemeinsam Kaffee trinken"],
};
