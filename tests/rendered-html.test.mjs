import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("ともタイプの初期画面をサーバー描画できる", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ともタイプ｜友達のMBTI・星座・誕生日を、もっと楽しく<\/title>/i);
  assert.match(html, /タイプを知ると/);
  assert.match(html, /アカウント不要/);
  assert.match(html, /友達の情報はこの端末だけ/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("QR受信・プライバシー・問い合わせの公開ページを表示できる", async () => {
  for (const [path, marker] of [["/open", "OPEN TOMO TYPE"], ["/privacy", "PRIVACY POLICY"], ["/support", "SUPPORT"]]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), new RegExp(marker));
  }
});

test("Universal Links設定ファイルをJSONで返す", async () => {
  const response = await render("/.well-known/apple-app-site-association");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const body = await response.json();
  assert.deepEqual(body, { applinks: { details: [] } });
});
