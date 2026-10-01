"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { clearDeviceData, loadDeviceData, saveDeviceData } from "../lib/device-storage";
import { buildShareUrl, cancelBirthdayNotifications, cardPayloadFromUrl, exportBackupOnDevice, getInitialAppLink, isNativeApp, listenForAppLinks, MAX_BIRTHDAY_NOTIFICATIONS, openInDefaultBrowser, pickBirthdayOnDevice, scanQrCode, shareFromDevice, syncBirthdayNotifications } from "../lib/mobile-platform";
import {
  calculateAge, compatibility, formatBirthday, Friend, introductionSuggestion, isMbti, isZodiac, Mbti, mbtiGroupOf, mbtiLabelOf, MBTI_TONE, MBTI_TYPES,
  normalizeBirthday, normalizeFriend, normalizePreferences, normalizeProfile, PREFERENCE_DEFINITIONS, preferenceEntries,
  Preferences, PreferenceValue, Profile, ShareCard, toneOf, zodiacFromBirthday, zodiacOf,
} from "../lib/tomotype-model";
import { BirthdayIcon, HeartIcon, PeopleIcon, ProfileIcon, ZodiacIcon } from "./tomotype-icons";

type Tab = "home" | "friends" | "communities" | "card" | "profile";
type AppSettings = { birthdayNotifications: boolean };

function encodeCard(card: ShareCard) {
  const bytes = new TextEncoder().encode(JSON.stringify(card));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCard(raw: string): ShareCard | null {
  try {
    if (raw.length > 4000) return null;
    const padded = raw.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(raw.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ShareCard>;
    const birthday = normalizeBirthday(parsed.birthday);
    const zodiac = birthday ? zodiacFromBirthday(birthday) : isZodiac(parsed.zodiac) ? parsed.zodiac : null;
    if (parsed.v !== 1 || !isMbti(parsed.mbti) || !zodiac) return null;
    const displayName = typeof parsed.displayName === "string" ? parsed.displayName.trim().slice(0, 24) : "";
    return { v: 1, displayName, mbti: parsed.mbti, zodiac, birthday, preferences: normalizePreferences(parsed.preferences) };
  } catch {
    return null;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `friend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function stellaUrl(profile: Profile, concern: "personality" | "ranking") {
  return `https://stellalog.nobyworks.com/reading/${profile.mbti.toLowerCase()}/${profile.zodiac}/unisex/${concern}`;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ birthdayNotifications: false });
  const [nativePlatform, setNativePlatform] = useState(false);
  const [notificationRefresh, setNotificationRefresh] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [profileShareOpen, setProfileShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [meetingFriendId, setMeetingFriendId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<ShareCard | null>(null);
  const [toast, setToast] = useState("");
  const [qrData, setQrData] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stopListening: () => void = () => undefined;
    const acceptUrl = (url: string) => {
      const payload = cardPayloadFromUrl(url);
      if (!payload) return;
      const card = decodeCard(payload);
      if (card) setIncoming(card);
    };
    const timer = window.setTimeout(() => {
      void (async () => {
        let storageReady = true;
        try {
          const parsed = await loadDeviceData<unknown, unknown, unknown>();
          if (parsed) {
            const safeProfile = normalizeProfile(parsed.profile);
            if (safeProfile) setProfile(safeProfile);
            if (Array.isArray(parsed.friends)) {
              const usedIds = new Set<string>();
              const safeFriends = parsed.friends.slice(0, 1000).flatMap((friend) => {
                const safeFriend = normalizeFriend(friend, uid);
                if (!safeFriend) return [];
                if (usedIds.has(safeFriend.id)) safeFriend.id = uid();
                usedIds.add(safeFriend.id);
                return [safeFriend];
              });
              setFriends(safeFriends);
            }
            if (parsed.settings && typeof parsed.settings === "object") {
              const savedSettings = parsed.settings as Partial<AppSettings>;
              setSettings({ birthdayNotifications: savedSettings.birthdayNotifications === true });
            }
          }
        } catch {
          storageReady = false;
          setToast("保存データを読み込めませんでした。元のデータは消していません");
        }
        acceptUrl(window.location.href);
        const launchUrl = await getInitialAppLink();
        if (launchUrl) acceptUrl(launchUrl);
        stopListening = await listenForAppLinks(acceptUrl);
        setNativePlatform(isNativeApp());
        setHydrated(storageReady);
      })();
    }, 0);
    return () => { window.clearTimeout(timer); stopListening(); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveDeviceData({ profile, friends, settings }).catch(() => setToast("端末への保存に失敗しました"));
  }, [profile, friends, settings, hydrated]);

  const birthdayReminders = useMemo(() => friends.flatMap((friend) => friend.birthday ? [{ friendId: friend.id, displayName: friend.displayName, birthday: friend.birthday }] : []), [friends]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") setNotificationRefresh((current) => current + 1);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, []);

  useEffect(() => {
    if (!hydrated || !nativePlatform) return;
    if (!settings.birthdayNotifications) {
      void cancelBirthdayNotifications();
      return;
    }
    void syncBirthdayNotifications(birthdayReminders).then((result) => {
      if (!result.enabled && result.permission === "denied") setSettings({ birthdayNotifications: false });
    }).catch(() => setToast("誕生日通知を更新できませんでした"));
  }, [birthdayReminders, hydrated, nativePlatform, notificationRefresh, settings.birthdayNotifications]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const shareUrl = useMemo(() => {
    if (!profile || typeof window === "undefined") return "";
    const card: ShareCard = { v: 1, displayName: profile.displayName, mbti: profile.mbti, zodiac: profile.zodiac, birthday: profile.birthday, preferences: profile.preferences };
    return buildShareUrl(encodeCard(card));
  }, [profile]);

  useEffect(() => {
    if (!shareUrl) return;
    let active = true;
    import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(shareUrl, {
      width: 720,
      margin: 2,
      color: { dark: "#291d2e", light: "#fffdf8" },
      errorCorrectionLevel: "M",
    })).then((url) => active && setQrData(url)).catch(() => active && setQrData(""));
    return () => { active = false; };
  }, [shareUrl]);

  const communities = useMemo(() => {
    const grouped = new Map<string, Friend[]>();
    friends.forEach((friend) => {
      const key = friend.community.trim() || "コミュニティ未設定";
      grouped.set(key, [...(grouped.get(key) ?? []), friend]);
    });
    return [...grouped.entries()];
  }, [friends]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    friends.forEach((friend) => {
      if (friend.mbti) counts.set(friend.mbti, (counts.get(friend.mbti) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [friends]);

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) ?? null;
  const editingFriend = friends.find((friend) => friend.id === editingFriendId) ?? null;
  const meetingFriend = friends.find((friend) => friend.id === meetingFriendId) ?? null;

  function saveProfile(next: Profile) {
    setProfile(next);
    setToast("プロフィールを端末に保存しました");
  }

  function saveFriend(next: Friend) {
    setFriends((current) => {
      const existing = current.findIndex((friend) => friend.id === next.id);
      if (existing >= 0) return current.map((friend) => friend.id === next.id ? next : friend);
      return [next, ...current];
    });
    setEditingFriendId(null);
    setIncoming(null);
    window.history.replaceState(null, "", window.location.pathname);
    setToast(`${next.displayName || "友達"}を保存しました`);
    setTab("friends");
  }

  async function shareCard() {
    if (!profile || !shareUrl) return;
    try {
      await shareFromDevice({ title: `${profile.displayName || "友達"}のともタイプ`, text: `${profile.mbti}・${zodiacOf(profile.zodiac)?.label}`, url: shareUrl });
    } catch {
      // Sharing can be cancelled without showing an error.
    }
  }

  async function copyCard() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setToast("共有リンクをコピーしました");
  }

  async function exportData() {
    const contents = JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), profile, friends, settings }, null, 2);
    const filename = `tomotype-backup-${today()}.json`;
    if (await exportBackupOnDevice(contents, filename)) {
      setToast("バックアップの保存先を選んでください");
      return;
    }
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("バックアップを書き出しました");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as { profile?: unknown; friends?: unknown[] };
        const safeProfile = normalizeProfile(parsed.profile);
        if (!safeProfile || !Array.isArray(parsed.friends)) throw new Error();
        const usedIds = new Set<string>();
        const safeFriends = parsed.friends.slice(0, 1000).flatMap((friend) => {
          const safeFriend = normalizeFriend(friend, uid);
          if (!safeFriend) return [];
          if (usedIds.has(safeFriend.id)) safeFriend.id = uid();
          usedIds.add(safeFriend.id);
          return [safeFriend];
        });
        setProfile(safeProfile);
        setFriends(safeFriends);
        setSettings({ birthdayNotifications: false });
        setHydrated(true);
        setToast("バックアップを復元しました。通知は設定からONにできます");
      } catch {
        setToast("このファイルは読み込めませんでした");
      }
    });
    event.target.value = "";
  }

  async function clearData() {
    if (!window.confirm("この端末のプロフィールと友達をすべて消します。先にバックアップしましたか？")) return;
    setProfile(null);
    setFriends([]);
    setSettings({ birthdayNotifications: false });
    await cancelBirthdayNotifications();
    await clearDeviceData();
    setHydrated(true);
    setSettingsOpen(false);
    setTab("home");
    setToast("この端末のデータを消しました");
  }

  async function scanFriendCard() {
    if (!isNativeApp()) {
      setToast("QRコードの読み取りはiPhoneアプリで利用できます");
      return;
    }
    try {
      const scanned = await scanQrCode();
      if (!scanned) return;
      const payload = cardPayloadFromUrl(scanned);
      const card = payload ? decodeCard(payload) : null;
      if (!card) {
        setToast("ともタイプのQRではありません");
        return;
      }
      setIncoming(card);
    } catch {
      setToast("QRを読み取れませんでした");
    }
  }

  async function changeBirthdayNotifications(enabled: boolean) {
    if (!enabled) {
      setSettings({ birthdayNotifications: false });
      await cancelBirthdayNotifications();
      setToast("誕生日通知をOFFにしました");
      return;
    }
    try {
      const result = await syncBirthdayNotifications(birthdayReminders, true);
      if (!result.enabled) {
        setSettings({ birthdayNotifications: false });
        setToast(result.permission === "denied" ? "iPhoneの設定で通知を許可してください" : "通知は許可されませんでした");
        return;
      }
      setSettings({ birthdayNotifications: true });
      setToast(`${result.scheduled}人分の誕生日通知をONにしました`);
    } catch {
      setSettings({ birthdayNotifications: false });
      setToast("誕生日通知を設定できませんでした");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setTab("home")} aria-label="ホームへ">
          <span className="brand-mark">t</span>
          <span><b>ともタイプ</b><small>friends, remembered.</small></span>
        </button>
        <nav className="side-nav" aria-label="メインメニュー">
          <NavButton icon="⌂" label="ホーム" active={tab === "home"} onClick={() => setTab("home")} />
          <NavButton icon={<PeopleIcon />} label="友達" active={tab === "friends"} onClick={() => setTab("friends")} />
          <NavButton icon="◎" label="コミュニティ" active={tab === "communities"} onClick={() => setTab("communities")} />
          <NavButton icon="▦" label="わたしのカード" active={tab === "card"} onClick={() => setTab("card")} />
        </nav>
        <div className="sidebar-bottom">
          <button className="privacy-chip" onClick={() => setSettingsOpen(true)}><span>◉</span> データはこの端末だけ</button>
          <button className="profile-mini" onClick={() => setTab("profile")}>
            <Avatar profile={profile} small />
            <span>{profile ? <><b>{profile.displayName || "わたし"}</b><small>{profile.mbti}・{zodiacOf(profile.zodiac)?.label}{profile.birthday ? `・${calculateAge(profile.birthday)}歳` : ""}</small></> : <><b>プロフィール登録</b><small>30秒ではじめる</small></>}</span>
            <i>›</i>
          </button>
        </div>
      </aside>

      <section className="main-stage">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setTab("home")}><span className="brand-mark">t</span><b>ともタイプ</b></button>
          <div className="top-actions">
            <button className="icon-button" aria-label="データ設定" onClick={() => setSettingsOpen(true)}>◉</button>
            <button className="upgrade-button" onClick={() => setPremiumOpen(true)}><span>✦</span> プレミアム</button>
          </div>
        </header>

        <div className="page-wrap">
          {tab === "home" && <HomeView profile={profile} friends={friends} onProfile={() => setTab("profile")} onFriend={scanFriendCard} onShare={() => setProfileShareOpen(true)} onSelect={(friend) => setSelectedFriendId(friend.id)} onPremium={() => setPremiumOpen(true)} />}
          {tab === "friends" && <FriendsView friends={friends} onSelect={(friend) => setSelectedFriendId(friend.id)} onDelete={(id) => setFriends((current) => current.filter((friend) => friend.id !== id))} />}
          {tab === "communities" && <CommunitiesView profile={profile} friends={friends} communities={communities} typeCounts={typeCounts} />}
          {tab === "card" && <CardView profile={profile} qrData={qrData} onProfile={() => setTab("profile")} onShare={shareCard} onCopy={copyCard} />}
          {tab === "profile" && <ProfileView profile={profile} onSave={saveProfile} />}
        </div>
      </section>

      <nav className="bottom-nav" aria-label="モバイルメニュー">
        <NavButton icon="⌂" label="ホーム" active={tab === "home"} onClick={() => setTab("home")} />
        <NavButton icon={<PeopleIcon />} label="友達" active={tab === "friends"} onClick={() => setTab("friends")} />
        <button className="nav-add" onClick={() => void scanFriendCard()} aria-label="カメラで友達のQRコードを読み取る">＋</button>
        <NavButton icon="◎" label="コミュニティ" active={tab === "communities"} onClick={() => setTab("communities")} />
        <NavButton icon={<ProfileIcon />} label="プロフィール" active={tab === "profile"} onClick={() => setTab("profile")} />
      </nav>

      {profileShareOpen && profile && <ShareProfileModal profile={profile} qrData={qrData} onClose={() => setProfileShareOpen(false)} onShare={shareCard} onScan={() => { setProfileShareOpen(false); void scanFriendCard(); }} />}
      {(incoming || editingFriend) && <FriendModal card={incoming} friend={editingFriend} onClose={() => { setIncoming(null); setEditingFriendId(null); window.history.replaceState(null, "", window.location.pathname); }} onSave={saveFriend} />}
      {selectedFriend && <FriendDetailModal me={profile} friend={selectedFriend} onClose={() => setSelectedFriendId(null)} onEdit={() => { setSelectedFriendId(null); setEditingFriendId(selectedFriend.id); }} onMeeting={() => { setSelectedFriendId(null); setMeetingFriendId(selectedFriend.id); }} />}
      {meetingFriend && <MeetingModeModal me={profile} friend={meetingFriend} onClose={() => setMeetingFriendId(null)} onEdit={() => { setMeetingFriendId(null); setEditingFriendId(meetingFriend.id); }} />}
      {settingsOpen && <SettingsModal birthdayNotifications={settings.birthdayNotifications} birthdayCount={birthdayReminders.length} nativePlatform={nativePlatform} onBirthdayNotifications={changeBirthdayNotifications} onClose={() => setSettingsOpen(false)} onExport={exportData} onImport={() => fileRef.current?.click()} onClear={clearData} />}
      {premiumOpen && <PremiumModal onClose={() => setPremiumOpen(false)} />}
      <input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importData} />
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function Avatar({ profile, small = false }: { profile: Profile | Friend | null; small?: boolean }) {
  const tone = profile ? toneOf(profile.mbti) : MBTI_TONE.NF;
  return <span className={small ? "avatar small" : "avatar"} style={{ background: tone.light, color: tone.color }}>{profile?.mbti?.slice(0, 2) ?? "?"}</span>;
}

function HomeView({ profile, friends, onProfile, onFriend, onShare, onSelect, onPremium }: {
  profile: Profile | null; friends: Friend[]; onProfile: () => void; onFriend: () => void; onShare: () => void; onSelect: (friend: Friend) => void; onPremium: () => void;
}) {
  if (!profile) return (
    <div className="welcome-view app-page">
      <div className="welcome-copy">
        <span className="eyebrow">友達の「そうだった！」を、ずっと。</span>
        <h1>タイプを知ると、<br /><em>もっと仲良くなれる。</em></h1>
        <p>MBTIと生年月日から分かる星座・年齢をスマートに交換。友達との楽しい過ごし方や、すれ違いを減らすヒントが見つかります。</p>
        <div className="welcome-actions">
          <button className="primary-button" onClick={onProfile}>プロフィール作成 <span>→</span></button>
        </div>
        <div className="privacy-line"><span>◉</span> アカウント不要。友達の情報はこの端末だけに保存されます。</div>
      </div>
      <div className="welcome-art" role="img" aria-label="プロフィールカードを交換するイラスト">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="sample-card card-back" style={{ "--sample-tone": toneOf("ENFP").color, "--sample-ink": toneOf("ENFP").ink } as React.CSSProperties}><span>ENFP</span><b>ひらめきで<br />つながる</b><small><ZodiacIcon zodiac="aquarius" /> 水瓶座</small></div>
        <div className="sample-card card-front" style={{ "--sample-tone": toneOf("ISTJ").color, "--sample-ink": toneOf("ISTJ").ink } as React.CSSProperties}><span>ISTJ</span><b>静かな時間も<br />心地いい</b><small><ZodiacIcon zodiac="pisces" /> 魚座</small></div>
        <div className="friend-sticker">FRIENDS<br /><b><HeartIcon /></b></div>
      </div>
      <div className="feature-ribbon">
        <div><span>01</span><b>見せるだけで<br />タイプ交換</b></div>
        <div><span>02</span><b>ふたりに合う<br />遊びがわかる</b></div>
        <div><span>03</span><b>友達の傾向を<br />あとから発見</b></div>
      </div>
    </div>
  );

  const tone = toneOf(profile.mbti);
  return (
    <div className="dashboard-view app-page">
      <div className="page-heading"><div><span className="eyebrow">MY TYPE</span><h1>タイプと星座</h1><p>今日も誰かとの「わかる」を増やそう。</p></div></div>
      <section className="home-hero" style={{ "--tone": tone.color, "--tone-light": tone.light, "--tone-ink": tone.ink } as React.CSSProperties}>
        <div className="profile-identity">
          <div className="identity-layout">
            <div className="identity-mainline"><strong>{profile.mbti}</strong><span><ZodiacIcon zodiac={profile.zodiac} /></span></div>
            <div className="identity-description"><span>{tone.name}</span><i>×</i><span>{zodiacOf(profile.zodiac)?.label}</span></div>
          </div>
        </div>
        <button className="share-profile-action" onClick={onShare}><b>プロフィールをシェア</b></button>
      </section>

      <div className="section-title"><div><span className="eyebrow">RECENT FRIENDS</span><h2>最近の友達</h2></div>{friends.length > 0 && <button onClick={onFriend}>QRを読み取る</button>}</div>
      {friends.length === 0 ? <EmptyCard icon={<PeopleIcon />} title="まだ友達が登録されていません" text="画面下中央の＋から、友達のプロフィールQRを読み取れます。" /> : (
        <div className="friend-strip">{friends.slice(0, 4).map((friend) => <FriendCard key={friend.id} friend={friend} me={profile} onClick={() => onSelect(friend)} />)}</div>
      )}

      <div className="insight-grid">
        <section className="insight-card">
          <div className="section-title compact"><div><span className="eyebrow">YOUR CIRCLE</span><h2>友達のタイプ傾向</h2></div><span className="count-badge">{friends.length}人</span></div>
          {friends.length ? <TypeMiniChart friends={friends} /> : <p className="muted">3人以上登録すると、仲良くなりやすいタイプの傾向が見えてきます。</p>}
        </section>
        <button className="premium-teaser" onClick={onPremium}>
          <span className="premium-label">✦ PREMIUM</span>
          <h3>グループの中の<br />あなたの役割は？</h3>
          <p>みんなのタイプから、場で活きるあなたらしさを読み解きます。</p>
          <i>詳しく見る →</i>
        </button>
      </div>
    </div>
  );
}

function FriendCard({ friend, me, onClick }: { friend: Friend; me: Profile; onClick: () => void }) {
  const tone = toneOf(friend.mbti);
  const guide = compatibility(me, friend);
  return <button className="friend-card" onClick={onClick} style={{ "--friend-tone": tone.color, "--friend-light": tone.light } as React.CSSProperties}>
    <div className="friend-card-top"><span>{friend.mbti ?? "未登録"}</span><i>{friend.zodiac ? <ZodiacIcon zodiac={friend.zodiac} /> : null}</i></div>
    <b>{friend.displayName || "なまえ未設定"}</b><small>{zodiacOf(friend.zodiac)?.label ?? "星座未登録"}{friend.birthday ? `・${calculateAge(friend.birthday)}歳` : ""}・{friend.community || "未分類"}</small>
    <p>{guide.headline}</p><span className="card-link">相性ヒントを見る →</span>
  </button>;
}

function TypeMiniChart({ friends }: { friends: Friend[] }) {
  const categories = [
    { key: "NT", label: "分析・発想", color: MBTI_TONE.NT.color }, { key: "NF", label: "共感・理想", color: MBTI_TONE.NF.color },
    { key: "SJ", label: "安定・協力", color: MBTI_TONE.SJ.color }, { key: "SP", label: "行動・体験", color: MBTI_TONE.SP.color },
  ];
  return <div className="mini-chart">{categories.map((category) => {
    const count = friends.filter((friend) => mbtiGroupOf(friend.mbti) === category.key).length;
    const width = friends.length ? Math.max(8, (count / friends.length) * 100) : 0;
    return <div key={category.key}><span>{category.label}</span><div><i style={{ width: `${width}%`, background: category.color }} /></div><b>{count}人</b></div>;
  })}</div>;
}

function FriendsView({ friends, onSelect, onDelete }: { friends: Friend[]; onSelect: (friend: Friend) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [community, setCommunity] = useState("");
  const communityOptions = [...new Set(friends.map((friend) => friend.community).filter(Boolean))].sort();
  const filtered = friends.filter((friend) => (!community || friend.community === community) && `${friend.displayName}${friend.mbti ?? ""}${friend.community}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="friends-page app-page">
    <div className="page-heading"><div><span className="eyebrow">FRIEND BOOK</span><h1>友だち</h1></div></div>
    <div className="toolbar"><div className="friend-filters"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・MBTI・コミュニティで検索" /></label><select aria-label="コミュニティで絞り込む" value={community} onChange={(event) => setCommunity(event.target.value)}><option value="">すべてのコミュニティ</option>{communityOptions.map((name) => <option key={name}>{name}</option>)}</select></div><span>{filtered.length} FRIENDS</span></div>
    {!friends.length ? <EmptyCard icon={<PeopleIcon />} title="ここが、あなたの友達図鑑になります" text="画面下中央の＋から、友達のプロフィールQRを読み取れます。" /> : (
      <div className="friend-list">{filtered.map((friend) => {
        const tone = toneOf(friend.mbti);
        return <article className="friend-row" key={friend.id}>
          <button className="friend-main" onClick={() => onSelect(friend)}>
            <span className="type-tile" style={{ background: tone.light, color: tone.color }}>{friend.mbti ?? "未登録"}</span>
            <span className="friend-info"><b>{friend.displayName || "なまえ未設定"}</b><small>{friend.zodiac && <ZodiacIcon zodiac={friend.zodiac} />} {zodiacOf(friend.zodiac)?.label ?? "星座未登録"}{friend.birthday ? `・${calculateAge(friend.birthday)}歳` : ""}<i>#{friend.community || "未分類"}</i></small></span>
            <span className="friend-note">{friend.nextTimeNote ? `次に：${friend.nextTimeNote}` : friend.note || "メモはまだありません"}</span><i className="row-arrow">›</i>
          </button>
          <button className="delete-friend" onClick={() => window.confirm(`${friend.displayName || "この友達"}を端末から削除しますか？`) && onDelete(friend.id)} aria-label={`${friend.displayName}を削除`}>×</button>
        </article>;
      })}</div>
    )}
  </div>;
}

function CommunitiesView({ profile, friends, communities, typeCounts }: { profile: Profile | null; friends: Friend[]; communities: [string, Friend[]][]; typeCounts: [string, number][] }) {
  const [view, setView] = useState<"communities" | "ranking" | "introduce">("communities");
  const [rankingKey, setRankingKey] = useState<"overall" | "conversation" | "outing" | "planning" | "support">("overall");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const role = !profile ? "プロフィール登録で表示" : profile.mbti[0] === "E" && profile.mbti[2] === "F" ? "つながりの火付け役" : profile.mbti[0] === "I" && profile.mbti[1] === "N" ? "静かなアイデア係" : profile.mbti[3] === "J" ? "みんなの安心設計係" : "流れを楽しむムード係";
  const ranked = profile ? friends.flatMap((friend) => {
    const guide = compatibility(profile, friend);
    const value = rankingKey === "overall" ? guide.overall : guide.metrics.find((metric) => metric.key === rankingKey && metric.available)?.value ?? null;
    return value === null ? [] : [{ friend, value }];
  }).sort((left, right) => right.value - left.value || left.friend.displayName.localeCompare(right.friend.displayName, "ja") || left.friend.id.localeCompare(right.friend.id)) : [];
  const left = friends.find((friend) => friend.id === leftId) ?? friends[0] ?? null;
  const right = friends.find((friend) => friend.id === rightId && friend.id !== left?.id) ?? friends.find((friend) => friend.id !== left?.id) ?? null;
  const pairGuide = left && right ? compatibility(left, right) : null;
  const introduction = left && right ? introductionSuggestion(left, right) : null;
  return <div className="communities-page app-page">
    <div className="page-heading"><div><span className="eyebrow">COMMUNITY & MATCH LAB</span><h1>コミュニティ</h1></div></div>
    <div className="lab-tabs" role="tablist" aria-label="コミュニティと相性ラボ"><button role="tab" aria-selected={view === "communities"} className={view === "communities" ? "active" : ""} onClick={() => setView("communities")}>コミュニティ</button><button role="tab" aria-selected={view === "ranking"} className={view === "ranking" ? "active" : ""} onClick={() => setView("ranking")}>相性ランキング</button><button role="tab" aria-selected={view === "introduce"} className={view === "introduce" ? "active" : ""} onClick={() => setView("introduce")}>友達を紹介</button></div>
    <div className="communities-content">
    {view === "communities" && (!communities.length ? <EmptyCard icon="◎" title="友達をコミュニティに分けてみよう" text="QRで登録した友達の編集画面から、コミュニティ名をつけられます。" /> : <>
      <div className="community-summary">
        <div className="role-card"><span className="eyebrow">YOUR ROLE</span><small>あなたのタイプから見える役割</small><strong>{role}</strong><p>人を決めつける診断ではなく、会話を始めるためのヒントです。</p></div>
        <div className="distribution-card"><span className="eyebrow">TOP TYPES</span><h3>よく出会っているMBTI</h3>{typeCounts.slice(0, 3).map(([type, count], index) => <div key={type}><i>{index + 1}</i><b>{type}</b><span>{count}人</span></div>)}</div>
      </div>
      <div className="community-grid">{communities.map(([name, members], index) => <article key={name} className={`community-card color-${index % 3}`}><div className="community-head"><span>◎</span><small>{members.length} MEMBERS</small></div><h2>{name}</h2><div className="avatar-stack">{members.slice(0, 5).map((member) => <span key={member.id} style={{ background: toneOf(member.mbti).light, color: toneOf(member.mbti).color }}>{member.mbti?.slice(0, 2) ?? "?"}</span>)}</div><p>{members.map((member) => member.mbti ?? "未登録").join("・")}</p><button disabled={members.length < 2} onClick={() => { setLeftId(members[0]?.id ?? ""); setRightId(members[1]?.id ?? ""); setView("introduce"); }}>{members.length >= 2 ? "この中のふたりを比べる" : "比較には2人必要"} <span>→</span></button></article>)}</div>
    </>)}
    {view === "ranking" && <section className="lab-panel"><div className="lab-panel-head"><div><span className="eyebrow">PREMIUM PREVIEW</span><h2>目的で変わる、相性ランキング</h2><p>友達の価値ではなく、登録したタイプと実際の好みから「合わせやすさ」を見ています。</p></div><select aria-label="ランキングの種類" value={rankingKey} onChange={(event) => setRankingKey(event.target.value as typeof rankingKey)}><option value="overall">総合</option><option value="conversation">会話のテンポ</option><option value="outing">遊びの好み</option><option value="planning">予定の決め方</option><option value="support">支え合い方</option></select></div>{!profile || !friends.length ? <p className="lab-empty">友達を登録すると表示されます。</p> : <div className="ranking-list">{ranked.map(({ friend, value }, index) => <div key={friend.id} className="ranking-row"><i>{index + 1}</i><Avatar profile={friend} small /><div><b>{friend.displayName || "なまえ未設定"}</b><small>{friend.mbti ?? "MBTI未登録"}・{friend.community || "未分類"}</small><span><em style={{ width: `${value}%` }} /></span></div><strong>{value}<small>%</small></strong></div>)}{ranked.length < friends.length && <p className="ranking-note">情報が足りない友達は、好みやタイプを追加するとランキングに表示されます。</p>}</div>}</section>}
    {view === "introduce" && <section className="lab-panel"><div className="lab-panel-head"><div><span className="eyebrow">PREMIUM PREVIEW</span><h2>このふたり、紹介してみる？</h2><p>友達情報は外へ送らず、この端末だけで紹介のヒントを作ります。</p></div></div>{friends.length < 2 || !left || !right || !pairGuide || !introduction ? <p className="lab-empty">比較するには友達を2人以上登録してください。</p> : <><div className="pair-selectors"><label><span>ひとり目</span><select value={left.id} onChange={(event) => { setLeftId(event.target.value); if (event.target.value === right.id) setRightId(""); }}>{friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.displayName || "なまえ未設定"}</option>)}</select></label><span>×</span><label><span>ふたり目</span><select value={right.id} onChange={(event) => setRightId(event.target.value)}>{friends.filter((friend) => friend.id !== left.id).map((friend) => <option key={friend.id} value={friend.id}>{friend.displayName || "なまえ未設定"}</option>)}</select></label></div><div className="pair-result"><div className="pair-score"><small>TYPE & PREFERENCE MATCH</small><strong>{pairGuide.overall ?? "—"}{pairGuide.overall !== null && <i>%</i>}</strong><p>{pairGuide.headline}</p></div><div className="intro-card"><span>つなぎ方のヒント</span><h3>{introduction.title}</h3><p>{introduction.text}</p><b>最初の話題：「{introduction.topic}」</b></div></div><CompatibilityMetrics guide={pairGuide} /></>}</section>}
    </div>
  </div>;
}

function CardView({ profile, qrData, onProfile, onShare, onCopy }: { profile: Profile | null; qrData: string; onProfile: () => void; onShare: () => void; onCopy: () => void }) {
  if (!profile) return <div className="card-page app-page"><EmptyCard icon="▦" title="まず、あなたのタイプを教えてください" text="名前は任意。MBTIと生年月日から共有カードを作れます。" action="プロフィールを登録" onAction={onProfile} /></div>;
  const tone = toneOf(profile.mbti);
  return <div className="card-page app-page">
    <div className="page-heading"><div><span className="eyebrow">MY SHARE CARD</span><h1>これが、わたしのタイプ。</h1><p>画面を見せるだけ。相手はカメラで読み取って登録できます。</p></div><button className="round-settings" onClick={onProfile}>内容を編集</button></div>
    <div className="share-layout">
      <div className="share-card" style={{ "--tone": tone.color, "--tone-light": tone.light, "--tone-ink": tone.ink } as React.CSSProperties}>
        <div className="share-card-brand"><span className="brand-mark">t</span><b>ともタイプ</b><i>MY TYPE CARD</i></div>
        <div className="share-card-body"><small>{profile.displayName ? `${profile.displayName}のタイプ` : "MY PERSONALITY TYPE"}</small><strong>{profile.mbti}</strong><span>{tone.name}</span><div><ZodiacIcon zodiac={profile.zodiac} /> {zodiacOf(profile.zodiac)?.label}{profile.birthday ? `・${calculateAge(profile.birthday)}歳` : ""}</div></div>
        <div className="qr-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qrData ? <img src={qrData} alt="友達登録用QRコード" /> : <span>QRを準備中…</span>}
        </div>
        <p>カメラで読み取ると、登録したタイプと実際の好みを共有します。</p>
      </div>
      <div className="share-controls">
        <span className="eyebrow">WHAT WILL BE SHARED?</span><h2>渡す情報は、これだけ。</h2>
        <div className="share-data"><div><span>表示名</span><b>{profile.displayName || "共有しない"}</b></div><div><span>MBTI</span><b>{profile.mbti}</b></div><div><span>生年月日・現在の年齢</span><b>{profile.birthday ? `${formatBirthday(profile.birthday)}・${calculateAge(profile.birthday)}歳` : "未登録"}</b></div><div><span>自動判定した星座</span><b>{zodiacOf(profile.zodiac)?.label}</b></div><div><span>登録した実際の好み</span><b>{preferenceEntries(profile.preferences).length ? `${preferenceEntries(profile.preferences).length}項目` : "共有しない"}</b></div></div>
        {preferenceEntries(profile.preferences).length > 0 && <PreferenceChips preferences={profile.preferences} />}
        <div className="safe-note"><span>◉</span><p><b>QRには上に表示した生年月日も含まれます。</b><br />QRやリンクを受け取った人は、生年月日を保存・転送できます。連絡先・友達リスト・メモは含みません。</p></div>
        <button className="primary-button full-button" onClick={onShare}>共有する <span>↗</span></button><button className="secondary-button full-button" onClick={onCopy}>リンクをコピー</button>
        <button className="stella-link" onClick={() => void openInDefaultBrowser(stellaUrl(profile, "personality"))}>StellaLogで私のタイプを詳しく読む <span>↗</span></button>
      </div>
    </div>
  </div>;
}

function EmptyCard({ icon, title, text, action, onAction }: { icon: React.ReactNode; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-card"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{action && onAction && <button onClick={onAction}>{action} →</button>}</div>;
}

function ShareProfileModal({ profile, qrData, onClose, onShare, onScan }: { profile: Profile; qrData: string; onClose: () => void; onShare: () => void; onScan: () => void }) {
  const tone = toneOf(profile.mbti);
  return <div className="profile-share-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="profile-share-modal" role="dialog" aria-modal="true" aria-label="プロフィールをシェア" style={{ "--tone": tone.color, "--tone-light": tone.light, "--tone-ink": tone.ink } as React.CSSProperties}>
      <header className="profile-share-header">
        <button className="profile-share-close" onClick={onClose} aria-label="閉じる">×</button>
        <b>プロフィールをシェア</b>
        <button className="profile-scan-button" onClick={onScan} aria-label="カメラで友達のQRコードを読み取る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3.5" /></svg>
        </button>
      </header>
      <div className="profile-share-content">
        <span className="profile-share-label">MY TOMO TYPE</span>
        <div className="profile-share-type"><strong>{profile.mbti}</strong><span><ZodiacIcon zodiac={profile.zodiac} /></span></div>
        <p className="profile-share-name">{profile.displayName || "わたし"}のプロフィール</p>
        <div className="profile-share-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qrData ? <img src={qrData} alt="友達登録用QRコード" /> : <span>QRを準備中…</span>}
        </div>
        <p className="profile-share-guide">別のiPhoneで読み取ると、このプロフィールを友達として登録できます。</p>
        <small>左下の共有マークから、リンクやLINEでも送れます。</small>
      </div>
      <button className="profile-share-button" onClick={onShare} aria-label="リンクやLINEで共有">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" /></svg>
      </button>
    </section>
  </div>;
}

function BirthdayPicker({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const [opening, setOpening] = useState(false);
  const normalized = normalizeBirthday(value);
  const maximum = today();

  async function openNativePicker() {
    if (opening) return;
    setOpening(true);
    try {
      const selected = await pickBirthdayOnDevice(normalized ?? "2010-01-01", maximum);
      if (selected) onChange(selected);
    } finally {
      setOpening(false);
    }
  }

  return <div className="birthday-picker">
    {isNativeApp() ? <button className={normalized ? "birthday-picker-button selected" : "birthday-picker-button"} type="button" disabled={opening} aria-label="生年月日を年・月・日のダイヤルで選択" onClick={() => void openNativePicker()}><span>{normalized ? formatBirthday(normalized) : "生年月日を選ぶ"}</span><i aria-hidden="true">⌄</i></button> : <input required={required} aria-label="生年月日" type="date" min="1900-01-01" max={maximum} value={normalized ?? ""} onChange={(event) => onChange(event.target.value)} />}
    {!required && normalized && <button className="birthday-clear" type="button" onClick={() => onChange("")}>クリア</button>}
  </div>;
}

function BirthdayDialPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = normalizeBirthday(value)?.split("-") ?? ["", "", ""];
  const [year, setYear] = useState(initial[0]);
  const [month, setMonth] = useState(initial[1]);
  const [day, setDay] = useState(initial[2]);
  const [currentYear, currentMonth, currentDay] = today().split("-").map(Number);
  const years = Array.from({ length: currentYear - 1899 }, (_, index) => String(currentYear - index));
  const maximumMonth = Number(year) === currentYear ? currentMonth : 12;
  const months = Array.from({ length: maximumMonth }, (_, index) => String(index + 1).padStart(2, "0"));
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const maximumDay = Number(year) === currentYear && Number(month) === currentMonth ? Math.min(daysInMonth, currentDay) : daysInMonth;
  const days = Array.from({ length: maximumDay }, (_, index) => String(index + 1).padStart(2, "0"));

  function update(nextYear: string, nextMonth: string, nextDay: string) {
    const nextMaximumMonth = Number(nextYear) === currentYear ? currentMonth : 12;
    const safeMonth = Number(nextMonth) > nextMaximumMonth ? "" : nextMonth;
    const nextDaysInMonth = nextYear && safeMonth ? new Date(Number(nextYear), Number(safeMonth), 0).getDate() : 31;
    const nextMaximumDay = Number(nextYear) === currentYear && Number(safeMonth) === currentMonth ? Math.min(nextDaysInMonth, currentDay) : nextDaysInMonth;
    const safeDay = !safeMonth ? "" : Number(nextDay) > nextMaximumDay ? String(nextMaximumDay).padStart(2, "0") : nextDay;
    setYear(nextYear);
    setMonth(safeMonth);
    setDay(safeDay);
    onChange(nextYear && safeMonth && safeDay ? `${nextYear}-${safeMonth}-${safeDay}` : "");
  }

  return <div className="birthday-dials" role="group" aria-label="生年月日をダイアルで選択">
    <select aria-label="生まれた年" value={year} onChange={(event) => update(event.target.value, month, day)}>{years.map((option) => option === "2010" ? [<option key="year-placeholder" value="">年</option>, <option key={option} value={option}>{option}年</option>] : <option key={option} value={option}>{option}年</option>)}</select>
    <select aria-label="生まれた月" value={month} onChange={(event) => update(year, event.target.value, day)}><option value="">月</option>{months.map((option) => <option key={option} value={option}>{Number(option)}月</option>)}</select>
    <select aria-label="生まれた日" value={day} onChange={(event) => update(year, month, event.target.value)}><option value="">日</option>{days.map((option) => <option key={option} value={option}>{Number(option)}日</option>)}</select>
    {(year || month || day) && <button type="button" onClick={() => { setYear(""); setMonth(""); setDay(""); onChange(""); }}>クリア</button>}
  </div>;
}

function ProfileView({ profile, onSave }: { profile: Profile | null; onSave: (profile: Profile) => void }) {
  const [name, setName] = useState(profile?.displayName ?? "");
  const [mbti, setMbti] = useState<Mbti | "">(profile?.mbti ?? "");
  const [birthday, setBirthday] = useState(profile?.birthday ?? "");
  const [preferences, setPreferences] = useState<Preferences>(profile?.preferences ?? {});
  const normalizedBirthday = normalizeBirthday(birthday);
  const zodiac = normalizedBirthday ? zodiacFromBirthday(normalizedBirthday) : null;
  const mbtiTone = mbti ? toneOf(mbti) : null;
  return <div className="profile-page app-page">
    <div className="page-heading"><div><span className="eyebrow">MY PROFILE</span><h1>わたしのプロフィール</h1></div></div>
    <div className="profile-editor-panel"><form onSubmit={(event) => { event.preventDefault(); if (mbti && normalizedBirthday && zodiac) onSave({ displayName: name.trim().slice(0, 24), mbti, zodiac, birthday: normalizedBirthday, preferences }); }}>
      <label className="field"><span>名前</span><input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} /></label>
      <div className="field"><span>MBTI</span><div className="profile-mbti-row"><select required aria-label="MBTI" value={mbti} onChange={(event) => setMbti(event.target.value as Mbti | "")}><option value="">選択してください</option>{MBTI_TYPES.map((type) => <option key={type}>{type}</option>)}</select>{mbtiTone && mbti ? <small className="mbti-tone-preview" style={{ "--mbti-tone": mbtiTone.color, "--mbti-light": mbtiTone.light } as React.CSSProperties}><i aria-hidden="true" />{mbtiLabelOf(mbti)}</small> : <small className="mbti-tone-space" aria-hidden="true" />}</div></div>
      <div className="field"><span>生年月日 <i>年・月・日をまとめて選択</i></span><div className="profile-birthday-row"><BirthdayPicker required value={birthday} onChange={setBirthday} />{normalizedBirthday && zodiac ? <small className="birthday-result-side birth-result"><ZodiacIcon zodiac={zodiac} /> {zodiacOf(zodiac)?.label}・現在 {calculateAge(normalizedBirthday)}歳</small> : profile && !profile.birthday ? <small className="birthday-result-side birth-result">現在の登録: {zodiacOf(profile.zodiac)?.label}。生年月日を入れると年齢も表示します</small> : <small className="birthday-result-side" aria-hidden="true" />}</div></div>
      <PreferencesEditor preferences={preferences} onChange={setPreferences} />
      <p className="form-note">星座と年齢は生年月日から自動で計算します。生年月日と登録した好みは共有QRに含まれ、相手の端末で表示・保存されます。</p><button className="primary-button full-button" type="submit">この内容で保存</button>
    </form></div>
  </div>;
}

function FriendModal({ card, friend, onClose, onSave }: { card: ShareCard | null; friend: Friend | null; onClose: () => void; onSave: (friend: Friend) => void }) {
  const [name, setName] = useState(friend?.displayName ?? card?.displayName ?? "");
  const [mbti, setMbti] = useState<Mbti | "">(friend?.mbti ?? card?.mbti ?? "");
  const [birthday, setBirthday] = useState(friend?.birthday ?? card?.birthday ?? "");
  const [preferences, setPreferences] = useState<Preferences>(friend?.preferences ?? card?.preferences ?? {});
  const [community, setCommunity] = useState(friend?.community ?? "");
  const [note, setNote] = useState(friend?.note ?? "");
  const [nextTimeNote, setNextTimeNote] = useState(friend?.nextTimeNote ?? "");
  const normalizedBirthday = normalizeBirthday(birthday);
  const birthdayZodiac = normalizedBirthday ? zodiacFromBirthday(normalizedBirthday) : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ id: friend?.id ?? uid(), displayName: name.trim().slice(0, 24), mbti: mbti || null, zodiac: birthdayZodiac ?? friend?.zodiac ?? card?.zodiac ?? null, birthday: normalizedBirthday, preferences, community: community.trim().slice(0, 32), note: note.trim().slice(0, 200), nextTimeNote: nextTimeNote.trim().slice(0, 300), source: friend?.source ?? "qr" });
  }
  return <Modal wide title={friend ? `${friend.displayName || "友達"}を編集` : "この友達を登録しますか？"} subtitle={card ? "QRから受け取った内容を確認してください。" : "友達の情報とメモを編集できます。"} onClose={onClose}>
    {card && <div className="incoming-badge"><span>▦</span> 本人が共有したタイプと好みを読み取りました</div>}
    <form onSubmit={submit}>
      <label className="field"><span>呼び名</span><input required value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="例：ミナ" /></label>
      <div className="field-pair"><label className="field"><span>MBTI <i>分からなくてもOK</i></span><select value={mbti} onChange={(event) => setMbti(event.target.value as Mbti | "")}><option value="">未登録・分からない</option>{MBTI_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><div className="field"><span>生年月日 <i>分からなくてもOK</i></span><BirthdayDialPicker value={birthday} onChange={setBirthday} />{normalizedBirthday && birthdayZodiac ? <small className="birth-result"><ZodiacIcon zodiac={birthdayZodiac} /> {zodiacOf(birthdayZodiac)?.label}・現在 {calculateAge(normalizedBirthday)}歳</small> : (friend?.zodiac ?? card?.zodiac) ? <small className="birth-result">誕生日未登録・現在の星座: {zodiacOf(friend?.zodiac ?? card?.zodiac ?? null)?.label}</small> : null}</div></div>
      <label className="field"><span>コミュニティ <i>任意</i></span><input value={community} maxLength={32} onChange={(event) => setCommunity(event.target.value)} placeholder="例：仕事仲間、いつもの3人" /></label>
      <PreferencesEditor preferences={preferences} onChange={setPreferences} title="知っている、実際の好み" />
      <label className="field"><span>ひとことメモ <i>任意・この端末だけ</i></span><textarea value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="好きなこと、覚えておきたいこと" /></label>
      <label className="field next-time-field"><span>次に会ったら <i>任意・この端末だけ</i></span><textarea value={nextTimeNote} maxLength={300} onChange={(event) => setNextTimeNote(event.target.value)} placeholder="話したいこと、誘いたい場所、渡したいものなど" /></label>
      <button className="primary-button full-button" type="submit">{friend ? "変更を保存" : "友達に追加"}</button>
    </form>
  </Modal>;
}

function PreferencesEditor({ preferences, onChange, title = "あなたの実際の好み" }: { preferences: Preferences; onChange: (preferences: Preferences) => void; title?: string }) {
  function select(key: keyof Preferences, value: PreferenceValue) {
    onChange({ ...preferences, [key]: preferences[key] === value ? undefined : value });
  }
  return <fieldset className="preferences-editor"><legend>{title}<small>当てはまるものだけ選択・もう一度押すと解除</small></legend>{PREFERENCE_DEFINITIONS.map((definition) => <div key={definition.key} className="preference-row"><span><b>{definition.label}</b><small>{definition.hint}</small></span><div>{definition.options.map((option) => <button key={option.value} type="button" className={preferences[definition.key] === option.value ? "active" : ""} aria-pressed={preferences[definition.key] === option.value} onClick={() => select(definition.key, option.value)}>{option.label}</button>)}</div></div>)}</fieldset>;
}

function PreferenceChips({ preferences }: { preferences: Preferences }) {
  const entries = preferenceEntries(preferences);
  if (!entries.length) return <p className="preference-empty">実際の好みはまだ登録されていません。</p>;
  return <div className="preference-chips">{entries.map((entry) => <span key={entry.key}><small>{entry.label}</small>{entry.valueLabel}</span>)}</div>;
}

function CompatibilityMetrics({ guide }: { guide: ReturnType<typeof compatibility> }) {
  return <div className="metric-grid">{guide.metrics.map((metric) => <div key={metric.key}><span>{metric.label}</span><b>{metric.available ? `${metric.value}%・${metric.value >= 84 ? "すっと合わせやすい" : metric.value >= 75 ? "育てるほど心地いい" : "違いがヒントになる"}` : "情報を追加すると表示"}</b><i><em style={{ width: metric.available ? `${metric.value}%` : "0%" }} /></i></div>)}</div>;
}

function FriendDetailModal({ me, friend, onClose, onEdit, onMeeting }: { me: Profile | null; friend: Friend; onClose: () => void; onEdit: () => void; onMeeting: () => void }) {
  const guide = me ? compatibility(me, friend) : null;
  return <Modal wide title={friend.displayName || "友達の詳細"} subtitle={`${friend.mbti ?? "MBTI未登録"}・${zodiacOf(friend.zodiac)?.label ?? "星座未登録"}${friend.birthday ? `・${calculateAge(friend.birthday)}歳` : ""}・${friend.community || "コミュニティ未設定"}`} onClose={onClose}>
    <div className="detail-actions"><button onClick={onEdit}>編集する</button><button className="meeting-button" onClick={onMeeting}>会う直前モード</button></div>
    <section className="birthday-card"><span><BirthdayIcon /></span><div><small>BIRTHDAY</small><h3>{friend.birthday ? formatBirthday(friend.birthday) : "生年月日は未登録"}</h3><p>{friend.birthday ? `現在 ${calculateAge(friend.birthday)}歳・${zodiacOf(friend.zodiac)?.label}` : friend.zodiac ? `現在の登録は${zodiacOf(friend.zodiac)?.label}です。編集から生年月日を入れると年齢も分かります。` : "編集から登録すると、年齢と星座を自動で表示します。"}</p></div></section>
    {me && guide ? <div className="compatibility-head"><Avatar profile={me} /><span>×</span><Avatar profile={friend} /><div><small>TYPE & PREFERENCE MATCH</small><h2>{guide.headline}</h2></div><strong className="overall-score">{guide.overall ?? "—"}{guide.overall !== null && <small>%</small>}</strong></div> : <div className="profile-needed"><Avatar profile={friend} /><div><b>自分のプロフィールを登録すると相性を表示できます</b><p>友達の詳細・好み・メモは、プロフィールがなくても編集できます。</p></div></div>}
    <section className="detail-section"><div className="detail-section-title"><span className="eyebrow">REAL PREFERENCES</span><h3>実際の好み</h3></div><PreferenceChips preferences={friend.preferences} /></section>
    <section className="next-time-card"><span>✎</span><div><small>NEXT TIME</small><h3>次に会ったら</h3><p>{friend.nextTimeNote || "まだメモはありません。編集から追加できます。"}</p></div></section>
    {guide && <><CompatibilityMetrics guide={guide} />
      <div className="guide-section"><span className="guide-icon fun">♪</span><div><small>一緒にすると楽しそう</small><ul>{guide.together.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
      <div className="guide-section"><span className="guide-icon care">!</span><div><small>気をつけたいこと</small><p>{guide.caution}</p></div></div>
      <div className="guide-section"><span className="guide-icon repair">↺</span><div><small>すれ違ったときの戻り方</small><p>{guide.repair}</p></div></div>
      <div className="not-score">相性％は、登録したタイプと実際の好みから作る遊びの目安です。友達の価値や関係の良し悪しを決めるものではありません。</div></>}
    {me && <button className="primary-button full-button anchor-button" onClick={() => void openInDefaultBrowser(stellaUrl(me, "ranking"))}>StellaLogで私の相性ランキングを見る <span>↗</span></button>}
  </Modal>;
}

function MeetingModeModal({ me, friend, onClose, onEdit }: { me: Profile | null; friend: Friend; onClose: () => void; onEdit: () => void }) {
  const guide = me ? compatibility(me, friend) : null;
  const topics = guide?.together ?? ["最近ちょっと夢中なこと", "次の休みにしてみたいこと", "最近見つけたお気に入り"];
  return <Modal wide title={`${friend.displayName || "友達"}に会う前に`} subtitle="覚えておきたいことを、ひとつの画面にまとめました。" onClose={onClose}>
    <div className="meeting-hero"><Avatar profile={friend} /><div><small>MEETING PREP</small><h2>{friend.displayName || "友達"}</h2><p>{friend.mbti ?? "MBTI未登録"}・{zodiacOf(friend.zodiac)?.label ?? "星座未登録"}</p></div></div>
    <section className="meeting-next"><span>今日、覚えておきたいこと</span><p>{friend.nextTimeNote || "「次に会ったら」メモはまだありません。"}</p><button onClick={onEdit}>{friend.nextTimeNote ? "メモを編集" : "メモを追加"}</button></section>
    <div className="meeting-grid"><section><span className="eyebrow">THEIR PREFERENCES</span><h3>心地よい過ごし方</h3><PreferenceChips preferences={friend.preferences} /></section><section><span className="eyebrow">CONVERSATION STARTERS</span><h3>話題のきっかけ</h3><ul>{topics.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></section></div>
    <div className="guide-section meeting-care"><span className="guide-icon care">!</span><div><small>今日の小さなヒント</small><p>{guide?.caution ?? "登録した好みを確認しながら、相手の今の気分も聞いてみよう。"}</p></div></div>
    <button className="primary-button full-button" onClick={onClose}>準備できた</button>
  </Modal>;
}

function SettingsModal({ birthdayNotifications, birthdayCount, nativePlatform, onBirthdayNotifications, onClose, onExport, onImport, onClear }: {
  birthdayNotifications: boolean;
  birthdayCount: number;
  nativePlatform: boolean;
  onBirthdayNotifications: (enabled: boolean) => void;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
}) {
  return <Modal title="データとプライバシー" subtitle="あなたの友達情報を、あなたの手元に。" onClose={onClose}>
    <div className="privacy-panel"><span>◉</span><div><b>友達データと相性計算はこの端末だけ</b><p>プロフィール、生年月日、友達、実際の好み、メモ、コミュニティ、ランキング、紹介提案を運営サーバーへ送信しません。</p></div></div>
    <button className="notification-setting" type="button" disabled={!nativePlatform} aria-pressed={birthdayNotifications} onClick={() => void onBirthdayNotifications(!birthdayNotifications)}>
      <span><BirthdayIcon /></span><div><b>友達の誕生日通知</b><small>{nativePlatform ? `誕生日当日の朝9:00・${Math.min(birthdayCount, MAX_BIRTHDAY_NOTIFICATIONS)}人分` : "iPhoneアプリで利用できます"}</small></div><i className={birthdayNotifications ? "toggle on" : "toggle"} aria-hidden="true"><em /></i>
    </button>
    {nativePlatform && birthdayCount > MAX_BIRTHDAY_NOTIFICATIONS && <p className="settings-note">iPhoneの通知上限に合わせ、次の誕生日が近い{MAX_BIRTHDAY_NOTIFICATIONS}人を予約します。</p>}
    {nativePlatform && <p className="settings-note">ONにしたときだけiPhoneが通知の許可を確認します。通知には友達の呼び名が表示され、ロック画面に出る場合があります。</p>}
    <div className="settings-actions"><button onClick={onExport}><span>↓</span><div><b>バックアップを書き出す</b><small>機種変更やデータ消去に備える</small></div><i>›</i></button><button onClick={onImport}><span>↑</span><div><b>バックアップを復元</b><small>保存したJSONファイルを選ぶ</small></div><i>›</i></button></div>
    <p className="settings-note">バックアップには生年月日、実際の好みと「次に会ったら」メモも平文で含まれます。保存先を確認し、安全な場所で管理してください。</p>
    <button className="danger-button" onClick={onClear}>この端末のデータをすべて消す</button>
  </Modal>;
}

function PremiumModal({ onClose }: { onClose: () => void }) {
  const features: [React.ReactNode, string, string][] = [
    ["◎", "目的別の相性ランキング", "会話・遊び・予定・支え方ごとに、合わせやすさを見る"],
    [<HeartIcon key="heart" />, "友達同士の相性", "まだ知り合っていないふたりを比べ、紹介のヒントを見る"],
    ["✦", "紹介・お出かけ提案", "ふたりに合う場所、つなぎ方、最初の会話テーマ"],
    ["▦", "カード着せ替え", "自己紹介に合わせた色・背景・限定テーマ"],
    ["✎", "関係を楽しむ追加機能", "無料の友達登録や編集を制限せず、深掘り機能だけを追加"],
  ];
  return <Modal wide title="もっと、関係を楽しむ。" subtitle="ともタイプ プレミアム（準備中）" onClose={onClose}>
    <div className="premium-hero"><span>✦</span><div><small>FREE STAYS USEFUL</small><h2>友達の登録数は、<br />これからも制限しません。</h2><p>プレミアムは「集める」ためではなく、関係をもっと深く楽しむための機能です。</p></div></div>
    <div className="premium-features">{features.map(([icon, title, text]) => <div key={title}><span>{icon}</span><p><b>{title}</b><small>{text}</small></p></div>)}</div>
    <div className="premium-foot"><p><b>無料で使い続けられる機能</b><br />プロフィール、好み、QR共有、友達の詳細・編集、次回メモ、会う直前モード、基本の相性ヒント、バックアップ</p><button disabled>決済は準備中</button></div>
  </Modal>;
}

function Modal({ title, subtitle, onClose, wide = false, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="閉じる">×</button><div className="modal-scroll"><div className="modal-heading"><span className="eyebrow">TOMO TYPE</span><h1>{title}</h1><p>{subtitle}</p></div>{children}</div></section></div>;
}
