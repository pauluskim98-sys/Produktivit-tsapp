import test from "node:test";
import assert from "node:assert/strict";
import { issueSession, randomToken, sessionSubject } from "../lib/private-account.ts";

test("only verified session signatures select a Google subject", async () => {
  const key=randomToken(), subject="google-user-100";
  const value=await issueSession(key,subject);
  assert.equal(await sessionSubject(value,key),subject);
  assert.equal(await sessionSubject(await issueSession(key,"google-user-101"),key),"google-user-101");
  assert.equal(await sessionSubject(value,randomToken()),null);
  assert.equal(await sessionSubject((value[0]==="a"?"b":"a")+value.slice(1),key),null);
  assert.equal(await sessionSubject(undefined,key),null);
});
