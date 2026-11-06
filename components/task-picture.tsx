"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { taskPicture, taskSymbols, taskSymbolPicture } from "@/lib/task-picture";

const symbolNames=["Kalender","Bücher","Sport","Arbeit","Musik","Essen","Kunst","Treffen","Fahrrad","Stern"];

export default function TaskPicture({ todo, editable = false }: { todo:{ id:string; title:string; tags:string[] }; editable?:boolean }) {
  const [url,setUrl]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [open,setOpen]=useState(false);
  const wrapper=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let live=true;
    const refresh=()=>fetch(`/api/task-picture?id=${encodeURIComponent(todo.id)}`).then((r)=>r.json()).then((d)=>{if(live)setUrl(d.url);}).catch(()=>{});
    void refresh();window.addEventListener("lifemap-task-picture",refresh);window.addEventListener("raum-data-changed",refresh);
    return ()=>{live=false;window.removeEventListener("lifemap-task-picture",refresh);window.removeEventListener("raum-data-changed",refresh);};
  },[todo.id]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !wrapper.current?.contains(event.target))setOpen(false);};
    document.addEventListener("pointerdown",outside,true);
    return ()=>document.removeEventListener("pointerdown",outside,true);
  },[open]);
  async function change(next:string) {
    try {
      setError("");
      const response=await fetch("/api/task-picture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:todo.id,url:next})});
      if(!response.ok)throw new Error("Bild konnte nicht gespeichert werden.");
      setUrl(next);setOpen(false);window.dispatchEvent(new Event("lifemap-task-picture"));
    }catch(error){setError((error as Error).message);}
  }
  async function upload(file:File) {
    try {
      const form=new FormData();form.append("files",file);
      const response=await fetch("/api/storage",{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok || !result.added?.[0])throw new Error(result.error || "Datei konnte nicht geladen werden.");
      await change(`/api/storage?file=${encodeURIComponent(result.added[0])}`);
    }catch(error){setError((error as Error).message);}
  }
  const source=url?.startsWith("icon:")?taskSymbolPicture(url.slice(5)):url ?? taskPicture(todo.title,todo.tags.join(" "));
  const picture=source?<img src={source} alt=""/>:null;
  if(!editable)return <div className="task-picture">{picture}</div>;
  return <div className="task-picture-editor" ref={wrapper}>
    <button type="button" className="task-picture-trigger" aria-label="Aufgabenbild auswählen" aria-expanded={open} onClick={()=>setOpen(!open)}>
      {picture || <ImagePlus size={22}/>}
    </button>
    {open && <div className="task-picture-options" data-escape-layer>
      <button type="button" hidden data-close onClick={()=>setOpen(false)}>Schließen</button>
      <div className="task-symbols">{Object.entries(taskSymbols).map(([key,symbol],index)=><button type="button" key={key}
        aria-label={symbolNames[index]} title={symbolNames[index]} aria-pressed={url===`icon:${key}`} onClick={()=>void change(`icon:${key}`)}>{symbol}</button>)}</div>
      <label>Bild aus Datei <input type="file" accept="image/*" onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file);}}/></label>
      <button type="button" onClick={()=>void change("")}>Kein Bild</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
