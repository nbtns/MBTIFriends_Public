import assert from "node:assert/strict";
import test from "node:test";
import { COMPATIBILITY_WEIGHTS, compatibility, introductionSuggestion } from "../lib/tomotype-model.ts";

const me = { displayName: "わたし", mbti: "ENFP", zodiac: "aquarius", preferences: { energy: 1, planning: -1, conversation: -1, place: 1, invitation: -1 } };
const friend = { displayName: "ミナ", mbti: "INFJ", zodiac: "pisces", preferences: { energy: -1, planning: -1, conversation: -1, place: -1, invitation: -1 } };

test("相性値は0から100の範囲で、比較する順番を変えても同じ", () => {
  const forward = compatibility(me, friend);
  const reverse = compatibility(friend, me);
  assert.equal(forward.overall, reverse.overall);
  assert.ok(forward.metrics.every((metric) => !metric.available || (metric.value >= 0 && metric.value <= 100)));
  assert.deepEqual(forward.metrics.map((metric) => metric.value), reverse.metrics.map((metric) => metric.value));
});

test("総合相性はMBTI 42.5%・星座22.5%・実際の好み35%の配分にする", () => {
  const weights = COMPATIBILITY_WEIGHTS;
  const percent = (value) => Math.round(value * 1000) / 10;
  const percentages = {
    mbti: percent((weights.conversation.mbti + weights.planning.mbti + weights.support.mbti) / 4),
    zodiac: percent((weights.outing.zodiac + weights.support.zodiac) / 4),
    preferences: percent((weights.conversation.preference + weights.outing.energy + weights.outing.place + weights.planning.planning + weights.planning.invitation + weights.support.preference) / 4),
  };

  assert.deepEqual(percentages, { mbti: 42.5, zodiac: 22.5, preferences: 35 });
});

test("情報がない友達へ架空の相性パーセントを表示しない", () => {
  const unknown = compatibility({ displayName: "A", mbti: null, zodiac: null, preferences: {} }, { displayName: "B", mbti: null, zodiac: null, preferences: {} });
  assert.equal(unknown.overall, null);
  assert.ok(unknown.metrics.every((metric) => metric.available === false));
});

test("紹介提案は低い相性でも否定せず、場面と話題を返す", () => {
  const suggestion = introductionSuggestion(me, friend);
  assert.ok(suggestion.title.length > 0);
  assert.ok(suggestion.text.length > 0);
  assert.ok(suggestion.topic.length > 0);
  assert.doesNotMatch(`${suggestion.title}${suggestion.text}`, /紹介しない|相性が悪い|合わない/);
});
