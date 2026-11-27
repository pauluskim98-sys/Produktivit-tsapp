import { accountRoute } from "@/lib/account-route";
import { db, transaction, USER } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/validation";
import { emptyBoard, validateBoard } from "@/lib/sketchboard";

export const dynamic = "force-dynamic";
const validTab = (tab: unknown): tab is string => typeof tab === "string" &&
  /^(?:main|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(tab);
const ownerFor = (tab:string) => tab === "main" ? USER : USER + ":tab:" + tab;
function prepare() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Sketchboard (userId TEXT PRIMARY KEY, content TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS SketchboardTabState (
      userId TEXT NOT NULL, tab TEXT NOT NULL, title TEXT NOT NULL,
      archivedAt TEXT, discarded INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(userId,tab)
    );
  `);
}
function activeOwner(request: Request) {
  const tab = new URL(request.url).searchParams.get("tab") || "main";
  if (!validTab(tab)) throw new Error("Ungültiger Tab.");
  const removed = db.prepare("SELECT 1 FROM SketchboardTabState WHERE userId=? AND tab=? AND discarded=1").get(USER,tab);
  if (removed) return null;
  const owner = ownerFor(tab);
  db.prepare("INSERT OR IGNORE INTO Sketchboard(userId,content) VALUES (?,?)").run(owner,JSON.stringify(emptyBoard()));
  return owner;
}
const deletedResponse = () => Response.json({error:"Diese LifeMap wurde gelöscht."},{status:410});

export const GET = accountRoute(async (request) => {
  try {
    prepare();
    const data = transaction(()=>{
      if (new URL(request.url).searchParams.has("archive")) {
        return { tabs:db.prepare(`
          SELECT tab AS id,title,archivedAt FROM SketchboardTabState
          WHERE userId=? AND archivedAt IS NOT NULL AND discarded=0 ORDER BY archivedAt DESC, title
        `).all(USER) };
      }
      const owner = activeOwner(request);
      if (!owner) return null;
      const row = db.prepare("SELECT content,revision FROM Sketchboard WHERE userId=?")
        .get(owner) as {content:string;revision:number};
      return {board:JSON.parse(row.content),revision:row.revision};
    });
    return data ? Response.json(data,{headers:{"Cache-Control":"private, no-store"}}) : deletedResponse();
  } catch (error) { return errorResponse(error); }
});

export const PUT = accountRoute(async (request) => {
  try {
    sameOrigin(request);
    const raw = await request.text();
    if (raw.length > 8_000_000) throw new Error("Die Zeichenfläche ist zu groß.");
    const { board, revision } = JSON.parse(raw);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Ungültiger Speicherstand.");
    const valid = validateBoard(board);
    prepare();
    return transaction(()=>{
      const owner = activeOwner(request);
      if (!owner) return deletedResponse();
      const result = db.prepare("UPDATE Sketchboard SET content=?,revision=revision+1 WHERE userId=? AND revision=?")
        .run(JSON.stringify(valid), owner, revision);
      if (!result.changes) return Response.json({error:"Die LifeMap wurde in einem anderen Fenster geändert."},{status:409});
      return Response.json({revision:revision+1});
    });
  } catch (error) { return errorResponse(error); }
});

export const POST = accountRoute(async (request) => {
  try {
    sameOrigin(request);
    const {action,tabs} = await request.json();
    if (!["archive","discard","reopen"].includes(action) || !Array.isArray(tabs) || !tabs.length || tabs.length>100)
      throw new Error("Ungültige Tab-Aktion.");
    const entries = tabs.map(tab=>{
      if (!tab || !validTab(tab.id) || (action==="archive" && (typeof tab.title!=="string" || !tab.title.trim() || tab.title.length>60)))
        throw new Error("Ungültige LifeMap.");
      return {id:tab.id as string,title:typeof tab.title==="string"?tab.title.trim():""};
    });
    prepare();
    transaction(()=>{
      for (const {id,title} of entries) {
        if (action==="reopen") {
          const result=db.prepare("DELETE FROM SketchboardTabState WHERE userId=? AND tab=? AND archivedAt IS NOT NULL AND discarded=0").run(USER,id);
          if (!result.changes) throw new Error("Diese LifeMap ist nicht im Speicherort.");
        } else if (action==="discard") {
          db.prepare(`
            INSERT INTO SketchboardTabState (userId,tab,title,discarded) VALUES (?,?,?,1)
            ON CONFLICT(userId,tab) DO UPDATE SET title='', archivedAt=NULL, discarded=1
          `).run(USER,id,"");
          db.prepare("DELETE FROM Sketchboard WHERE userId=?").run(ownerFor(id));
        } else {
          const result=db.prepare(`
            INSERT INTO SketchboardTabState (userId,tab,title,archivedAt) VALUES (?,?,?,?)
            ON CONFLICT(userId,tab) DO UPDATE SET title=excluded.title, archivedAt=excluded.archivedAt
            WHERE SketchboardTabState.discarded=0
          `).run(USER,id,title,new Date().toISOString());
          if (!result.changes) throw new Error("Diese LifeMap wurde bereits gelöscht.");
        }
      }
    });
    return Response.json({ok:true});
  } catch (error) { return errorResponse(error); }
});
