"use client";
import { createPortal } from "react-dom";
import ColorSwatches from "@/components/color-swatches";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import { noteFonts, noteFontCss, type NoteFont, type NotePreferences } from "@/lib/note-todos";

import type { NoteRun } from "@/lib/note-format";
export type { NoteRun } from "@/lib/note-format";
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
export default function RichNoteLine({text,runs,label,preferences,onChange,onBlur,onFiles,autoFocus=false,compact=false,placeholder="Notiz schreiben …",onCaret,onKeyDown,maxLength,onMakeTodos}:{
  text:string;runs?:NoteRun[];label:string;preferences:NotePreferences;
  onChange:(text:string,runs:NoteRun[])=>void;onBlur:()=>unknown;onFiles:(files:File[])=>void;
  autoFocus?:boolean;compact?:boolean;placeholder?:string;maxLength?:number;
  onMakeTodos?:(start:number,end:number)=>void;
  onCaret?:(position:number)=>void;
  onKeyDown?:(event:ReactKeyEvent<HTMLDivElement>,start:number,end:number)=>void;
}){
  const field=useRef<HTMLDivElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const selection=useRef<Range|null>(null);
  const last=useRef("");
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({x:0,y:0,above:true});
  useEffect(()=>{
    const capture=()=>{
      const current=window.getSelection();
      if(!field.current || !current?.rangeCount || current.isCollapsed) {
        if(document.activeElement===field.current)setOpen(false);
        return;
      }
      const range=current.getRangeAt(0);
      if(!field.current.contains(range.commonAncestorContainer))return;
      selection.current=range.cloneRange();
      const rect=range.getBoundingClientRect();
      const above=rect.top>=70;
      setPosition({x:Math.max(8,Math.min(rect.left,innerWidth-420)),y:above?rect.top-6:rect.bottom+6,above});
      setOpen(true);
    };
    document.addEventListener("selectionchange",capture);
    return ()=>document.removeEventListener("selectionchange",capture);
  },[]);
  useEffect(()=>{if(autoFocus)field.current?.focus({preventScroll:true});},[autoFocus]);
  useLayoutEffect(()=>{
    const current=runs || (text?[{text}]:[]);
    const signature=JSON.stringify(current);
    if(field.current && last.current!==signature){renderRuns(field.current,current);last.current=signature;}
  },[text,runs]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !menu.current?.contains(event.target) && !(event.target instanceof Element && event.target.closest(".color-popup")))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",escape,true);
    return ()=>{document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",escape,true);};
  },[open]);
  function offsets(){
    const active=window.getSelection(), editor=field.current;
    if(!active?.rangeCount || !editor)return [0,0] as const;
    const current=active.getRangeAt(0);
    if(!editor.contains(current.commonAncestorContainer))return [0,0] as const;
    const prefix=document.createRange();
    prefix.selectNodeContents(editor);
    prefix.setEnd(current.startContainer,current.startOffset);
    const length=(range:Range)=>{
      const fragment=document.createElement("div");
      fragment.append(range.cloneContents());
      return readRuns(fragment).reduce((count,run)=>count+run.text.length,0);
    };
    const start=length(prefix);
    prefix.setEnd(current.endContainer,current.endOffset);
    return [start,length(prefix)] as const;
  }
  const sync=()=>{
    if(!field.current)return;
    const next=readRuns(field.current);
    if(maxLength && next.reduce((count,run)=>count+run.text.length,0)>maxLength){
      renderRuns(field.current,runs || [{text}]);return;
    }
    onCaret?.(offsets()[0]);
    last.current=JSON.stringify(next);
    onChange(next.map((run)=>run.text).join(""),next);
  };
  function apply(command:string,value?:string,size?:number){
    const editor=field.current,range=selection.current,current=window.getSelection();
    if(!editor || !range || !current)return;
    editor.focus();current.removeAllRanges();current.addRange(range);
    document.execCommand(command,false,value);
    if(size)editor.querySelectorAll<HTMLElement>('font[size="7"]').forEach((item)=>{item.removeAttribute("size");item.style.fontSize=`${size}px`;});
    sync();
  }
  function stepSize(delta:number){
    const node=selection.current?.startContainer;
    const style=node?.parentElement && getComputedStyle(node.parentElement);
    const size=Number.parseFloat(style?.fontSize || "") || preferences.size;
    apply("fontSize","7",Math.min(48,Math.max(8,size+delta)));
  }
  return <div className="rich-note-line">
    <div ref={field} className="rich-note-field" role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning
      data-placeholder={placeholder} style={{fontFamily:noteFontCss[preferences.font],fontSize:compact?Math.max(11,preferences.size-3):preferences.size}}
      onInput={sync} onBlur={onBlur} onMouseUp={()=>onCaret?.(offsets()[0])} onKeyUp={()=>onCaret?.(offsets()[0])}
      onKeyDown={event=>onKeyDown?.(event,...offsets())}
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
    {open && createPortal(<div ref={menu} className="note-format note-selection-toolbar selection-toolbar" aria-label="Markierten Text formatieren"
      style={{left:position.x,top:position.y,transform:position.above?"translateY(-100%)":undefined}}>
      <label>Schrift <select defaultValue="" onChange={(event)=>apply("fontName",noteFontCss[event.target.value as NoteFont])}>
        <option disabled value="">Auswählen</option>{Object.entries(noteFonts).map(([key,name])=><option key={key} value={key} style={{fontFamily:noteFontCss[key as NoteFont]}}>{name}</option>)}
      </select></label>
      <button type="button" className="note-size-down" aria-label="Schrift verkleinern" onMouseDown={event=>event.preventDefault()} onClick={()=>stepSize(-2)}>A</button>
      <button type="button" className="note-size-up" aria-label="Schrift vergrößern" onMouseDown={event=>event.preventDefault()} onClick={()=>stepSize(2)}>A</button>
      {([["bold","Fett","B"],["italic","Kursiv","I"],["underline","Unterstrichen","U"]] as const).map(([key,label,letter])=>
        <button type="button" key={key} className={`note-style-${key}`} aria-label={label} title={label}
          onMouseDown={(event)=>event.preventDefault()} onClick={()=>apply(key)}>{letter}</button>)}
      {onMakeTodos && <button type="button" aria-label="Auswahl zu To-dos machen" title="Auswahl zu To-dos machen"
        onMouseDown={event=>event.preventDefault()} onClick={()=>{
          const range=selection.current, current=window.getSelection();
          if(!range || !current)return;
          field.current?.focus();current.removeAllRanges();current.addRange(range);
          onMakeTodos(...offsets());current.removeAllRanges();setOpen(false);
        }}>☑</button>}
      <label>Farbe <ColorSwatches name="rich-note-line-0" onChange={(event)=>apply("foreColor",event.target.value)} /></label>
    </div>,document.body)}
  </div>;
}
