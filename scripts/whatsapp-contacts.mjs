/** Personal WhatsApp identities only; excludes groups, broadcasts and channels. */
export function personJid(value) {
  if (typeof value !== "string") return "";
  const match = /^(\d{1,30})(?::\d+)?@(s\.whatsapp\.net|lid)$/.exec(value);
  return match ? `${match[1]}@${match[2]}` : "";
}
export function personalContacts(list = []) {
  const result = [];
  for (const c of list) {
    if (!personJid(c?.id)) continue;
    const aliases = [
      ...new Set(
        [c.id, c.phoneNumber, c.lid, ...(c.aliases || [])]
          .map(personJid)
          .filter(Boolean),
      ),
    ];
    const id = aliases.find((s) => s.endsWith("@s.whatsapp.net")) || aliases[0];
    const matches = result.filter((p) =>
      p.aliases.some((a) => aliases.includes(a)),
    );
    const previous = matches[0];
    const row = {
      ...previous,
      ...c,
      id,
      aliases: [...new Set([...aliases, ...matches.flatMap((p) => p.aliases)])],
      name:
        c.name ||
        c.notify ||
        c.verifiedName ||
        c.pushName ||
        previous?.name ||
        (id.endsWith("@s.whatsapp.net") ? `+${id.split("@")[0]}` : "Kontakt"),
      lastContact:
        [c.lastContact || "", ...matches.map((p) => p.lastContact || "")]
          .sort()
          .at(-1) || "",
    };
    if (!c.avatarFile && previous?.avatarFile)
      row.avatarFile = previous.avatarFile;
    for (const old of matches) result.splice(result.indexOf(old), 1);
    result.push(row);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "de"));
}
export function matchesContact(contact, id) {
  return contact.aliases.includes(personJid(id));
}
