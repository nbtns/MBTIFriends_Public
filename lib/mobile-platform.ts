import { registerPlugin } from "@capacitor/core";

import { resolveShareBase } from "./share-links";

const configuredShareBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_PUBLIC_SHARE_BASE;
export const PUBLIC_SHARE_BASE = resolveShareBase(configuredShareBase);

function publicShareBase() {
  const browserOrigin = typeof window !== "undefined" && !isNativeApp() ? window.location.origin : undefined;
  return resolveShareBase(configuredShareBase, browserOrigin);
}
const BIRTHDAY_NOTIFICATION_BASE_ID = 1_900_000_000;
export const MAX_BIRTHDAY_NOTIFICATIONS = 60;

export type BirthdayReminder = {
  friendId: string;
  displayName: string;
  birthday: string;
};

export type BirthdayNotificationResult = {
  supported: boolean;
  enabled: boolean;
  scheduled: number;
  permission: "granted" | "denied" | "prompt";
};

type BirthdayPickerResult = { value?: string; cancelled?: boolean };
type BirthdayPickerPlugin = {
  show(options: { value: string; minimum: string; maximum: string }): Promise<BirthdayPickerResult>;
};

const BirthdayPicker = registerPlugin<BirthdayPickerPlugin>("BirthdayPicker");
let birthdayNotificationOperation: Promise<void> = Promise.resolve();

function runBirthdayNotificationOperation<T>(operation: () => Promise<T>) {
  const result = birthdayNotificationOperation.then(operation, operation);
  birthdayNotificationOperation = result.then(() => undefined, () => undefined);
  return result;
}

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

export function buildShareUrl(encodedCard: string) {
  return `${publicShareBase()}#card=${encodedCard}`;
}

export async function pickBirthdayOnDevice(value: string, maximum: string) {
  if (!isNativeApp()) return null;
  const result = await BirthdayPicker.show({ value, minimum: "1900-01-01", maximum });
  return result.cancelled ? null : result.value ?? null;
}

export function cardPayloadFromUrl(url: string) {
  try {
    const parsed = new URL(url, publicShareBase());
    const allowed = new URL(publicShareBase());
    if (parsed.origin !== allowed.origin || parsed.pathname !== allowed.pathname) return null;
    const match = parsed.hash.match(/(?:^#|&)card=([^&]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function birthdayParts(birthday: string) {
  const match = birthday.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const check = new Date(2000, month - 1, day);
  return check.getMonth() + 1 === month && check.getDate() === day ? { month, day } : null;
}

function nextBirthdayTime(birthday: string, now = new Date()) {
  const parts = birthdayParts(birthday);
  if (!parts) return Number.POSITIVE_INFINITY;
  let year = now.getFullYear();
  let next = new Date(year, parts.month - 1, parts.day, 9, 0, 0, 0);
  if (next.getMonth() + 1 !== parts.month || next.getDate() !== parts.day) next = new Date(year, 2, 1, 9, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    year += 1;
    next = new Date(year, parts.month - 1, parts.day, 9, 0, 0, 0);
    if (next.getMonth() + 1 !== parts.month || next.getDate() !== parts.day) next = new Date(year, 2, 1, 9, 0, 0, 0);
  }
  return next.getTime();
}

async function cancelManagedBirthdayNotifications() {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const pending = await LocalNotifications.getPending();
  const managed = pending.notifications
    .filter(({ id }) => id >= BIRTHDAY_NOTIFICATION_BASE_ID && id < BIRTHDAY_NOTIFICATION_BASE_ID + MAX_BIRTHDAY_NOTIFICATIONS)
    .map(({ id }) => ({ id }));
  if (managed.length) await LocalNotifications.cancel({ notifications: managed });
}

export async function cancelBirthdayNotifications() {
  await runBirthdayNotificationOperation(cancelManagedBirthdayNotifications);
}

export async function syncBirthdayNotifications(reminders: BirthdayReminder[], requestPermission = false): Promise<BirthdayNotificationResult> {
  return runBirthdayNotificationOperation(async () => {
    if (!isNativeApp()) return { supported: false, enabled: false, scheduled: 0, permission: "prompt" };
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== "granted" && requestPermission) status = await LocalNotifications.requestPermissions();
    if (status.display !== "granted") {
      return { supported: true, enabled: false, scheduled: 0, permission: status.display === "denied" ? "denied" : "prompt" };
    }

    await cancelManagedBirthdayNotifications();
    const scheduled = reminders
      .filter((reminder) => birthdayParts(reminder.birthday))
      .sort((left, right) => nextBirthdayTime(left.birthday) - nextBirthdayTime(right.birthday) || left.friendId.localeCompare(right.friendId, "ja"))
      .slice(0, MAX_BIRTHDAY_NOTIFICATIONS)
      .map((reminder, index) => {
        const parts = birthdayParts(reminder.birthday)!;
        const schedule = parts.month === 2 && parts.day === 29
          ? { at: new Date(nextBirthdayTime(reminder.birthday)), allowWhileIdle: true }
          : { on: { month: parts.month, day: parts.day, hour: 9, minute: 0 }, allowWhileIdle: true };
        return {
          id: BIRTHDAY_NOTIFICATION_BASE_ID + index,
          title: `今日は${reminder.displayName || "友達"}さんの誕生日です`,
          body: "お祝いのメッセージを送ってみませんか？",
          schedule,
          sound: "default",
          extra: { kind: "birthday", friendId: reminder.friendId },
        };
      });
    if (scheduled.length) await LocalNotifications.schedule({ notifications: scheduled });
    return { supported: true, enabled: true, scheduled: scheduled.length, permission: "granted" };
  });
}

export async function getInitialAppLink() {
  if (!isNativeApp()) return null;
  const { App } = await import("@capacitor/app");
  const launch = await App.getLaunchUrl();
  return launch?.url ?? null;
}

export async function listenForAppLinks(onUrl: (url: string) => void) {
  if (!isNativeApp()) return () => undefined;
  const { App } = await import("@capacitor/app");
  const handle = await App.addListener("appUrlOpen", ({ url }) => onUrl(url));
  return () => { void handle.remove(); };
}

export async function openInDefaultBrowser(url: string) {
  if (isNativeApp()) {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    const result = await AppLauncher.openUrl({ url });
    if (!result.completed) throw new Error("外部ブラウザを開けませんでした");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function shareFromDevice(input: { title: string; text: string; url: string }) {
  if (isNativeApp()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ ...input, dialogTitle: "ともタイプを共有" });
    return;
  }
  if (navigator.share) {
    await navigator.share(input);
    return;
  }
  await navigator.clipboard.writeText(input.url);
}

export async function scanQrCode() {
  if (!isNativeApp()) return null;
  const {
    CapacitorBarcodeScanner,
    CapacitorBarcodeScannerCameraDirection,
    CapacitorBarcodeScannerScanOrientation,
    CapacitorBarcodeScannerTypeHint,
  } = await import("@capacitor/barcode-scanner");
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
    cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
    scanInstructions: "友達のともタイプQRを枠の中に入れてください",
    scanButton: false,
    cancelButtonAccessibilityLabel: "QR読み取りを閉じる",
    torchButtonOnAccessibilityLabel: "ライトを消す",
    torchButtonOffAccessibilityLabel: "ライトをつける",
  });
  return result.ScanResult || null;
}

export async function exportBackupOnDevice(contents: string, filename: string) {
  if (!isNativeApp()) return false;
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const saved = await Filesystem.writeFile({
    path: filename,
    data: contents,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await Share.share({ title: "ともタイプのバックアップ", url: saved.uri, dialogTitle: "バックアップを保存" });
  return true;
}
