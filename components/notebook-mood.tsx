"use client";

import { useState } from "react";
import { moodColors, moodLabels, type NotebookMood } from "@/lib/notebook-layout";

export default function NotebookMoodPicker({ day, value, onSave }: {
  day: string;
  value?: NotebookMood;
  onSave: (mood: NotebookMood) => void;
}) {
  const [score,setScore] = useState<number|null>(null);
  const [reason,setReason] = useState("");
  const save = () => {
    if(score===null)return;
    onSave({date:day,score,reason:reason.trim()});
    setScore(null);
  };
  return <div className="notebook-mood-picker" data-editing={score!==null}>
    <div className="notebook-mood-dots">
      {moodColors.map((color,index)=><button key={color} type="button"
        style={{backgroundColor:color}} aria-label={moodLabels[index]}
        aria-pressed={(score ?? value?.score)===index}
        onClick={()=>{setScore(index);setReason(value?.reason||"");}}/>)}
    </div>
    {score!==null && <form className="notebook-mood-form" onSubmit={event=>{
      event.preventDefault();
      save();
    }}>
      <input autoFocus value={reason} maxLength={350} placeholder="Warum?"
        aria-label="Begründung" onChange={event=>setReason(event.target.value)}
        onKeyDown={event=>{
          if(event.key==="Escape"){event.stopPropagation();setScore(null);}
          if(event.key==="Enter"){
            event.preventDefault();
            event.stopPropagation();
            if(!event.nativeEvent.isComposing)save();
          }
        }}/>
      <button type="submit" aria-label="Stimmung speichern">✓</button>
    </form>}
  </div>;
}
