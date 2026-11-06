"use client";

import { useState } from "react";
import { FileText, Folder, PanelLeft, Plus, Search, X } from "lucide-react";
import { readNoteLines } from "./planner-notepad";
import { isNotebookFolder, notebookFolder } from "@/lib/notebook";

type Entry = { key: string; title: string; content: string; folder?: string };
export function notebookTitle(key: string, value: string) {
  if (notebookFolder(key)) return readNoteLines(value)[0]?.text.trim() || "Unbenannte Notiz";
  const [period, date] = key.includes(":") ? key.split(":") : ["day", key];
  return `${period === "week" ? "Woche" : period === "month" ? "Monat" : "Tag"} · ${date.split("-").reverse().join(".")}`;
}

export default function NotebookNavigation({ open, onToggle, values, calendarKeys, pinned, tabs, active, onOpen, onClose, onCreate, onFolder }: {
  open: boolean; onToggle: () => void; values: Record<string, string>; calendarKeys: string[];
  pinned: string; tabs: string[]; active: string; onOpen: (key: string) => void; onClose: (key: string) => void;
  onCreate: (folder?: string) => void; onFolder: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [folderDraft, setFolderDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const folders = Object.entries(values).filter(([key, name]) => isNotebookFolder(key) && name)
    .sort((a, b) => a[1].localeCompare(b[1], "de"));
  const calendar = /^(?:(?:week|month):)?\d{4}-\d{2}-\d{2}$/;
  const entries: Entry[] = [...new Set([...calendarKeys, ...Object.keys(values).filter((key) => values[key] && (calendar.test(key) || notebookFolder(key)))])]
    .map((key) => ({
      key, title: notebookTitle(key, values[key] || ""), folder: notebookFolder(key),
      content: readNoteLines(values[key] || "").map((line) => line.text).join(" "),
    }));
  const terms = query.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const matches = entries.filter((entry) => terms.every((term) => `${entry.title} ${entry.content}`.toLocaleLowerCase("de").includes(term)));
  const entryButton = (entry: Entry) => <button key={entry.key} type="button" className="notebook-entry" aria-current={active === entry.key ? "true" : undefined} onClick={() => onOpen(entry.key)}><FileText size={14}/><span>{entry.title}</span></button>;
  return <>
    <button type="button" className="notebook-rail" aria-label={open ? "Notizliste schließen" : "Notizliste öffnen"} aria-expanded={open} onClick={onToggle}><PanelLeft size={15}/></button>
    {open && <aside className="notebook-sidebar" aria-label="Notizliste">
      <label className="notebook-search"><Search size={15}/><input type="search" placeholder="Notizen durchsuchen" aria-label="Notizinhalte durchsuchen" value={query} onChange={(event)=>setQuery(event.target.value)}/></label>
      <div className="notebook-sidebar-actions">
        <button type="button" onClick={()=>onCreate()}><Plus size={14}/> Notiz</button>
        <button type="button" onClick={()=>setFolderDraft("")}><Folder size={14}/> Ordner</button>
      </div>
      {folderDraft !== null && <form onSubmit={async(event)=>{
        event.preventDefault();
        if(!folderDraft.trim() || saving)return;
        setSaving(true);setError("");
        try{await onFolder(folderDraft.trim());setFolderDraft(null);}catch(error){setError((error as Error).message);}finally{setSaving(false);}
      }}>
        <input autoFocus aria-label="Ordnername" placeholder="Ordnername" maxLength={80} value={folderDraft} onChange={(event)=>setFolderDraft(event.target.value)}/>
        <button type="submit" disabled={saving}>Erstellen</button>
        <button type="button" aria-label="Abbrechen" onClick={()=>setFolderDraft(null)}><X size={14}/></button>
      </form>}
      {error && <small role="alert">{error}</small>}
      <div className="notebook-list">
        {terms.length ? (matches.length ? matches.map(entryButton) : <small>Keine passenden Notizen</small>) : <>
          {entries.filter((entry)=>!entry.folder).map(entryButton)}
          {entries.filter((entry)=>entry.folder==="root" || (entry.folder && !folders.some(([key])=>key===`note-folder:${entry.folder}`))).map(entryButton)}
          {folders.map(([key,name])=><details open key={key}>
            <summary><Folder size={14}/><span>{name}</span></summary>
            <button type="button" className="notebook-entry" onClick={()=>onCreate(key.slice("note-folder:".length))}><Plus size={14}/> Notiz im Ordner</button>
            {entries.filter((entry)=>key===`note-folder:${entry.folder}`).map(entryButton)}
          </details>)}
        </>}
      </div>
    </aside>}
    <div className="notebook-tabs" aria-label="Offene Notizen">
      {tabs.map((key)=><div className="notebook-tab" key={key} data-active={active===key || undefined}>
        <button type="button" aria-current={active===key?"page":undefined} onClick={()=>onOpen(key)}>{notebookTitle(key,values[key] || "")}</button>
        {key!==pinned && <button type="button" aria-label={`${notebookTitle(key,values[key] || "")} schließen`} onClick={()=>onClose(key)}><X size={13}/></button>}
      </div>)}
      <button type="button" className="notebook-new-tab" aria-label="Neue Notiz" onClick={()=>onCreate()}><Plus size={16}/></button>
    </div>
  </>;
}
