import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeProfile, normalizeFriend } from "../lib/tomotype-model.ts";

test("架空のデモバックアップを既存の復元形式で読み込める", async () => {
  const demo = JSON.parse(await readFile(new URL("../docs/demo-backup.json", import.meta.url), "utf8"));
  assert.equal(demo.version, 3);
  assert.ok(normalizeProfile(demo.profile));
  assert.equal(demo.friends.length, 4);
  assert.equal(new Set(demo.friends.map((friend) => friend.id)).size, 4);
  for (const friend of demo.friends) {
    assert.deepEqual(normalizeFriend(friend, () => "fallback"), friend);
  }
  assert.equal(demo.settings.birthdayNotifications, false);
});
