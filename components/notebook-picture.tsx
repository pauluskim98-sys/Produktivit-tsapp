"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCw, MoveDiagonal } from "lucide-react";

export type NotePicture = { id: string; name: string; x?: number; y?: number; width?: number; angle?: number };
const imageExtension = /\.(png|jpe?g|gif|webp)$/i;
const attachmentPattern = /^\[([^\]]+)\]\(\/api\/storage\?file=([\w%-]+)\)$/;

export function noteAttachment(text: string) {
  const match = attachmentPattern.exec(text.trim());
  return match ? { name:match[1], id:match[2], image:imageExtension.test(match[1]) } : null;
}

export function isNotePicture(name: string) {
  return imageExtension.test(name);
}

export default function NotebookPicture({picture,onChange,onRemove}: {
  picture: NotePicture;
  onChange: (picture: NotePicture) => void;
  onRemove: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const drag = useRef<AbortController | null>(null);
  const [preview,setPreview] = useState<NotePicture>();
  const [menu,setMenu] = useState(false);
  const display = preview || picture;
  useEffect(() => () => drag.current?.abort(),[]);

  function begin(event:PointerEvent, mode:"move"|"size"|"rotate") {
    if (event.button !== 0 || !figure.current || !frame.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = figure.current.getBoundingClientRect();
    const bounds = frame.current.getBoundingClientRect();
    const editor = frame.current.closest(".note-checklist")?.getBoundingClientRect();
    const center = {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    const {pointerId,clientX,clientY} = event;
    const startWidth = figure.current.offsetWidth;
    const angleAt = (x:number,y:number) => Math.atan2(y-center.y,x-center.x)*180/Math.PI;
    const initialAngle = angleAt(clientX,clientY);
    let next = picture;
    drag.current?.abort();
    const controller = new AbortController();
    drag.current = controller;
    const options = {signal:controller.signal,capture:true};
    const stop = () => {controller.abort();drag.current=null;setPreview(undefined);};
    window.addEventListener("pointermove", move => {
      if(move.pointerId!==pointerId)return;
      const dx=move.clientX-clientX, dy=move.clientY-clientY;
      if(mode==="move") next={...picture,
        x:Math.round(Math.max(0,Math.min(bounds.width-startWidth,(picture.x||0)+dx))),
        y:Math.round(Math.max((editor?.top ?? bounds.top)-bounds.top, (picture.y||0)+dy)),
      };
      if(mode==="size") {
        const delta=Math.abs(dx)>=Math.abs(dy)?dx:dy;
        next={...picture,width:Math.round(Math.max(24,Math.min(bounds.width-(picture.x||0),startWidth+delta)))};
      }
      if(mode==="rotate")next={...picture,angle:Math.round((picture.angle||0)+angleAt(move.clientX,move.clientY)-initialAngle)};
      setPreview(next);
    },options);
    window.addEventListener("pointerup", up => {
      if(up.pointerId!==pointerId)return;
      if(next!==picture)onChange(next);
      stop();
    },options);
    window.addEventListener("pointercancel", stop, options);
    window.addEventListener("blur", stop, options);
  }

  return <div ref={frame} className="notebook-picture" onContextMenu={event=>{
    event.preventDefault();event.stopPropagation();setMenu(true);
  }}>
    {menu && <div className="notebook-row-context selection-toolbar" role="menu" onPointerLeave={()=>setMenu(false)}>
      <button type="button" role="menuitem" onClick={()=>{setMenu(false);onRemove();}}>Bild entfernen</button>
    </div>}
    <div className="notebook-picture-space" style={{paddingBottom:Math.max(0,display.y||0)}}>
      <div ref={figure} className="notebook-picture-frame" style={{
        width:display.width || 360,
        transform:`translate(${display.x||0}px, ${display.y||0}px) rotate(${display.angle||0}deg)`,
      }}>
        <img src={`/api/storage?file=${encodeURIComponent(display.id)}`} alt={display.name} draggable={false}
          onPointerDown={event=>begin(event,"move")}/>
        <button type="button" className="notebook-picture-rotate" aria-label="Bild drehen" onPointerDown={event=>begin(event,"rotate")}><RotateCw size={14}/></button>
        <button type="button" className="notebook-picture-resize" aria-label="Bildgröße ändern" onPointerDown={event=>begin(event,"size")}><MoveDiagonal size={14}/></button>
      </div>
    </div>
    <span className="notebook-picture-caret" contentEditable suppressContentEditableWarning
      role="textbox" aria-label="Schreibposition hinter dem Bild" onBeforeInput={event=>event.preventDefault()}
      onKeyDown={event=>{
        if(event.key!=="Backspace" && event.key!=="Delete")return;
        event.preventDefault();
        event.stopPropagation();
        onRemove();
      }}>{"\u200b"}</span>
  </div>;
}
