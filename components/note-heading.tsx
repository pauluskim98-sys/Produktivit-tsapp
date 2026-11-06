import { ChevronLeft, ChevronRight } from "lucide-react";
export default function NoteHeading({ label, onStep }: {label:string;onStep?:(direction:number)=>void}) {
  return <h3 className="note-heading">{onStep && <button type="button" title="Vorherige Notiz" aria-label="Vorherige Notiz" onClick={()=>onStep(-1)}><ChevronLeft size={16}/></button>}<span>{label}</span>{onStep && <button type="button" title="Nächste Notiz" aria-label="Nächste Notiz" onClick={()=>onStep(1)}><ChevronRight size={16}/></button>}</h3>;
}
