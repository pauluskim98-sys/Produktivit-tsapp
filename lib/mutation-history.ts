import { isDeepStrictEqual } from "node:util";

export function mutationResponse<T>(data:T, change:{before:unknown;after:unknown} & Record<string,unknown>) {
  if(isDeepStrictEqual(JSON.parse(JSON.stringify(change.before)),JSON.parse(JSON.stringify(change.after))))return Response.json(data);
  return Response.json({...data,historyChange:change},{headers:{"X-Lifemap-History":"change"}});
}

export function historyValues(change:{before:unknown;after:unknown}, redo:unknown, current:unknown) {
  if(typeof redo!=="boolean" || !change)throw new Error("Ungültiger Verlaufseintrag.");
  const expected=redo?change.before:change.after;
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(current)),expected))throw new Error("Der Eintrag wurde inzwischen geändert.");
  return redo?change.after:change.before;
}
