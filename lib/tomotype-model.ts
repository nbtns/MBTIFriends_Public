export const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

export const ZODIACS = [
  { slug: "aries", label: "牡羊座", element: "fire" },
  { slug: "taurus", label: "牡牛座", element: "earth" },
  { slug: "gemini", label: "双子座", element: "air" },
  { slug: "cancer", label: "蟹座", element: "water" },
  { slug: "leo", label: "獅子座", element: "fire" },
  { slug: "virgo", label: "乙女座", element: "earth" },
  { slug: "libra", label: "天秤座", element: "air" },
  { slug: "scorpio", label: "蠍座", element: "water" },
  { slug: "sagittarius", label: "射手座", element: "fire" },
  { slug: "capricorn", label: "山羊座", element: "earth" },
  { slug: "aquarius", label: "水瓶座", element: "air" },
  { slug: "pisces", label: "魚座", element: "water" },
] as const;

export type Mbti = (typeof MBTI_TYPES)[number];
export type Zodiac = (typeof ZODIACS)[number]["slug"];
export type PreferenceKey = "energy" | "planning" | "conversation" | "place" | "invitation";
export type PreferenceValue = -1 | 0 | 1;
export type Preferences = Partial<Record<PreferenceKey, PreferenceValue>>;

export type Profile = {
  displayName: string;
  mbti: Mbti;
  zodiac: Zodiac;
  birthday: string | null;
  preferences: Preferences;
};

export type Friend = {
  id: string;
  displayName: string;
  mbti: Mbti | null;
  zodiac: Zodiac | null;
  birthday: string | null;
  preferences: Preferences;
  community: string;
  note: string;
  nextTimeNote: string;
  source?: "manual" | "qr" | "sample";
};

export type ShareCard = {
  v: 1;
  displayName: string;
  mbti: Mbti;
  zodiac: Zodiac;
  birthday?: string | null;
  preferences: Preferences;
};

export type CompatibilityMetric = {
  key: "conversation" | "outing" | "planning" | "support";
  label: string;
  value: number;
  available: boolean;
};

export type CompatibilityGuide = {
  metrics: CompatibilityMetric[];
  overall: number | null;
  together: string[];
  caution: string;
  repair: string;
  headline: string;
};

export const PREFERENCE_DEFINITIONS: Array<{
  key: PreferenceKey;
  label: string;
  hint: string;
  options: Array<{ value: PreferenceValue; label: string }>;
}> = [
  { key: "energy", label: "過ごし方", hint: "一緒にいる日の気分", options: [{ value: -1, label: "静かに" }, { value: 0, label: "どちらも" }, { value: 1, label: "にぎやかに" }] },
  { key: "planning", label: "予定の決め方", hint: "約束を決めるペース", options: [{ value: -1, label: "先に決める" }, { value: 0, label: "どちらも" }, { value: 1, label: "その場で" }] },
  { key: "conversation", label: "会話", hint: "心地よい話題", options: [{ value: -1, label: "深い話" }, { value: 0, label: "どちらも" }, { value: 1, label: "軽い雑談" }] },
  { key: "place", label: "お出かけ", hint: "選びやすい場所", options: [{ value: -1, label: "室内で" }, { value: 0, label: "どちらも" }, { value: 1, label: "外で活動" }] },
  { key: "invitation", label: "誘い方", hint: "うれしい誘われ方", options: [{ value: -1, label: "早めに" }, { value: 0, label: "どちらも" }, { value: 1, label: "直前でもOK" }] },
];

export const MBTI_TONE: Record<string, { name: string; color: string; light: string; ink: string }> = {
  NT: { name: "ひらめきの探究者", color: "#88619a", light: "#f3edf6", ink: "#ffffff" },
  NF: { name: "想いのナビゲーター", color: "#33a474", light: "#e7f5ef", ink: "#ffffff" },
  SJ: { name: "安心のつくり手", color: "#4298b4", light: "#e8f4f8", ink: "#ffffff" },
  SP: { name: "今を楽しむ冒険家", color: "#e4ae3a", light: "#fff5d8", ink: "#3d2d08" },
};

export const MBTI_LABELS: Record<Mbti, string> = {
  INTJ: "建築家",
  INTP: "論理学者",
  ENTJ: "指揮官",
  ENTP: "討論者",
  INFJ: "提唱者",
  INFP: "仲介者",
  ENFJ: "主人公",
  ENFP: "運動家",
  ISTJ: "管理者",
  ISFJ: "擁護者",
  ESTJ: "幹部",
  ESFJ: "領事",
  ISTP: "巨匠",
  ISFP: "冒険家",
  ESTP: "起業家",
  ESFP: "エンターテイナー",
};

export function isMbti(value: unknown): value is Mbti {
  return typeof value === "string" && MBTI_TYPES.includes(value as Mbti);
}

export function isZodiac(value: unknown): value is Zodiac {
  return typeof value === "string" && ZODIACS.some((item) => item.slug === value);
}

export function zodiacOf(slug: Zodiac | null) {
  return ZODIACS.find((item) => item.slug === slug) ?? null;
}

function localDateParts(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function normalizeBirthday(value: unknown, today = new Date()): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (year < 1900 || candidate.getFullYear() !== year || candidate.getMonth() + 1 !== month || candidate.getDate() !== day) return null;
  const now = localDateParts(today);
  if (year > now.year || (year === now.year && (month > now.month || (month === now.month && day > now.day)))) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function zodiacFromBirthday(birthday: string): Zodiac | null {
  const normalized = normalizeBirthday(birthday, new Date(9999, 11, 31));
  if (!normalized) return null;
  const [, monthText, dayText] = normalized.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  const monthDay = month * 100 + day;
  if (monthDay >= 321 && monthDay <= 419) return "aries";
  if (monthDay >= 420 && monthDay <= 520) return "taurus";
  if (monthDay >= 521 && monthDay <= 621) return "gemini";
  if (monthDay >= 622 && monthDay <= 722) return "cancer";
  if (monthDay >= 723 && monthDay <= 822) return "leo";
  if (monthDay >= 823 && monthDay <= 922) return "virgo";
  if (monthDay >= 923 && monthDay <= 1023) return "libra";
  if (monthDay >= 1024 && monthDay <= 1122) return "scorpio";
  if (monthDay >= 1123 && monthDay <= 1221) return "sagittarius";
  if (monthDay >= 1222 || monthDay <= 119) return "capricorn";
  if (monthDay <= 218) return "aquarius";
  return "pisces";
}

export function calculateAge(birthday: string, today = new Date()): number | null {
  const normalized = normalizeBirthday(birthday, today);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const now = localDateParts(today);
  const birthdayReached = now.month > month || (now.month === month && now.day >= day);
  return now.year - year - (birthdayReached ? 0 : 1);
}

export function formatBirthday(birthday: string | null) {
  if (!birthday) return null;
  const [year, month, day] = birthday.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function mbtiGroupOf(mbti: Mbti | null) {
  if (!mbti) return null;
  return mbti[1] === "N" ? `N${mbti[2]}` : `S${mbti[3]}`;
}

export function toneOf(mbti: Mbti | null) {
  if (!mbti) return { name: "タイプ未登録", color: "#706873", light: "#f0ecef", ink: "#ffffff" };
  return MBTI_TONE[mbtiGroupOf(mbti) ?? "SP"] ?? MBTI_TONE.SP;
}

export function mbtiLabelOf(mbti: Mbti) {
  return MBTI_LABELS[mbti];
}

export function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  return PREFERENCE_DEFINITIONS.reduce<Preferences>((result, definition) => {
    const candidate = input[definition.key];
    if (candidate === -1 || candidate === 0 || candidate === 1) result[definition.key] = candidate;
    return result;
  }, {});
}

export function preferenceLabel(key: PreferenceKey, value: PreferenceValue) {
  const definition = PREFERENCE_DEFINITIONS.find((item) => item.key === key);
  return definition?.options.find((option) => option.value === value)?.label ?? "未登録";
}

export function preferenceEntries(preferences: Preferences) {
  return PREFERENCE_DEFINITIONS.flatMap((definition) => {
    const value = preferences[definition.key];
    return value === undefined ? [] : [{ ...definition, value, valueLabel: preferenceLabel(definition.key, value) }];
  });
}

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const birthday = normalizeBirthday(candidate.birthday);
  const zodiac = birthday ? zodiacFromBirthday(birthday) : isZodiac(candidate.zodiac) ? candidate.zodiac : null;
  if (!isMbti(candidate.mbti) || !zodiac) return null;
  return {
    displayName: safeString(candidate.displayName, 24),
    mbti: candidate.mbti,
    zodiac,
    birthday,
    preferences: normalizePreferences(candidate.preferences),
  };
}

export function normalizeFriend(value: unknown, fallbackId: () => string): Friend | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const mbti = candidate.mbti == null || candidate.mbti === "" ? null : isMbti(candidate.mbti) ? candidate.mbti : null;
  const birthday = normalizeBirthday(candidate.birthday);
  const zodiac = birthday ? zodiacFromBirthday(birthday) : candidate.zodiac == null || candidate.zodiac === "" ? null : isZodiac(candidate.zodiac) ? candidate.zodiac : null;
  const source = candidate.source === "manual" || candidate.source === "qr" || candidate.source === "sample" ? candidate.source : "manual";
  return {
    id: safeString(candidate.id, 80) || fallbackId(),
    displayName: safeString(candidate.displayName, 24),
    mbti,
    zodiac,
    birthday,
    preferences: normalizePreferences(candidate.preferences),
    community: safeString(candidate.community, 32),
    note: safeString(candidate.note, 200),
    nextTimeNote: safeString(candidate.nextTimeNote, 300),
    source,
  };
}

type ComparablePerson = Pick<Profile, "displayName" | "preferences"> & { mbti: Mbti | null; zodiac: Zodiac | null };

function weightedAverage(values: Array<{ value: number | null; weight: number }>) {
  const available = values.filter((item): item is { value: number; weight: number } => item.value !== null);
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight
    ? Math.round(available.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
    : null;
}

function preferenceMatch(left: ComparablePerson, right: ComparablePerson, key: PreferenceKey) {
  const leftValue = left.preferences[key];
  const rightValue = right.preferences[key];
  if (leftValue === undefined || rightValue === undefined) return null;
  return 94 - Math.abs(leftValue - rightValue) * 13;
}

function mbtiMatch(left: ComparablePerson, right: ComparablePerson, indexes: number[]) {
  if (!left.mbti || !right.mbti) return null;
  const same = indexes.filter((index) => left.mbti?.[index] === right.mbti?.[index]).length;
  return 70 + Math.round((same / indexes.length) * 22);
}

function zodiacMatch(left: ComparablePerson, right: ComparablePerson) {
  const leftZodiac = zodiacOf(left.zodiac);
  const rightZodiac = zodiacOf(right.zodiac);
  if (!leftZodiac || !rightZodiac) return null;
  if (leftZodiac.element === rightZodiac.element) return 90;
  const pair = [leftZodiac.element, rightZodiac.element];
  if ((pair.includes("fire") && pair.includes("air")) || (pair.includes("earth") && pair.includes("water"))) return 86;
  return 72;
}

function metric(key: CompatibilityMetric["key"], label: string, values: Array<{ value: number | null; weight: number }>): CompatibilityMetric {
  const value = weightedAverage(values);
  return { key, label, value: value ?? 0, available: value !== null };
}

export const COMPATIBILITY_WEIGHTS = {
  conversation: { preference: 0.3, mbti: 0.7 },
  outing: { energy: 0.25, place: 0.25, zodiac: 0.5 },
  planning: { planning: 0.2, invitation: 0.2, mbti: 0.6 },
  support: { preference: 0.2, mbti: 0.4, zodiac: 0.4 },
} as const;

export function compatibility(left: ComparablePerson, right: ComparablePerson): CompatibilityGuide {
  const weights = COMPATIBILITY_WEIGHTS;
  const metrics = [
    metric("conversation", "会話のテンポ", [
      { value: preferenceMatch(left, right, "conversation"), weight: weights.conversation.preference },
      { value: mbtiMatch(left, right, [0, 1]), weight: weights.conversation.mbti },
    ]),
    metric("outing", "遊びの好み", [
      { value: preferenceMatch(left, right, "energy"), weight: weights.outing.energy },
      { value: preferenceMatch(left, right, "place"), weight: weights.outing.place },
      { value: zodiacMatch(left, right), weight: weights.outing.zodiac },
    ]),
    metric("planning", "予定の決め方", [
      { value: preferenceMatch(left, right, "planning"), weight: weights.planning.planning },
      { value: preferenceMatch(left, right, "invitation"), weight: weights.planning.invitation },
      { value: mbtiMatch(left, right, [3]), weight: weights.planning.mbti },
    ]),
    metric("support", "支え合い方", [
      { value: preferenceMatch(left, right, "conversation"), weight: weights.support.preference },
      { value: mbtiMatch(left, right, [2]), weight: weights.support.mbti },
      { value: zodiacMatch(left, right), weight: weights.support.zodiac },
    ]),
  ];
  const availableMetrics = metrics.filter((item) => item.available);
  const overall = availableMetrics.length ? Math.round(availableMetrics.reduce((sum, item) => sum + item.value, 0) / availableMetrics.length) : null;
  const rightPlace = right.preferences.place;
  const rightEnergy = right.preferences.energy;
  const together = rightPlace === -1
    ? ["落ち着くカフェで話す", "映画や展示を一緒に見る", "家で好きなものを持ち寄る"]
    : rightPlace === 1
      ? ["気になる街を歩く", "体験イベントへ行く", "季節の景色を見に行く"]
      : right.mbti?.[1] === "N"
        ? ["テーマを決めない街歩き", "未来のやりたいこと会議", "企画展や小さなイベント"]
        : ["気になる店を食べ歩く", "一緒に何かを作る休日", "近場の新しい場所を試す"];
  const planningDifference = left.preferences.planning !== undefined && right.preferences.planning !== undefined
    ? Math.abs(left.preferences.planning - right.preferences.planning)
    : null;
  const caution = planningDifference !== null && planningDifference >= 2
    ? "予定を決めたい時期が違いそう。大事な時間と場所だけ先に決め、残りは余白にすると心地よく過ごせそう。"
    : rightEnergy === 1
      ? "楽しい流れが続くほど休憩を忘れがち。途中で『少し休む？』と聞けると安心。"
      : "似たペースでも、決めたつもりにならないよう時間と場所だけは言葉にしておこう。";
  const conversationDifference = left.preferences.conversation !== undefined && right.preferences.conversation !== undefined
    ? Math.abs(left.preferences.conversation - right.preferences.conversation)
    : null;
  const repair = conversationDifference !== null && conversationDifference >= 2
    ? "話の深さを求めるタイミングが違うかも。『今は聞いてほしい？ 軽く話したい？』から始めると戻りやすい。"
    : "結論を急ぐ前に『今は聞いてほしい？ 一緒に考える？』を合言葉に。";
  const headline = overall === null
    ? "好みを知るほど、ふたりらしいヒントが育ちます"
    : overall >= 86
      ? "自然と同じ方向を向きやすいふたり"
      : overall >= 77
        ? "似ているところと違うところが、ちょうどいい刺激に"
        : "違いを持ち寄るほど、世界が広がるふたり";
  return { metrics, overall, together, caution, repair, headline };
}

export function introductionSuggestion(left: ComparablePerson, right: ComparablePerson) {
  const guide = compatibility(left, right);
  const best = [...guide.metrics].filter((metric) => metric.available).sort((a, b) => b.value - a.value)[0];
  const intro = best?.key === "conversation"
    ? "共通の好きなことをひとつ伝えてから、3人でゆっくり話せる場がおすすめ。"
    : best?.key === "outing"
      ? "目的のあるお出かけに3人で誘うと、自然に同じ体験を共有できそう。"
      : best?.key === "planning"
        ? "日時と場所を先に共有して、短時間の集まりから始めるのがおすすめ。"
        : "あなたが最初の会話を少しつなぐと、ふたりの良さが見えやすそう。";
  return {
    title: guide.overall !== null && guide.overall >= 84 ? "自然に話し始めやすそう" : "共通点を添えるとつながりやすそう",
    text: intro,
    topic: best?.key === "outing" ? "最近行ってよかった場所" : best?.key === "conversation" ? "最近ちょっと夢中なこと" : "次の休みにしてみたいこと",
  };
}
