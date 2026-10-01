import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const privacyUrl = new URL("../app/privacy/page.tsx", import.meta.url);
const modelUrl = new URL("../lib/tomotype-model.ts", import.meta.url);
const mobilePlatformUrl = new URL("../lib/mobile-platform.ts", import.meta.url);

test("共有データはURLフラグメントに限定する", async () => {
  const source = await readFile(pageUrl, "utf8");
  const mobilePlatform = await readFile(mobilePlatformUrl, "utf8");
  assert.match(mobilePlatform, /#card=\$\{encodedCard\}/);
  assert.match(mobilePlatform, /PUBLIC_SHARE_BASE/);
  assert.doesNotMatch(source, /[?&]card=/);
  assert.doesNotMatch(mobilePlatform, /[?&]card=/);
});

test("QRは本人が確認した生年月日・タイプ・好みだけを共有する", async () => {
  const source = await readFile(modelUrl, "utf8");
  const shareCard = source.slice(source.indexOf("export type ShareCard"), source.indexOf("export type CompatibilityMetric"));
  assert.match(shareCard, /displayName/);
  assert.match(shareCard, /mbti/);
  assert.match(shareCard, /zodiac/);
  assert.match(shareCard, /birthday/);
  assert.match(shareCard, /preferences/);
  assert.doesNotMatch(shareCard, /email|phone|friends|community|nextTimeNote|note/i);
  const page = await readFile(pageUrl, "utf8");
  const shareBuilder = page.slice(page.indexOf("const shareUrl"), page.indexOf("}, [profile])"));
  assert.match(shareBuilder, /birthday:\s*profile\.birthday/);
  assert.match(page, /生年月日[\s\S]*実際の好み/);
});

test("生年月日・年齢計算・誕生日通知の取扱いを公開ポリシーに明記する", async () => {
  const policy = await readFile(privacyUrl, "utf8");
  assert.match(policy, /生年月日/);
  assert.match(policy, /年齢/);
  assert.match(policy, /端末内[\s\S]*計算|計算[\s\S]*端末内/);
  assert.match(policy, /誕生日通知/);
  assert.match(policy, /通知[\s\S]*許可|許可[\s\S]*通知/);
});

test("StellaLogへ友達名やメモを送らない", async () => {
  const source = await readFile(pageUrl, "utf8");
  const helper = source.slice(source.indexOf("function stellaUrl"), source.indexOf("export default function Home"));
  assert.match(helper, /stellalog\.nobyworks\.com\/reading/);
  assert.match(helper, /unisex/);
  assert.doesNotMatch(helper, /displayName|birthday|preferences|nextTimeNote|note|community|friends/);
});
