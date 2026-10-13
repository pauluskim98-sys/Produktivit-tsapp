"use client";
import { useEffect, useState } from "react";
export default function PersonAvatar({
  person,
  src,
  name,
  small = false,
}: {
  person?: string;
  src?: string;
  name: string;
  small?: boolean;
}) {
  const url =
    src ||
    (person ? `/api/whatsapp/avatar?person=${encodeURIComponent(person)}` : "");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => setFailed(false), [url]);
  useEffect(() => {
    const refresh = () => {
      setFailed(false);
      setRevision((n) => n + 1);
    };
    window.addEventListener("raum-whatsapp-avatars", refresh);
    return () => window.removeEventListener("raum-whatsapp-avatars", refresh);
  }, []);
  const initials = name
    .replace(/^Treffen mit\s+/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`person-avatar ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {url && !failed ? (
        <img
          src={`${url}${revision ? `&v=${revision}` : ""}`}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </span>
  );
}
export function TaskPersonAvatar({
  todo,
  small = false,
}: {
  todo: { tags: string[]; title: string };
  small?: boolean;
}) {
  const person = todo.tags.find((tag) => tag.startsWith("k:"))?.slice(2);
  return person ? (
    <PersonAvatar person={person} name={todo.title} small={small} />
  ) : null;
}
