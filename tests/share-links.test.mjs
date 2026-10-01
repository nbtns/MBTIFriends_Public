import assert from "node:assert/strict";
import test from "node:test";
import { resolveShareBase } from "../lib/share-links.ts";

test("公開用の共有リンクは現在のブラウザの公開先を使う", () => {
  assert.equal(resolveShareBase(undefined, "http://localhost:5173"), "http://localhost:5173/open");
  assert.equal(resolveShareBase(undefined, "https://demo.example.org"), "https://demo.example.org/open");
});

test("ネイティブの未設定URLは見本URLに限定する", () => {
  assert.equal(resolveShareBase(), "https://example.com/open");
  assert.equal(resolveShareBase(undefined, "capacitor://localhost"), "https://example.com/open");
});

test("明示したHTTPS公開先を優先し、認証情報や別パスを拒否する", () => {
  assert.equal(resolveShareBase("https://demo.example.org/open", "http://localhost:5173"), "https://demo.example.org/open");
  for (const invalid of ["http://demo.example.org/open", "javascript:alert(1)", "https://user:pass@example.org/open", "https://example.org/other", "https://example.org/open#card=private", "https://example.org/open?card=private"]) {
    assert.throws(() => resolveShareBase(invalid), undefined, invalid);
  }
});
