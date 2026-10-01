import Link from "next/link";
import BrowserOpenButton from "./browser-open-button";

export const metadata = {
  title: "ともタイプを開く",
  description: "ともタイプのQRからiPhoneアプリを開きます。",
};

export default function OpenAppPage() {
  const appStoreUrl = process.env.APP_STORE_URL;
  return <main className="legal-shell">
    <header className="legal-brand"><span className="brand-mark">t</span><b>ともタイプ</b></header>
    <section className="open-card">
      <span className="open-icon">▦</span>
      <p className="eyebrow">OPEN TOMO TYPE</p>
      <h1>友達のタイプを<br />受け取りましょう。</h1>
      <p>制作実績向けの公開用サンプルです。ブラウザで共有プロフィールの受け取りを試せます。iPhoneでの直接起動は、自分の公開先とAppleの設定が必要です。</p>
      <BrowserOpenButton />
      {appStoreUrl
        ? <a className="primary-button full-button" href={appStoreUrl}>App Storeで入手 <span>↗</span></a>
        : <button className="primary-button full-button" disabled>App Store公開準備中</button>}
      <small>初めてインストールしたあとは、友達のQRをもう一度読み取ってください。</small>
      <small>QRに含まれる表示名・MBTI・生年月日・星座・実際の好みは、Webサーバーへ送信されません。</small>
    </section>
    <nav className="legal-nav"><Link href="/privacy">プライバシーポリシー</Link><Link href="/support">お問い合わせ</Link></nav>
  </main>;
}
