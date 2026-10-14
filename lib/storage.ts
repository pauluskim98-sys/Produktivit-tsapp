import { db } from "./db";
export function storageReady() {
  db.exec(
    `CREATE TABLE IF NOT EXISTS StorageItem (id TEXT PRIMARY KEY,parentId TEXT,name TEXT NOT NULL,kind TEXT NOT NULL,mime TEXT NOT NULL DEFAULT '',size INTEGER NOT NULL DEFAULT 0,createdAt TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,content BLOB);`,
  );
}
export function storageItems() {
  storageReady();
  return db
    .prepare(
      "SELECT id,parentId,name,kind,mime,size,createdAt FROM StorageItem WHERE deleted=0 ORDER BY kind DESC,name COLLATE NOCASE",
    )
    .all();
}
export function checkStorageParent(parentId: string | null, id?: string) {
  if (!parentId) return;
  if (
    !db
      .prepare(
        "SELECT id FROM StorageItem WHERE id=? AND kind='folder' AND deleted=0",
      )
      .get(parentId)
  )
    throw new Error("Dieser Ordner ist nicht verfügbar.");
  let p: string | null = parentId;
  const visited = new Set<string>();
  while (p) {
    if (p === id || visited.has(p))
      throw new Error(
        "Ein Ordner kann nicht in sich selbst verschoben werden.",
      );
    visited.add(p);
    p =
      (
        db.prepare("SELECT parentId FROM StorageItem WHERE id=?").get(p) as {
          parentId: string | null;
        }
      )?.parentId || null;
  }
}
