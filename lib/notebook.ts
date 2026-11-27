const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const notePattern = new RegExp(`^note:(root|${uuid}):${uuid}$`);
const folderPattern = new RegExp(`^note-folder:${uuid}$`);

export function notebookFolder(key: string) {
  return notePattern.exec(key)?.[1];
}

export function isNotebookFolder(key: string) {
  return folderPattern.test(key);
}

const columnPattern = new RegExp(`^note-column:${uuid}:(.+)$`);

export function notebookColumnParent(key: string) {
  return columnPattern.exec(key)?.[1];
}

export const dayHeaderNoteKey = (date: string) => `day-header:${date}`;
