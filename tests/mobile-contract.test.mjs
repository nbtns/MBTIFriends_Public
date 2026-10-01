import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("共有QRは許可した公開用リンクだけをアプリへ渡す", async () => {
  const source = await read("../lib/mobile-platform.ts");
  assert.match(source, /resolveShareBase/);
  assert.match(source, /parsed\.origin !== allowed\.origin/);
  assert.match(source, /parsed\.pathname !== allowed\.pathname/);
  assert.match(source, /App\.getLaunchUrl\(\)/);
  assert.match(source, /App\.addListener\("appUrlOpen"/);
});

test("StellaLogはアプリ内ブラウザを使わず既定ブラウザで開く", async () => {
  const source = await read("../lib/mobile-platform.ts");
  const packageSource = await read("../package.json");
  assert.match(source, /AppLauncher\.openUrl\(\{ url \}\)/);
  assert.doesNotMatch(source, /@capacitor\/browser|inappbrowser/i);
  assert.doesNotMatch(packageSource, /@capacitor\/browser|inappbrowser/i);
});

test("iPhoneではQRカメラと端末内SQLiteを使う", async () => {
  const platform = await read("../lib/mobile-platform.ts");
  const storage = await read("../lib/device-storage.ts");
  const infoPlist = await read("../ios/App/App/Info.plist");
  assert.match(platform, /CapacitorBarcodeScannerTypeHint\.QR_CODE/);
  assert.match(storage, /@capacitor-community\/sqlite/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS app_state/);
  assert.match(storage, /localStorage/);
  assert.match(infoPlist, /NSCameraUsageDescription/);
});

test("iOSプロジェクトはiPhoneとUniversal Links用に設定されている", async () => {
  const config = await read("../capacitor.config.ts");
  const entitlements = await read("../ios/App/App/App.entitlements");
  const xcodeProject = await read("../ios/App/App.xcodeproj/project.pbxproj");
  assert.match(config, /appId: "com\.example\.tomotype"/);
  assert.match(config, /webDir: "mobile-dist"/);
  assert.match(entitlements, /applinks:example\.com/);
  assert.equal((xcodeProject.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length, 2);
  assert.equal((xcodeProject.match(/TARGETED_DEVICE_FAMILY = 1;/g) ?? []).length, 2);
});

test("iPhoneのキーボードは完了を1回押すと入力欄の選択状態も解除する", async () => {
  const sceneDelegate = await read("../ios/App/App/SceneDelegate.swift");
  assert.match(sceneDelegate, /UIResponder\.keyboardDidHideNotification/);
  assert.match(sceneDelegate, /document\.activeElement\.blur\(\)/);
  assert.match(sceneDelegate, /NotificationCenter\.default\.removeObserver\(self\)/);
});
