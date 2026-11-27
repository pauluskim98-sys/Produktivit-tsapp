"use client";

import { useEffect, useState } from "react";

export default function QuickTooltips() {
  const [tip,setTip] = useState<{text:string;x:number;y:number;above:boolean}|null>(null);
  useEffect(()=>{
    let element: Element | null=null;
    let originalTitle: string | null=null;
    let timer: number | undefined;
    const dismiss=()=>{
      window.clearTimeout(timer);
      if(originalTitle!==null && element?.getAttribute("title")==="")element.setAttribute("title",originalTitle);
      element=null;
      originalTitle=null;
      setTip(null);
    };
    const show=(event:PointerEvent)=>{
      if(event.pointerType==="touch" || event.buttons || !(event.target instanceof Element))return;
      const next=event.target.closest("[title],.lm-app button[aria-label]");
      if(next===element)return;
      dismiss();
      const text=next?.getAttribute("title") || next?.getAttribute("aria-label");
      if(!next || !text)return;
      element=next;
      originalTitle=next.getAttribute("title");
      if(originalTitle!==null)next.setAttribute("title","");
      timer=window.setTimeout(()=>{
        const rect=next.getBoundingClientRect();
        if(rect.width===0 || rect.height===0)return;
        const above=rect.bottom>innerHeight-88;
        const inset=Math.min(125,innerWidth/2);
        setTip({text,x:Math.min(Math.max(rect.left+rect.width/2,inset),innerWidth-inset),y:above?rect.top-6:rect.bottom+6,above});
      },140);
    };
    const leave=(event:PointerEvent)=>{
      if(event.relatedTarget instanceof Node && element?.contains(event.relatedTarget))return;
      dismiss();
    };
    document.addEventListener("pointerover",show,true);
    document.addEventListener("pointerout",leave,true);
    document.addEventListener("pointerdown",dismiss,true);
    document.addEventListener("dragstart",dismiss,true);
    document.addEventListener("scroll",dismiss,true);
    window.addEventListener("blur",dismiss);
    return()=>{
      dismiss();
      document.removeEventListener("pointerover",show,true);
      document.removeEventListener("pointerout",leave,true);
      document.removeEventListener("pointerdown",dismiss,true);
      document.removeEventListener("dragstart",dismiss,true);
      document.removeEventListener("scroll",dismiss,true);
      window.removeEventListener("blur",dismiss);
    };
  },[]);
  return tip && <div className="quick-tooltip" aria-hidden="true" data-above={tip.above}
    style={{left:tip.x,top:tip.y}}>{tip.text}</div>;
}
