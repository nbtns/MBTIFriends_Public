export function GET() {
  const appId = process.env.APPLE_APP_ID;
  const details = appId ? [{
    appIDs: [appId],
    components: [{ "/": "/open", comment: "ともタイプの友達共有QRだけをアプリで開く" }],
  }] : [];
  return Response.json({ applinks: { details } }, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
