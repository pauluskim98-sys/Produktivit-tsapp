import type { KeyboardEvent } from "react";

export function isTitleKey(event: Pick<KeyboardEvent,"key"|"ctrlKey"|"metaKey"|"altKey">) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && event.key.trim() !== "" &&
    Array.from(event.key).length===1;
}

export function typeTitle(event:KeyboardEvent<HTMLElement>, replace:(value:string)=>void) {
  if(event.target!==event.currentTarget || event.defaultPrevented || event.nativeEvent.isComposing || !isTitleKey(event))return false;
  const field=event.currentTarget.querySelector<HTMLInputElement|HTMLTextAreaElement>("[data-title-field]");
  if(!field || field.disabled)return false;
  event.preventDefault();
  event.stopPropagation();
  replace(event.key);
  field.focus();
  requestAnimationFrame(()=>field.setSelectionRange(field.value.length,field.value.length));
  return true;
}
