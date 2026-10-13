"use client";
import { useState } from "react";
import { MessageCircle, Users, FolderPlus, Plus, Check } from "lucide-react";
import type { LifeState, Friend } from "@/lib/life";
import type { Todo } from "@/lib/types";
import { dateKey } from "@/lib/dates";
import SocialPerson from "./social-person";
import PersonAvatar from "./person-avatar";
export default function SocialCircle({
  life,
  todos,
  save,
  add,
}: {
  life: LifeState;
  todos: Todo[];
  save: (s: LifeState) => Promise<boolean>;
  add: (title: string, tags: string[], notes: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [meeting, setMeeting] = useState(""),
    [group, setGroup] = useState(""),
    [open, setOpen] = useState<string | null>(null),
    [folder, setFolder] = useState(false),
    [folderName, setFolderName] = useState("");
  const today = dateKey(new Date());
  const status = (f: Friend) => {
    const last = todos
      .filter(
        (t) =>
          t.tags.includes(`k:${f.id}`) &&
          t.plannedDate &&
          t.plannedDate <= today &&
          (t.done || t.plannedDate < today),
      )
      .sort((a, b) =>
        b.plannedDate!.localeCompare(a.plannedDate!),
      )[0]?.plannedDate;
    const good = (
      last: string | null | undefined,
      interval: number | null | undefined,
    ) =>
      !interval
        ? null
        : !!last &&
          (Date.parse(today) - Date.parse(last)) / 86400000 < interval;
    return {
      contact: good(f.lastContact, f.interval),
      meet: good(last, f.meetInterval),
      last,
    };
  };
  const members = (id: string) =>
    life.friends.filter((f) => (f.groupId || "") === id);
  const icons = (f: Friend) => {
    const s = status(f);
    return (
      <span className="person-health">
        <Users
          size={13}
          className={s.meet === null ? "unknown" : s.meet ? "good" : "due"}
        />
        <MessageCircle
          size={13}
          className={
            s.contact === null ? "unknown" : s.contact ? "good" : "due"
          }
        />
      </span>
    );
  };
  return (
    <section className="relationship-panel">
      <div className="relationship-tools">
        <button onClick={() => setAdding(!adding)}>
          <Plus size={14} /> Person hinzufügen
        </button>
        <button
          aria-label="Untergruppe erstellen"
          onClick={() => setFolder(!folder)}
        >
          <FolderPlus size={17} />
        </button>
      </div>
      {folder && (
        <form
          data-escape-layer
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              folderName.trim() &&
              (await save({
                ...life,
                groups: [
                  ...life.groups,
                  { id: crypto.randomUUID(), name: folderName.trim() },
                ],
              }))
            ) {
              setFolder(false);
              setFolderName("");
            }
          }}
        >
          <button
            hidden
            data-close
            type="button"
            onClick={() => setFolder(false)}
          >
            Schließen
          </button>
          <input
            aria-label="Gruppenname"
            placeholder="Familie, Studium, Freunde …"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            required
            maxLength={100}
          />
          <button>Gruppe anlegen</button>
        </form>
      )}
      {adding && (
        <form
          data-escape-layer
          className="friend-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            if (
              await save({
                ...life,
                friends: [
                  ...life.friends,
                  {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    lastContact: "",
                    interval: contact ? Number(contact) : null,
                    meetInterval: meeting ? Number(meeting) : null,
                    groupId: group,
                  },
                ],
              })
            ) {
              setName("");
              setAdding(false);
            }
          }}
        >
          <button
            hidden
            data-close
            type="button"
            onClick={() => setAdding(false)}
          >
            Schließen
          </button>
          <input
            aria-label="Name der Person"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
          <label>
            Kontakt alle{" "}
            <input
              aria-label="Kontaktabstand"
              type="number"
              min={1}
              max={3650}
              placeholder="optional"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />{" "}
            Tage
          </label>
          <label>
            Treffen alle{" "}
            <input
              aria-label="Treffabstand"
              type="number"
              min={1}
              max={3650}
              placeholder="optional"
              value={meeting}
              onChange={(e) => setMeeting(e.target.value)}
            />{" "}
            Tage
          </label>
          <select
            aria-label="Kontaktgruppe"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Ohne Gruppe</option>
            {life.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button>Hinzufügen</button>
        </form>
      )}
      {[...life.groups, { id: "", name: "Weitere Personen" }]
        .filter((g) => g.id || members("").length)
        .map((g) => {
          const people = members(g.id);
          const measured = people.filter((f) => f.interval),
            healthy = measured.filter((f) => status(f).contact).length;
          return (
            <section
              className="contact-folder"
              key={g.id}
              data-escape-layer={open === g.id ? "" : undefined}
            >
              {open === g.id && (
                <button
                  hidden
                  data-close
                  type="button"
                  onClick={() => setOpen(null)}
                >
                  Schließen
                </button>
              )}
              <button
                className="folder-heading"
                aria-expanded={open === g.id}
                onClick={() => setOpen(open === g.id ? null : g.id)}
              >
                <FolderPlus size={18} />
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {people.length} Personen ·{" "}
                    {measured.length
                      ? `${healthy}/${measured.length} im Kontaktrhythmus`
                      : "Ohne Kontaktziel"}
                  </small>
                </span>
                <span>{open === g.id ? "−" : "＋"}</span>
              </button>
              {open !== g.id && people.length > 0 && (
                <div className="folder-preview" role="tooltip">
                  {people.map((f) => (
                    <div key={f.id}>
                      <PersonAvatar person={f.id} name={f.name} small />
                      {f.name}
                      {icons(f)}
                    </div>
                  ))}
                </div>
              )}
              {open === g.id &&
                people.map((f) => (
                  <div className="person-row" key={f.id}>
                    <SocialPerson
                      friend={f}
                      color={life.tabSettings.social?.defaultColor || "green"}
                      onAdd={add}
                    />
                    {icons(f)}
                    <small>
                      {f.lastContact
                        ? `Kontakt ${new Date(f.lastContact + "T12:00:00").toLocaleDateString("de-DE")}`
                        : "Kontakt offen"}
                      {status(f).last ? ` · Treffen ${status(f).last}` : ""}
                    </small>
                    <select
                      aria-label={`Gruppe für ${f.name}`}
                      value={f.groupId || ""}
                      onChange={(e) =>
                        void save({
                          ...life,
                          friends: life.friends.map((x) =>
                            x.id === f.id
                              ? { ...x, groupId: e.target.value }
                              : x,
                          ),
                        })
                      }
                    >
                      <option value="">Ohne Gruppe</option>
                      {life.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-button"
                      title="Heute Kontakt gehabt"
                      onClick={() =>
                        void save({
                          ...life,
                          friends: life.friends.map((x) =>
                            x.id === f.id ? { ...x, lastContact: today } : x,
                          ),
                        })
                      }
                    >
                      <Check size={13} />
                    </button>
                  </div>
                ))}
            </section>
          );
        })}
    </section>
  );
}
