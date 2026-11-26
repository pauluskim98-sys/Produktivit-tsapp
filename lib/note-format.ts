import { noteFonts, type NoteFont } from "./note-todos.ts";

export type NoteRun = {
  text: string;
  font?: NoteFont;
  size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export function validNoteRuns(value: unknown, text: string): NoteRun[] | undefined {
  if (!Array.isArray(value) || value.length > 1500) return undefined;
  const runs: NoteRun[] = [];
  for (const item of value) {
    if (!item || typeof item.text !== "string") return undefined;
    const run: NoteRun = {text:item.text};
    if (typeof item.font === "string" && Object.hasOwn(noteFonts,item.font)) run.font=item.font as NoteFont;
    if (Number.isFinite(item.size) && item.size>=8 && item.size<=48) run.size=item.size;
    if (typeof item.color==="string" && /^#[0-9a-f]{3,8}$|^rgba?\([\d., %]+\)$/i.test(item.color)) run.color=item.color;
    for (const key of ["bold","italic","underline"] as const) {
      if(typeof item[key]==="boolean")run[key]=item[key];
    }
    runs.push(run);
  }
  if (runs.map(run=>run.text).join("") !== text || !runs.some(run=>Object.keys(run).length>1)) return undefined;
  return runs;
}

export function sliceNoteRuns(runs: NoteRun[], start: number, end: number) {
  let offset=0;
  return runs.flatMap(run=>{
    const text=run.text.slice(Math.max(0,start-offset), Math.max(0,end-offset));
    offset+=run.text.length;
    return text ? [{...run,text}] : [];
  });
}
