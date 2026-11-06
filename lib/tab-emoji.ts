export function tabEmoji(value:string) {
  if(!value || value.length>32 || !/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u.test(value) ||
    !/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3\u{E0020}-\u{E007F}0-9#*]+$/u.test(value))return false;
  return [...new Intl.Segmenter().segment(value)].length===1;
}
