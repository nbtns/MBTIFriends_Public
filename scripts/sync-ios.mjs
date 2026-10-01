import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../node_modules/@capacitor/cli/bin/capacitor", import.meta.url));
const result = spawnSync(process.execPath, [cli, "sync", "ios"], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Windowsで同期した場合も、Swift Packageの相対パスはMacで読める形式に揃えます。
const packageUrl = new URL("../ios/App/CapApp-SPM/Package.swift", import.meta.url);
const source = await readFile(packageUrl, "utf8");
const portable = source.replace(/path: "([^"\n]+)"/g, (_match, path) => `path: "${path.replaceAll("\\", "/")}"`);
if (portable !== source) {
  await writeFile(packageUrl, portable, "utf8");
  console.log("iOS用の相対パスをMacで使える形式に揃えました。");
}
