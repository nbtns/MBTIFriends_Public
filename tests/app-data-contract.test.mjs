import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MBTI_TYPES, mbtiLabelOf, normalizeFriend, normalizeProfile, toneOf } from "../lib/tomotype-model.ts";

test("旧プロフィールに好みがなくても安全に移行する", () => {
  assert.deepEqual(normalizeProfile({ displayName: "なつ", mbti: "ENFP", zodiac: "aquarius" }), {
    displayName: "なつ",
    mbti: "ENFP",
    zodiac: "aquarius",
    birthday: null,
    preferences: {},
  });
});

test("16タイプを紫・緑・青・黄の4グループ色に分ける", () => {
  assert.equal(toneOf("INTJ").color, "#88619a");
  assert.equal(toneOf("ENTP").color, "#88619a");
  assert.equal(toneOf("ENFP").color, "#33a474");
  assert.equal(toneOf("INFJ").color, "#33a474");
  assert.equal(toneOf("ISFJ").color, "#4298b4");
  assert.equal(toneOf("ESTJ").color, "#4298b4");
  assert.equal(toneOf("ESTP").color, "#e4ae3a");
  assert.equal(toneOf("ISFP").color, "#e4ae3a");
});

test("16タイプそれぞれに固有の呼び名を表示する", () => {
  assert.equal(mbtiLabelOf("ENTP"), "討論者");
  assert.equal(mbtiLabelOf("ESFP"), "エンターテイナー");
  assert.equal(new Set(MBTI_TYPES.map(mbtiLabelOf)).size, 16);
});

test("MBTIと星座が不明な友達を消さず、許可した項目だけ復元する", () => {
  const friend = normalizeFriend({
    id: "friend-1",
    displayName: "レン",
    mbti: null,
    zodiac: null,
    preferences: { energy: 1, planning: 7, unknown: -1 },
    community: "音楽仲間",
    note: "ライブが好き",
    nextTimeNote: "次のライブに誘う",
    metAt: "2025-01-01",
    secret: "保存しない",
  }, () => "fallback");
  assert.ok(friend);
  assert.equal(friend.mbti, null);
  assert.equal(friend.zodiac, null);
  assert.deepEqual(friend.preferences, { energy: 1 });
  assert.equal(friend.nextTimeNote, "次のライブに誘う");
  assert.equal(Object.hasOwn(friend, "metAt"), false);
  assert.equal(Object.hasOwn(friend, "secret"), false);
});

test("不正なIDと長い次回メモを安全な値へ直す", () => {
  const friend = normalizeFriend({ displayName: "友達", mbti: "INFJ", zodiac: "pisces", nextTimeNote: "あ".repeat(500) }, () => "new-id");
  assert.ok(friend);
  assert.equal(friend.id, "new-id");
  assert.equal(friend.nextTimeNote.length, 300);
});

test("保存データの読み込み失敗時は空データを自動保存しない", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const loadEffect = source.slice(source.indexOf("let storageReady = true"), source.indexOf("}, []);"));
  assert.match(loadEffect, /storageReady = false/);
  assert.match(loadEffect, /setHydrated\(storageReady\)/);
  assert.doesNotMatch(loadEffect, /clearDeviceData/);
});

test("プロフィール未登録でも友達詳細を開いて編集できる", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedFriend && <FriendDetailModal me=\{profile\}/);
  assert.match(source, /className="friend-main" onClick=\{\(\) => onSelect\(friend\)\}/);
});

test("初回画面からお試しデータを登録しない", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SAMPLE_FRIENDS|loadSample|おためしデータで見る/);
  assert.match(source, />プロフィール作成 <span>→<\/span><\/button>/);
});

test("初回画面にカード交換イラストだけを表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="welcome-art" role="img" aria-label="プロフィールカードを交換するイラスト"/);
  assert.match(source, /sample-card card-back/);
  assert.match(source, /sample-card card-front/);
  assert.match(source, /friend-sticker/);
  assert.match(css, /\.welcome-art \{[^}]*overflow: hidden;/);
  assert.doesNotMatch(source, /SAMPLE_FRIENDS|loadSample|おためしデータで見る/);
});

test("初回画面の『もっと仲良くなれる。』を一行で表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /<em>もっと仲良くなれる。<\/em>/);
  assert.doesNotMatch(source, /もっと仲良く<br/);
  assert.match(css, /\.welcome-copy h1 \{ font-size: clamp\(32px, 9vw, 38px\)/);
  assert.match(css, /\.welcome-copy h1 em \{ white-space: nowrap; \}/);
});

test("画面下部メニューからプロフィール画面へ移動し、メニューを表示し続ける", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bottomNav = source.slice(source.indexOf('<nav className="bottom-nav"'), source.indexOf("</nav>", source.indexOf('<nav className="bottom-nav"')));
  assert.match(bottomNav, /label="プロフィール" active=\{tab === "profile"\} onClick=\{\(\) => setTab\("profile"\)\}/);
  assert.doesNotMatch(bottomNav, /label="カード"/);
  assert.match(source, /\{tab === "profile" && <ProfileView profile=\{profile\} onSave=\{saveProfile\} \/>\}/);
  assert.doesNotMatch(source, /function ProfileModal|profileOpen/);
  assert.doesNotMatch(source, /診断から推測せず、あなたが選んだ好みだけを使います。/);
});

test("友だちとコミュニティの見出しをホームと同じ大きさで簡潔に表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");
  const bottomNav = source.slice(source.indexOf('<nav className="bottom-nav"'), source.indexOf("</nav>", source.indexOf('<nav className="bottom-nav"')));
  assert.match(source, /<h1>友だち<\/h1>/);
  assert.match(source, /<h1>コミュニティ<\/h1>/);
  assert.doesNotMatch(source, /友達を、忘れない。|みんなの関係を、楽しむ。/);
  assert.doesNotMatch(source, /タイプも、好きなことも、次にしたいことも。|コミュニティの傾向、目的別の相性、友達を紹介するヒント。/);
  assert.match(bottomNav, /label="コミュニティ" active=\{tab === "communities"\}/);
  assert.doesNotMatch(bottomNav, /label="グループ"/);
  assert.match(css, /\.dashboard-view \.page-heading h1,\s*\.friends-page \.page-heading h1,\s*\.communities-page \.page-heading h1 \{ font-size: 16px; \}/);
});

test("中央の＋から友達のQRコード読み取り画面を開ける", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bottomNav = source.slice(source.indexOf('<nav className="bottom-nav"'), source.indexOf("</nav>", source.indexOf('<nav className="bottom-nav"')));
  assert.match(bottomNav, /<button className="nav-add" onClick=\{\(\) => void scanFriendCard\(\)\} aria-label="カメラで友達のQRコードを読み取る">＋<\/button>/);
  assert.doesNotMatch(bottomNav, /setTab\("card"\)/);
  assert.doesNotMatch(bottomNav, /nav-add-placeholder/);
});

test("友達の手入力登録を表示せずQRと共有リンクからだけ追加する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const friendsView = source.slice(source.indexOf("function FriendsView"), source.indexOf("function CommunitiesView"));
  const communitiesView = source.slice(source.indexOf("function CommunitiesView"), source.indexOf("function CardView"));
  assert.doesNotMatch(source, /friendOpen|setFriendOpen|source: friend\?\.source \?\? \(card \? "qr" : "manual"\)/);
  assert.doesNotMatch(friendsView, /onAdd|友達を追加/);
  assert.doesNotMatch(communitiesView, /onAdd|メンバーを追加/);
  assert.match(source, /\(incoming \|\| editingFriend\) && <FriendModal/);
  assert.match(source, /QRコードの読み取りはiPhoneアプリで利用できます/);
  assert.match(source, /<button onClick=\{onFriend\}>QRを読み取る<\/button>/);
});

test("iPhoneでは生年月日を年・月・日の1つのダイアルで選ぶ", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const platform = await readFile(new URL("../lib/mobile-platform.ts", import.meta.url), "utf8");
  assert.match(source, /function BirthdayPicker/);
  assert.match(source, /aria-label="生年月日を年・月・日のダイヤルで選択"/);
  assert.match(source, /normalized \?\? "2010-01-01"/);
  assert.match(source, /type="date"/);
  assert.match(platform, /registerPlugin<BirthdayPickerPlugin>\("BirthdayPicker"\)/);
  assert.match(platform, /minimum: "1900-01-01"/);
});

test("プロフィールのMBTIと生年月日は行を分け、星座と年齢を生年月日の横に表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const profileView = source.slice(source.indexOf("function ProfileView"), source.indexOf("function FriendModal"));
  assert.match(profileView, /<div className="field"><span>MBTI<\/span>/);
  assert.match(profileView, /<div className="profile-birthday-row"><BirthdayPicker/);
  assert.match(profileView, /<small className="birthday-result-side birth-result">/);
  assert.match(profileView, /<small className="birthday-result-side" aria-hidden="true" \/>/);
  assert.match(css, /\.profile-birthday-row \{[^}]*grid-template-columns: 1fr 1fr;/);
  assert.match(css, /\.birthday-result-side \{[^}]*min-height: 47px;/);
});

test("プロフィールのMBTIはコンパクトな選択欄とタイプカラーを横に表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const profileView = source.slice(source.indexOf("function ProfileView"), source.indexOf("function FriendModal"));
  assert.match(profileView, /useState<Mbti \| "">\(profile\?\.mbti \?\? ""\)/);
  assert.match(profileView, /const mbtiTone = mbti \? toneOf\(mbti\) : null/);
  assert.match(profileView, /<div className="profile-mbti-row"><select required aria-label="MBTI"/);
  assert.match(profileView, /<option value="">選択してください<\/option>/);
  assert.match(profileView, /className="mbti-tone-preview"/);
  assert.match(profileView, /className="mbti-tone-space" aria-hidden="true"/);
  assert.match(profileView, /mbtiLabelOf\(mbti\)/);
  assert.match(css, /\.profile-mbti-row \{[^}]*grid-template-columns: 1fr 1fr;/);
  assert.match(css, /\.mbti-tone-preview \{[^}]*background: var\(--mbti-light\);[^}]*color: var\(--mbti-tone\);/);
});

test("iPhone画面全体を固定し、長い一覧だけ枠内で表示する", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");
  assert.match(css, /html, body, #root \{[^}]*height: 100%;[^}]*overflow: hidden;/);
  assert.match(css, /\.app-shell \{[^}]*height: 100%;[^}]*overflow: hidden;/);
  assert.match(css, /\.main-stage \{[^}]*overflow: hidden;/);
  assert.match(css, /\.friend-list \{[^}]*overflow-y: auto;/);
  assert.match(css, /\.communities-content \{[^}]*overflow-y: auto;/);
  assert.match(source, /className="welcome-view app-page"/);
  assert.match(source, /className="friends-page app-page"/);
  assert.match(source, /className="communities-page app-page"/);
  assert.match(source, /className="card-page app-page"/);
  assert.match(source, /className="profile-page app-page"/);
});

test("iPhoneのプロフィール画面は下部メニューを残して保存ボタンまで縦にスクロールできる", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");
  assert.match(source, /className="profile-editor-panel"/);
  assert.match(css, /\.profile-page \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(css, /\.profile-editor-panel \{[^}]*overflow-y: auto;[^}]*-webkit-overflow-scrolling: touch;[^}]*touch-action: pan-y;/);
  const sharedCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(sharedCss, /\.profile-editor-panel form > \.field:first-child \{ margin-top: 0; \}/);
});

test("iPhoneで入力欄をタップしても画面を自動拡大しない", async () => {
  const css = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");
  assert.match(css, /input, select, textarea \{ font-size: 16px !important; \}/);
});

test("iPhoneの実際の好みは選択肢を読みやすい大きさで表示する", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.preferences-editor legend small \{ font-size: 10px; \}/);
  assert.match(css, /\.preference-row > span b \{ font-size: 12px; \}/);
  assert.match(css, /\.preference-row > span small \{ font-size: 10px; \}/);
  assert.match(css, /\.preference-row button \{ font-size: 11px; \}/);
});
