"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { noteFonts, noteFontCss, type NoteFont, type NotePreferences } from "@/lib/note-todos";

export type NoteRun={text:string;font?:NoteFont;size?:number;color?:string;bold?:boolean;italic?:boolean;underline?:boolean};
type Style=Omit<NoteRun,"text">;
function readRuns(root:HTMLElement) {
  const runs:NoteRun[]=[];
  function add(text:string,style:Style) {
    if(!text)return;
    const last=runs.at(-1);
    if(last && JSON.stringify({...last,text:""})===JSON.stringify({...style,text:""}))last.text+=text;
    else runs.push({...style,text});
  }
  function visit(node:Node,style:Style) {
    if(node.nodeType===Node.TEXT_NODE){add(node.textContent || "",style);return;}
    if(!(node instanceof HTMLElement))return;
    if(node.tagName==="BR"){add("\n",style);return;}
    if(["DIV","P"].includes(node.tagName) && runs.length && !runs.at(-1)?.text.endsWith("\n"))add("\n",style);
    const family=node.style.fontFamily || node.getAttribute("face") || "";
    const font=(Object.keys(noteFonts) as NoteFont[]).find((key)=>family.toLowerCase().includes(key==="system"?"system-ui":key));
    const size=parseInt(node.style.fontSize,10);
    const color=node.style.color || node.getAttribute("color") || "";
    const next={...style,
      ...(font?{font}:{}),...(size>=8 && size<=48?{size}:{}),
      ...(/^#[0-9a-f]{3,8}$|^rgba?\([\d., %]+\)$/i.test(color)?{color}:{}),
      ...(["B","STRONG"].includes(node.tagName)||/^(bold|[6-9]00)$/.test(node.style.fontWeight)?{bold:true}:node.style.fontWeight?{bold:false}:{}),
      ...(["I","EM"].includes(node.tagName)||node.style.fontStyle==="italic"?{italic:true}:node.style.fontStyle?{italic:false}:{}),
      ...(node.tagName==="U"||node.style.textDecoration.includes("underline")?{underline:true}:node.style.textDecoration?{underline:false}:{}),
    };
    node.childNodes.forEach((child)=>visit(child,next));
  }
  root.childNodes.forEach((node)=>visit(node,{}));
  return runs;
}
function renderRuns(root:HTMLElement,runs:NoteRun[]) {
  const fragment=document.createDocumentFragment();
  for(const run of runs){
    const span=document.createElement("span");span.textContent=run.text;
    if(run.font && Object.hasOwn(noteFontCss,run.font))span.style.fontFamily=noteFontCss[run.font];
    if(run.size && run.size>=8 && run.size<=48)span.style.fontSize=`${run.size}px`;
    if(run.color && /^#[0-9a-f]{3,8}$|^rgba?\([\d., %]+\)$/i.test(run.color))span.style.color=run.color;
    if(run.bold!==undefined)span.style.fontWeight=run.bold?"bold":"normal";
    if(run.italic!==undefined)span.style.fontStyle=run.italic?"italic":"normal";
    if(run.underline!==undefined)span.style.textDecoration=run.underline?"underline":"none";
    fragment.append(span);
  }
  root.replaceChildren(fragment);
}
export default function RichNoteLine({text,runs,label,preferences,onChange,onBlur,onFiles,autoFocus=false,compact=false}:{
  text:string;runs?:NoteRun[];label:string;preferences:NotePreferences;
  onChange:(text:string,runs:NoteRun[])=>void;onBlur:()=>unknown;onFiles:(files:File[])=>void;
  autoFocus?:boolean;compact?:boolean;
}){
  const field=useRef<HTMLDivElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const selection=useRef<Range|null>(null);
  const last=useRef("");
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(autoFocus)field.current?.focus({preventScroll:true});},[autoFocus]);
  useLayoutEffect(()=>{
    const current=runs || (text?[{text}]:[]);
    const signature=JSON.stringify(current);
    if(field.current && last.current!==signature){renderRuns(field.current,current);last.current=signature;}
  },[text,runs]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !menu.current?.contains(event.target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",escape,true);
    return ()=>{document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",escape,true);};
  },[open]);
  const sync=()=>{
    if(!field.current)return;
    const next=readRuns(field.current);
    last.current=JSON.stringify(next);
    onChange(next.map((run)=>run.text).join(""),next);
  };
  function apply(command:string,value?:string,size?:number){
    const editor=field.current,range=selection.current,current=window.getSelection();
    if(!editor || !range || !current)return;
    editor.focus();current.removeAllRanges();current.addRange(range);
    document.execCommand(command,false,value);
    if(size)editor.querySelectorAll<HTMLElement>('font[size="7"]').forEach((item)=>{item.removeAttribute("size");item.style.fontSize=`${size}px`;});
    sync();setOpen(false);
  }
  return <div className="rich-note-line">
    <div ref={field} className="rich-note-field" role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning
      data-placeholder="Notiz schreiben …" style={{fontFamily:noteFontCss[preferences.font],fontSize:compact?Math.max(11,preferences.size-3):preferences.size}}
      onInput={sync} onBlur={onBlur}
      onContextMenu={(event)=>{
        const current=window.getSelection();
        if(!current || current.isCollapsed || !current.rangeCount || !field.current?.contains(current.getRangeAt(0).commonAncestorContainer))return;
        event.preventDefault();event.stopPropagation();selection.current=current.getRangeAt(0).cloneRange();setOpen(true);
      }}
      onPaste={(event)=>{
        event.preventDefault();
        if(event.clipboardData.files.length){onFiles(Array.from(event.clipboardData.files));return;}
        document.execCommand("insertText",false,event.clipboardData.getData("text/plain"));
      }}
    />
    {open && <div ref={menu} className="note-format selection-toolbar" aria-label="Markierten Text formatieren">
      <label>Schrift <select defaultValue="" onChange={(event)=>apply("fontName",noteFontCss[event.target.value as NoteFont])}>
        <option disabled value="">Auswählen</option>{Object.entries(noteFonts).map(([key,name])=><option key={key} value={key}>{name}</option>)}
      </select></label>
      <label>Größe <select defaultValue="" onChange={(event)=>apply("fontSize","7",Number(event.target.value))}>
        <option disabled value="">Auswählen</option>{[12,14,16,18,20,24,30].map((size)=><option key={size}>{size}</option>)}
      </select></label>
      {([["bold","Fett"],["italic","Kursiv"],["underline","Unterstrichen"]] as const).map(([key,label])=><button type="button" key={key} onMouseDown={(event)=>event.preventDefault()} onClick={()=>apply(key)}>{label}</button>)}
      <label>Farbe <input type="color" onChange={(event)=>apply("foreColor",event.target.value)}/></label>
    </div>}
  </div>;
}
