"use client";

import { tabEmoji } from "@/lib/tab-emoji";
import { TASK_COLOR_HEX, type TaskColor } from "@/lib/task-colors";

const suggestions = ["📚","🎓","💼","🧪","💡","✍️","🎨","🎵","🎮","📷","🎬","🏠","🌱","🌍","✈️","🚲","⚽","🏃","🧘","🍎","☕","🛒","❤️","🐾","🎯","🔧","💻","🔔"];

export function MonochromeEmoji({emoji,color}:{emoji:string;color:TaskColor}){
  if(!tabEmoji(emoji))return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><filter id="outline" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.15" result="outer"/><feMorphology in="SourceAlpha" operator="erode" radius="1.05" result="inner"/><feComposite in="outer" in2="inner" operator="out"/></filter></defs><text x="16" y="25" text-anchor="middle" font-size="25" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" filter="url(#outline)">${emoji}</text></svg>`;
  return <span aria-hidden="true" className="tab-monochrome-emoji" style={{backgroundColor:TASK_COLOR_HEX[color],maskImage:`url("data:image/svg+xml,${encodeURIComponent(svg)}")`}}/>;
}

export default function TabEmojiPicker({value,onChange,color}:{value:string;onChange:(value:string)=>void;color:TaskColor}){
  return <fieldset className="tab-emoji-picker">
    <legend>Emoji als Symbol</legend>
    <div className="tab-emoji-entry">
      <input aria-label="Emoji für den Reiter" placeholder="Windows + . oder Emoji einfügen" maxLength={32} value={value} onChange={(event)=>onChange(event.target.value)}/>
      <MonochromeEmoji emoji={value.trim()} color={color}/>
    </div>
    <div className="tab-emoji-options">
      {suggestions.map((emoji)=><button key={emoji} type="button" aria-label={emoji} aria-pressed={emoji===value} onClick={()=>onChange(emoji)}>{emoji}</button>)}
      {value && <button type="button" onClick={()=>onChange("")}>Standard</button>}
    </div>
  </fieldset>;
}
