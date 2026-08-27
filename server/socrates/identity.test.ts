import assert from "node:assert/strict";
import test from "node:test";
import { guestConversationUserId, resolveConversationUserId, TokenVerifier } from "./identity";

const verifyOwner: TokenVerifier = async (token) => {
  if (token !== "owner-token") throw Object.assign(new Error("Decoding Firebase ID token failed"), { code: "auth/argument-error" });
  return { uid: "owner-uid" };
};

test("identity comes from the verified token, not from a client-supplied userId", async () => {
  assert.equal(await resolveConversationUserId("Bearer owner-token", "thread-1", verifyOwner), "owner-uid");
});

test("a rejected token fails the request instead of falling back to guest access", async () => {
  await assert.rejects(() => resolveConversationUserId("Bearer forged-token", "thread-1", verifyOwner), /Decoding Firebase ID token failed/);
});

test("callers without a token stay usable but are namespaced away from real uids", async () => {
  const guest = await resolveConversationUserId(undefined, "thread-guest", verifyOwner);
  assert.equal(guest, guestConversationUserId("thread-guest"));
  assert.notEqual(guest, "owner-uid");
  assert.equal(await resolveConversationUserId("Basic abc", "thread-guest", verifyOwner), guest);
});

test("two guests on different threads never share an identity", async () => {
  const a = await resolveConversationUserId("", "thread-a", verifyOwner);
  const b = await resolveConversationUserId("", "thread-b", verifyOwner);
  assert.notEqual(a, b);
});
