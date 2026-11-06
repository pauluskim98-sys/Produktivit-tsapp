"use client";

import { useEffect, useRef, useState } from "react";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bookmark, Plus, Settings2, X, Star, BookOpen, Music, House, Heart, Dumbbell, BriefcaseBusiness, Utensils, Palette } from "lucide-react";
import { categoryIcons } from "./category-icon";
import ColorPicker from "./task-color-picker";
import TabEmojiPicker, { MonochromeEmoji } from "./tab-emoji-picker";
import { tabEmoji } from "@/lib/tab-emoji";
import TabSettings from "./tab-settings";
import { useDialog } from "./use-dialog";
import { typeTitle } from "./type-title";
import { baseLifeTabs, lifeTabs } from "@/lib/life-tabs";
import { categoryColor } from "@/lib/planner-categories";
import { TASK_COLOR_HEX, type TaskColor } from "@/lib/task-colors";
import { categorySuggestions, taskPicture } from "@/lib/task-picture";
import { parseAppointmentInput } from "@/lib/appointment-input";
import { parseQuadrant } from "@/lib/eisenhower";
import type { LifeState } from "@/lib/life";

const scope = "calendar-header";
const tabIcons={bookmark:[Bookmark,"Lesezeichen"],star:[Star,"Stern"],book:[BookOpen,"Buch"],music:[Music,"Musik"],home:[House,"Haus"],heart:[Heart,"Herz"],sport:[Dumbbell,"Sport"],work:[BriefcaseBusiness,"Arbeit"],food:[Utensils,"Essen"],art:[Palette,"Kunst"]} as const;
type Template = { category: string; title: string; uses: number };
type TabAction = { id: string; kind: "quick" | "page" | "rename" | "settings" | "delete"; returnToPage?:boolean } |
  {id:string;kind:"menu";left:number;top:number} | {kind:"new"};

function HeaderTab({ id, name, color, icon, emoji, onAction }: {
  id: string; name: string; color: TaskColor; icon?:string; emoji?:string; onAction: (action: TabAction) => void;
}) {
  const sortable = useSortable({ id: `${scope}:${id}`, data: { kind:"life-tab", tabId:id, scope } });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const Icon = tabIcons[icon as keyof typeof tabIcons]?.[0] || categoryIcons[id] || Bookmark;
  return <button type="button" ref={sortable.setNodeRef} {...sortable.attributes} {...sortable.listeners}
    className="calendar-tab"
    style={{ transform:CSS.Transform.toString(sortable.transform), transition:sortable.transition }}
    title="Klick: Aufgabe hinzufügen · Doppelklick: Reiter öffnen · Rechtsklick: Optionen"
    onClick={(event)=>{
      clearTimeout(timer.current);
      if(event.detail===0)onAction({id,kind:"quick"});
      else if(event.detail===1)timer.current=setTimeout(()=>onAction({id,kind:"quick"}),300);
    }}
    onKeyDown={(event)=>{
      if(event.key==="Enter"){event.preventDefault();onAction({id,kind:"quick"});}
      else sortable.listeners?.onKeyDown?.(event);
    }}
    onDoubleClick={()=>{clearTimeout(timer.current);onAction({id,kind:"page"});}}
    onContextMenu={(event)=>{
      event.preventDefault();event.stopPropagation();clearTimeout(timer.current);
      const bounds=event.currentTarget.getBoundingClientRect();
      onAction({id,kind:"menu",left:Math.max(8,Math.min(bounds.left,window.innerWidth-188)),
        top:bounds.bottom+132<=window.innerHeight?bounds.bottom+4:Math.max(8,bounds.top-128)});
    }}>
    {emoji ? <MonochromeEmoji emoji={emoji} color={color}/> : <Icon size={16} color={TASK_COLOR_HEX[color]} />}<span>{name}</span>
  </button>;
}

export default function CalendarTabs({onAdd, onCreate, renderFeature}: {
  onAdd: (title:string, category:string, color:TaskColor) => Promise<void>;
  onCreate: (category:string, color:TaskColor, suggestions:string[]) => void;
  renderFeature?: (id:string, close:()=>void) => React.ReactNode;
}) {
  const [life,setLife]=useState<LifeState|null>(null);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [action,setAction]=useState<TabAction|null>(null);
  const [draft,setDraft]=useState("");
  const [emoji,setEmoji]=useState("");
  const [tabColor,setTabColor]=useState<TaskColor>("green");
  const [tabIcon,setTabIcon]=useState<keyof typeof tabIcons>("bookmark");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const menuRef=useRef<HTMLDivElement>(null);
  const id=action && "id" in action ? action.id : "";
  useDialog(!!action && action.kind!=="settings" && action.kind!=="menu",`${action?.kind}:${id}`);
  useEffect(()=>{
    if(action?.kind!=="menu")return;
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node && !menuRef.current?.contains(event.target))setAction(null);
    };
    document.addEventListener("pointerdown",outside,true);
    return ()=>document.removeEventListener("pointerdown",outside,true);
  },[action]);
  const tabs=(life ? lifeTabs(life) : baseLifeTabs).filter(([key])=>key!=="todo");
  const name=tabs.find(([key])=>key===id)?.[1] || "";
  const color=life?.tabSettings[id]?.defaultColor || categoryColor(id);
  const related=templates.filter((item)=>item.category===id);
  const close=()=>{setAction(null);setDraft("");setError("");};
  const open=(next:TabAction)=>{
    if(next.kind==="new")setTabIcon("bookmark");
    if(next.kind==="quick" && "id" in next && next.id!=="weather"){
      close();
      onCreate(next.id,life?.tabSettings[next.id]?.defaultColor || categoryColor(next.id),
        templates.filter((item)=>item.category===next.id).map((item)=>item.title));
      return;
    }
    setAction(next.kind==="quick" && "id" in next ? {...next,kind:"page"} : next);
    setDraft(next.kind==="rename" && "id" in next ? tabs.find(([key])=>key===next.id)?.[1] || "" : "");
    setError("");
  };
  async function read<T>(path:string, body?:unknown):Promise<T> {
    const response=await fetch(path,body===undefined?undefined:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error || "Änderung fehlgeschlagen.");
    return result;
  }
  const report=(error:unknown)=>setError((error as Error).message);
  const refreshLife=()=>read<LifeState>("/api/life").then(setLife).catch(report);
  const refreshTemplates=()=>read<Template[]>("/api/task-templates").then(setTemplates).catch(report);
  useEffect(()=>{
    void refreshLife(); void refreshTemplates();
    const refresh=()=>void refreshLife();
    window.addEventListener("raum-data-changed",refresh);
    window.addEventListener("raum-life-changed",refresh);
    window.addEventListener("lifemap-templates-changed",refreshTemplates);
    return ()=>{window.removeEventListener("raum-data-changed",refresh);window.removeEventListener("raum-life-changed",refresh);window.removeEventListener("lifemap-templates-changed",refreshTemplates);};
  },[]);
  async function save(next:LifeState) {
    try { setLife(await read<LifeState>("/api/life",next));window.dispatchEvent(new Event("raum-life-changed"));return true; }
    catch(error){report(error);return false;}
  }
  useEffect(()=>{
    const reorder=(event:Event)=>{
      const {active,over,scope:source}=(event as CustomEvent).detail;
      if(!life || source!==scope || active===over)return;
      const order=tabs.map(([key])=>key), from=order.indexOf(active), to=order.indexOf(over);
      if(from>=0 && to>=0)void save({...life,tabOrder:arrayMove(order,from,to)});
    };
    window.addEventListener("raum-tab-reorder",reorder);
    return ()=>window.removeEventListener("raum-tab-reorder",reorder);
  },[life]);
  async function remember(title:string,used:boolean) {
    const clean=parseAppointmentInput(parseQuadrant(title).title).title || title;
    await read("/api/task-templates",{category:id,title:clean,used});
    await refreshTemplates();
  }
  async function add(title:string) {
    if(busy || !title.trim())return;
    setBusy(true);setError("");
    try {
      await onAdd(title.trim(),id,color);
      setDraft("");
      try { await remember(title,true); } catch(error){report(error);}
    } catch(error){report(error);} finally {setBusy(false);}
  }
  async function editTab() {
    if(!life || !action || busy)return;
    const label=draft.trim();
    if(action.kind!=="delete" && !label)return;
    if(action.kind==="new" && emoji.trim() && !tabEmoji(emoji.trim())){setError("Bitte ein einzelnes Emoji wählen.");return;}
    setBusy(true);
    try {
      const newId=action.kind==="new"?crypto.randomUUID():"";
      const next=action.kind==="delete" ? {...life,hidden:[...new Set([...life.hidden,id])]} :
        action.kind==="new" ? {...life,rhythms:[...life.rhythms,{id:newId,name:label,days:7,target:1,unit:"times" as const}],
          tabSettings:{...life.tabSettings,[newId]:{icon:tabIcon,defaultColor:tabColor,emoji:emoji.trim() || undefined}}} :
        {...life,labels:{...life.labels,[id]:label}};
      if(await save(next)) {
        if(action.kind==="rename" && action.returnToPage)open({id,kind:"page"});
        else close();
      }
    } finally {setBusy(false);}
  }
  return <>
    <div className="calendar-category-zone">
    <nav className="calendar-category-bar" aria-label="Kalender-Reiter">
      <SortableContext items={tabs.map(([key])=>`${scope}:${key}`)} strategy={horizontalListSortingStrategy}>
        {tabs.map(([key,label])=><HeaderTab key={key} id={key} name={label} color={life?.tabSettings[key]?.defaultColor || categoryColor(key)} icon={life?.tabSettings[key]?.icon} emoji={life?.tabSettings[key]?.emoji} onAction={open}/>)}
      </SortableContext>
      <button className="calendar-tab" type="button" aria-label="Reiter hinzufügen" onClick={()=>open({kind:"new"})}><Plus size={17}/></button>
    </nav>
    </div>
    {!action && error && <small role="alert">{error}</small>}
    {action?.kind==="menu" && <div ref={menuRef} className="calendar-tab-actions selection-toolbar" role="menu" aria-label={name} style={{left:action.left,top:action.top}}>
      <button type="button" role="menuitem" autoFocus onClick={()=>open({id,kind:"settings"})}><Settings2 size={15}/>Einstellungen</button>
      <button type="button" role="menuitem" onClick={()=>open({id,kind:"rename"})}>Umbenennen</button>
      <button type="button" role="menuitem" onClick={()=>open({id,kind:"delete"})}>Reiter löschen</button>
      <button hidden type="button" data-close onClick={close}>Schließen</button>
    </div>}
    {action?.kind==="settings" && life ? <TabSettings key={id} id={id} label={name} life={life} save={save} onClose={close}/> :
      action && action.kind!=="menu" && <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget && !busy)close();}}>
        <section className="modal calendar-tab-dialog" role="dialog" aria-modal="true" aria-label={name || "Neuer Reiter"}
          tabIndex={-1} data-initial-focus={action.kind==="rename"?true:undefined} data-type-title={action.kind==="rename"?"rename":undefined}
          onKeyDown={(event)=>{
            if(action.kind!=="rename" || typeTitle(event,setDraft))return;
            if(event.target===event.currentTarget && event.key==="Enter" && !event.repeat){event.preventDefault();event.currentTarget.querySelector("form")?.requestSubmit();}
          }}>
          <div className="modal-heading">
            <h2>{action.kind==="page" ? <button type="button" className="tab-title-edit" title="Reiter umbenennen" onClick={()=>open({id,kind:"rename",returnToPage:true})}>{name}</button> :
              action.kind==="new" ? "Neuer Reiter" : action.kind==="delete" ? "Reiter löschen" : name}</h2>
            <button type="button" aria-label="Schließen" data-close onClick={close}><X size={18}/></button>
          </div>
          {action.kind==="page" && <>
            {id!=="weather" && id!=="goals" && <>
              <div className="illustrated-suggestions">{(categorySuggestions[id] || []).map((title)=><button type="button" key={title} disabled={busy} onClick={()=>void add(title)}><img src={taskPicture(title,id)} alt=""/><span>{title}</span></button>)}</div>
              <form onSubmit={async(event)=>{event.preventDefault();if(!draft.trim() || busy)return;setBusy(true);try{await remember(draft,false);setDraft("");}catch(error){report(error);}finally{setBusy(false);}}}>
                <input aria-label="Aufgabenvorlage speichern" placeholder="Aufgabe als Vorlage speichern" value={draft} onChange={(event)=>setDraft(event.target.value)}/>
                <button disabled={busy || !draft.trim()}>Speichern</button>
              </form>
              {related.map((item)=><button className="task-template" type="button" key={item.title} disabled={busy} onClick={()=>void add(item.title)}>{item.title}<small>{item.uses}× verwendet</small></button>)}
            </>}
            {renderFeature?.(id,close)}
          </>}
          {(action.kind==="new" || action.kind==="rename" || action.kind==="delete") && <form onSubmit={(event)=>{event.preventDefault();void editTab();}}>
            {action.kind==="delete" ? <p>„{name}“ aus der Kopfzeile entfernen? Die Aufgaben bleiben im Kalender.</p> :
              <input autoFocus={action.kind==="new"} data-title-field required maxLength={80} aria-label="Name des Reiters" value={draft} onChange={(event)=>setDraft(event.target.value)}/>}
            <button disabled={busy || !life}>{action.kind==="delete"?"Reiter löschen":"Speichern"}</button>
            {action.kind==="new" && <fieldset className="tab-icon-picker"><legend>Symbol</legend>
              {Object.entries(tabIcons).map(([key,[Icon,label]])=><button key={key} type="button" aria-label={label} title={label} aria-pressed={!emoji && tabIcon===key} onClick={()=>{setEmoji("");setTabIcon(key as keyof typeof tabIcons);}}><Icon size={17}/></button>)}
            </fieldset>}
            {action.kind==="new" && <><ColorPicker value={tabColor} onChange={setTabColor}/><TabEmojiPicker value={emoji} onChange={setEmoji} color={tabColor}/></>}
            {action.kind==="new" && !!life?.hidden.length && <select aria-label="Reiter wiederherstellen" value="" onChange={(event)=>{const value=event.target.value;if(life && value)void save({...life,hidden:life.hidden.filter((key)=>key!==value)});}}>
              <option value="">Reiter wiederherstellen …</option>
              {life.hidden.map((key)=><option key={key} value={key}>{life.labels[key] || baseLifeTabs.find(([id])=>id===key)?.[1] || life.rhythms.find((item)=>item.id===key)?.name || key}</option>)}
            </select>}
          </form>}
          {error && <p role="alert">{error}</p>}
        </section>
      </div>}
  </>;
}
