export default function TaskImportanceButtons({ onChange }: { onChange:(important:boolean)=>void }) {
  return <div className="task-importance-actions selection-toolbar"><button className="importance-up" type="button" title="Wichtig" aria-label="Als wichtig markieren" onClick={()=>onChange(true)}>▲</button><button className="importance-down" type="button" title="Unwichtig" aria-label="Als unwichtig markieren" onClick={()=>onChange(false)}>▼</button></div>;
}
