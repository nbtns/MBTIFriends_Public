import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "ともタイプ｜友達のMBTI・星座・誕生日を、もっと楽しく";
const description = "MBTIと生年月日から分かる星座・年齢をQRで交換。友達との楽しい過ごし方や、コミュニティのタイプ傾向がわかる、アカウント不要の友達ノート。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", locale: "ja_JP", images: [{ url: imageUrl, width: 1730, height: 910, alt: "ともタイプ - タイプを知ると、もっと仲良くなれる。" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
