import Link from "next/link";

export const metadata = { title: "お問い合わせ｜ともタイプ" };

export default function SupportPage() {
  return <main className="legal-shell legal-document">
    <header className="legal-brand"><span className="brand-mark">t</span><b>ともタイプ</b></header>
    <p>このページは公開用サンプルです。下記のメールアドレスは見本です。</p>
    <span className="eyebrow">SUPPORT</span><h1>お問い合わせ</h1>
    <section><h2>困ったときは</h2><p>QRを読み取れない場合は、カメラの利用許可を確認するか、相手から共有リンクを送ってもらって開いてください。</p></section>
    <section><h2>データについて</h2><p>友達情報は端末内だけに保存されます。機種変更やアプリ削除の前に、アプリの「バックアップを書き出す」から保存してください。</p></section>
    <section className="contact-card"><h2>メールで問い合わせる</h2><p>不具合の場合は、iPhoneの機種、iOSのバージョン、起きたことを添えてください。友達の名前やメモは送らないでください。</p><a className="primary-button" href="mailto:contact@example.com?subject=ともタイプのお問い合わせ">contact@example.com <span>↗</span></a></section>
    <div className="legal-nav"><Link href="/privacy">プライバシーポリシー</Link><Link href="/open">アプリ案内</Link></div>
  </main>;
}
