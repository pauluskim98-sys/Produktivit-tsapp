import type { ReactNode } from "react";

const days=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

export function RepeatPicker({legend,children}:{legend:string;children:ReactNode}) {
  return <details className="repeat-details">
    <summary>Wiederholen</summary>
    <fieldset className="repeat-picker"><legend>{legend}</legend>{children}</fieldset>
  </details>;
}
export function RepeatDays({selected,onChange}:{selected:number[];onChange:(days:number[])=>void}) {
  return <div className="repeat-days">
    {days.map((day,index)=><button type="button" key={day} aria-label={day} aria-pressed={selected.includes(index)}
      onClick={()=>onChange(selected.includes(index)?selected.filter((item)=>item!==index):[...selected,index])}>{day.slice(0,2)}</button>)}
  </div>;
}
export function RepeatWeeks({value,onChange,custom=false}:{value:number;onChange:(weeks:number)=>void;custom?:boolean}) {
  return <label>Zeitraum <select value={value} onChange={(event)=>onChange(Number(event.target.value))}>
    {custom && <option value={0}>Enddatum wählen …</option>}
    {[4,8,12,26,52].map((weeks)=><option key={weeks} value={weeks}>{weeks} Wochen</option>)}
  </select></label>;
}
