import test from "node:test";
import assert from "node:assert/strict";
import { importChoices, importPeople } from "../lib/whatsapp-import.ts";
import { personalContacts } from "../scripts/whatsapp-contacts.mjs";
import type { LifeState } from "../lib/life";
const life = (): LifeState => ({
  city: "Köln",
  friends: [],
  rhythms: [],
  hidden: [],
  labels: {},
  meals: [],
  groups: [],
  tabSettings: {},
  tabOrder: [],
});
const contacts = [
  {
    id: "491111@s.whatsapp.net",
    name: "Anna",
    lastContact: "2026-10-12",
    avatarFile: "test.jpg",
  },
  { id: "492222@s.whatsapp.net", name: "Ben", lastContact: "" },
  { id: "12345@g.us", name: "Gruppe", lastContact: "" },
  { id: "status@broadcast", name: "Status", lastContact: "" },
];
test("only people are offered, selected by default, with profile photos", () => {
  const choices = importChoices(contacts, life());
  assert.deepEqual(
    choices.map((c) => c.name),
    ["Anna", "Ben"],
  );
  assert.ok(choices.every((c) => c.selected && c.isNew));
  assert.match(choices[0].avatar, /^\/api\/whatsapp\/avatar\?id=/);
  assert.equal(choices[1].avatar, "");
});
test("remembered deselection survives import; new contacts are highlighted and selected", () => {
  const state = life();
  state.whatsappImport = {
    selected: { "492222@s.whatsapp.net": false },
    seen: [],
  };
  const result = importPeople(
    contacts,
    state,
    ["491111@s.whatsapp.net"],
    () => "person-anna",
  );
  assert.equal(result.added, 1);
  assert.equal(result.life.friends[0].id, "person-anna");
  const next = importChoices(
    [
      ...contacts,
      { id: "493333@s.whatsapp.net", name: "Clara", lastContact: "" },
    ],
    result.life,
  );
  assert.equal(next.find((c) => c.name === "Ben")!.selected, false);
  assert.equal(next.find((c) => c.name === "Ben")!.isNew, false);
  assert.equal(next.find((c) => c.name === "Clara")!.isNew, true);
  assert.equal(next.find((c) => c.name === "Clara")!.selected, true);
});
test("reimport updates the linked person without changing custom name, group or rhythm", () => {
  const first = importPeople(
    contacts,
    life(),
    ["491111@s.whatsapp.net"],
    () => "anna",
  );
  Object.assign(first.life.friends[0], {
    name: "Anna Uni",
    groupId: "uni",
    interval: 7,
    lastContact: "2026-10-13",
  });
  const second = importPeople(
    contacts,
    first.life,
    ["491111@s.whatsapp.net"],
    () => "unexpected",
  );
  assert.equal(second.life.friends.length, 1);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 1);
  assert.equal(second.life.friends[0].name, "Anna Uni");
  assert.equal(second.life.friends[0].groupId, "uni");
  assert.equal(second.life.friends[0].lastContact, "2026-10-13");
});
test("phone and LID identities merge and preserve old selection and person link", () => {
  const raw = [
    { id: "999@lid", name: "Anna", lastContact: "2026-10-11" },
    {
      id: "491111:2@s.whatsapp.net",
      lid: "999@lid",
      name: "Anna",
      lastContact: "2026-10-12",
    },
  ];
  assert.equal(personalContacts(raw).length, 1);
  const state = life();
  state.friends.push({
    id: "anna",
    name: "Anna",
    whatsappId: "999@lid",
    lastContact: "",
    interval: null,
  });
  state.whatsappImport = { selected: { "999@lid": false }, seen: ["999@lid"] };
  const choices = importChoices(raw, state);
  assert.equal(choices[0].selected, false);
  assert.equal(choices[0].isNew, false);
  assert.equal(choices[0].imported, true);
  assert.equal(
    importPeople(raw, state, [choices[0].id]).life.friends.length,
    1,
  );
});
test("group IDs cannot be imported even when explicitly submitted", () => {
  assert.throws(
    () => importPeople(contacts, life(), ["12345@g.us"]),
    /Kontakt/,
  );
});

test("contacts discovered during import stay new and selected until reviewed", () => {
  const state = life();
  const result = importPeople(
    contacts,
    state,
    ["491111@s.whatsapp.net"],
    () => "anna",
    ["491111@s.whatsapp.net"],
  );
  const ben = importChoices(contacts, result.life).find(
    (c) => c.name === "Ben",
  )!;
  assert.equal(ben.isNew, true);
  assert.equal(ben.selected, true);
});
