import type { Friend, LifeState } from "./life";
import {
  personalContacts,
  matchesContact,
} from "../scripts/whatsapp-contacts.mjs";
export interface WhatsappContact {
  id: string;
  name: string;
  aliases?: string[];
  lastContact: string;
  avatarFile?: string;
}
type PersonalContact = WhatsappContact & { aliases: string[] };
export function importChoices(contacts: WhatsappContact[], life: LifeState) {
  const prefs = life.whatsappImport || { selected: {}, seen: [] };
  return (personalContacts(contacts) as PersonalContact[]).map((c) => {
    const remembered = c.aliases.find((id) =>
      Object.hasOwn(prefs.selected, id),
    );
    return {
      id: c.id,
      name: c.name,
      lastContact: c.lastContact,
      avatar: c.avatarFile
        ? `/api/whatsapp/avatar?id=${encodeURIComponent(c.id)}`
        : "",
      selected: remembered ? prefs.selected[remembered] : true,
      isNew: !c.aliases.some((id) => prefs.seen.includes(id)),
      imported: life.friends.some((f) => matchesContact(c, f.whatsappId)),
    };
  });
}
export function importPeople(
  contacts: WhatsappContact[],
  life: LifeState,
  ids: string[],
  makeId = () => crypto.randomUUID(),
  reviewedIds?: string[],
) {
  const people = personalContacts(contacts) as PersonalContact[];
  const reviewed = reviewedIds || people.map((c) => c.id);
  if (ids.some((id) => !reviewed.includes(id)))
    throw new Error("Bitte die Kontaktauswahl erneut prüfen.");
  const selected = people.filter((c) => ids.includes(c.id));
  if (ids.some((id) => !people.some((c) => c.id === id)))
    throw new Error("Die Kontaktliste hat sich geändert. Bitte erneut prüfen.");
  let added = 0,
    updated = 0;
  const friends: Friend[] = structuredClone(life.friends);
  for (const c of selected) {
    const existing = friends.findIndex((f) => matchesContact(c, f.whatsappId));
    const avatar = c.avatarFile
      ? `/api/whatsapp/avatar?id=${encodeURIComponent(c.id)}`
      : "";
    if (existing !== -1) {
      const f = friends[existing];
      friends[existing] = {
        ...f,
        whatsappId: c.id,
        avatar: avatar || f.avatar,
        lastContact:
          c.lastContact > f.lastContact ? c.lastContact : f.lastContact,
      };
      updated++;
    } else {
      friends.push({
        id: makeId(),
        name: c.name.slice(0, 100),
        whatsappId: c.id,
        avatar,
        lastContact: c.lastContact || "",
        interval: null,
        meetInterval: null,
        groupId: "",
      });
      added++;
    }
  }
  if (friends.length > 5000)
    throw new Error("Es können höchstens 5000 Personen übernommen werden.");
  const selectedPrefs = { ...life.whatsappImport?.selected };
  const confirmed = people.filter((c) => reviewed.includes(c.id));
  for (const c of confirmed)
    for (const id of c.aliases) selectedPrefs[id] = ids.includes(c.id);
  return {
    life: {
      ...life,
      friends,
      whatsappImport: {
        selected: selectedPrefs,
        seen: [
          ...new Set([
            ...(life.whatsappImport?.seen || []),
            ...confirmed.flatMap((c) => c.aliases),
          ]),
        ],
      },
    },
    added,
    updated,
  };
}
