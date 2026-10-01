import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateAge, normalizeBirthday, normalizeProfile, zodiacFromBirthday } from "../lib/tomotype-model.ts";

const TODAY = new Date("2026-08-08T12:00:00+09:00");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("生年月日は実在するYYYY-MM-DDだけを受け入れ、未来日は拒否する", () => {
  assert.equal(normalizeBirthday("2000-02-29", TODAY), "2000-02-29");
  assert.equal(normalizeBirthday("2024-02-29", TODAY), "2024-02-29");
  for (const invalid of [
    "2000-2-29",
    "2000/02/29",
    "1900-02-29",
    "2023-02-29",
    "2000-02-30",
    "2000-13-01",
    "2026-08-09",
    "",
  ]) {
    assert.equal(normalizeBirthday(invalid, TODAY), null, `${invalid} は無効であるべき`);
  }
});

test("現在年齢は誕生日前後で正しく切り替わる", () => {
  assert.equal(calculateAge("2000-08-08", new Date("2026-08-07T12:00:00+09:00")), 25);
  assert.equal(calculateAge("2000-08-08", new Date("2026-08-08T12:00:00+09:00")), 26);
  assert.equal(calculateAge("2000-08-08", new Date("2026-08-09T12:00:00+09:00")), 26);
});

test("2月29日生まれは平年の3月1日に年齢が増える", () => {
  assert.equal(calculateAge("2000-02-29", new Date("2025-02-28T12:00:00+09:00")), 24);
  assert.equal(calculateAge("2000-02-29", new Date("2025-03-01T12:00:00+09:00")), 25);
  assert.equal(calculateAge("2000-02-29", new Date("2024-02-29T12:00:00+09:00")), 24);
});

test("生年月日から星座を境界日どおりに判定する", () => {
  const cases = [
    ["2000-01-19", "capricorn"], ["2000-01-20", "aquarius"],
    ["2000-02-18", "aquarius"], ["2000-02-19", "pisces"],
    ["2000-03-20", "pisces"], ["2000-03-21", "aries"],
    ["2000-04-19", "aries"], ["2000-04-20", "taurus"],
    ["2000-05-20", "taurus"], ["2000-05-21", "gemini"],
    ["2000-06-21", "gemini"], ["2000-06-22", "cancer"],
    ["2000-07-22", "cancer"], ["2000-07-23", "leo"],
    ["2000-08-22", "leo"], ["2000-08-23", "virgo"],
    ["2000-09-22", "virgo"], ["2000-09-23", "libra"],
    ["2000-10-23", "libra"], ["2000-10-24", "scorpio"],
    ["2000-11-22", "scorpio"], ["2000-11-23", "sagittarius"],
    ["2000-12-21", "sagittarius"], ["2000-12-22", "capricorn"],
  ];
  for (const [birthday, expected] of cases) {
    assert.equal(zodiacFromBirthday(birthday), expected, birthday);
  }
  assert.equal(zodiacFromBirthday("2000-02-29"), "pisces");
  assert.equal(zodiacFromBirthday("not-a-date"), null);
});

test("星座は12星座の記号、誕生日はオリジナル線画で表示する", async () => {
  const page = await read("../app/page.tsx");
  const model = await read("../lib/tomotype-model.ts");
  const platform = await read("../lib/mobile-platform.ts");
  const icons = await read("../app/tomotype-icons.tsx");

  assert.match(page, /<ZodiacIcon zodiac=/);
  assert.match(page, /<BirthdayIcon \/>/);
  assert.match(icons, /const ZODIAC_SYMBOLS: Record<Zodiac, string>/);
  for (const symbol of ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]) {
    assert.match(icons, new RegExp(symbol));
  }
  assert.doesNotMatch(icons, /CONSTELLATIONS|<polyline/);
  assert.doesNotMatch(`${page}${model}${platform}`, /[🎂☺♙♥]/u);
});

test("旧zodiac-onlyデータと旧QRを引き続き受け入れる", async () => {
  const model = await read("../lib/tomotype-model.ts");
  const page = await read("../app/page.tsx");
  const decodeCard = page.slice(page.indexOf("function decodeCard"), page.indexOf("function uid"));

  const legacyProfile = normalizeProfile({ displayName: "旧データ", mbti: "ENFP", zodiac: "aquarius" });
  assert.ok(legacyProfile);
  assert.equal(legacyProfile.birthday, null);
  assert.equal(legacyProfile.zodiac, "aquarius");
  const shareCard = model.slice(model.indexOf("export type ShareCard"), model.indexOf("export type CompatibilityMetric"));
  assert.match(shareCard, /birthday\?:/);
  assert.match(decodeCard, /parsed\.v !== 1/);
  assert.match(decodeCard, /normalizeBirthday\(parsed\.birthday/);
  assert.doesNotMatch(decodeCard, /!parsed\.birthday|birthday\)\s*return null/);
});

test("通知は設定をONにした操作でだけ権限を求め、年次予約を再構築する", async () => {
  const platform = await read("../lib/mobile-platform.ts");
  const helperStart = platform.indexOf("export async function syncBirthdayNotifications");
  assert.notEqual(helperStart, -1);
  const helper = platform.slice(helperStart);

  assert.match(platform, /@capacitor\/local-notifications/);
  assert.match(helper, /requestPermission = false/);
  assert.match(helper, /requestPermission[\s\S]{0,160}LocalNotifications\.requestPermissions\(\)/);
  assert.match(platform, /LocalNotifications\.getPending\(\)/);
  assert.match(platform, /LocalNotifications\.cancel\(/);
  assert.match(helper, /cancelManagedBirthdayNotifications\(\)/);
  assert.match(helper, /LocalNotifications\.schedule\(/);
  assert.match(helper, /on:\s*\{\s*month:[\s\S]*?day:/);
  assert.doesNotMatch(helper, /on:\s*\{[^}]*year:/);

  const outsideHelper = platform.slice(0, helperStart);
  assert.doesNotMatch(outsideHelper, /LocalNotifications\.requestPermissions\(\)/);
});

test("起動・友達変更・削除では権限を尋ねず通知を再同期する", async () => {
  const page = await read("../app/page.tsx");
  assert.match(page, /syncBirthdayNotifications\(birthdayReminders\)/);
  assert.match(page, /syncBirthdayNotifications\(birthdayReminders,\s*true\)/);

  const syncEffect = page.slice(page.indexOf("const birthdayReminders"), page.indexOf("}, [birthdayReminders") + 160);
  assert.match(syncEffect, /friends\.flatMap/);
  assert.match(syncEffect, /friend\.birthday/);
  assert.match(syncEffect, /cancelBirthdayNotifications\(\)/);
  assert.match(syncEffect, /settings\.birthdayNotifications/);
  assert.match(syncEffect, /\[birthdayReminders, hydrated, nativePlatform,[^\]]*settings\.birthdayNotifications\]/);
});
