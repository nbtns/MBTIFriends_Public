"use client";

export default function BrowserOpenButton() {
  return <button className="primary-button full-button" onClick={() => {
    // フラグメントは同じ公開用アプリへ渡し、サーバーには送信しません。
    window.location.assign(`/${window.location.hash}`);
  }}>ブラウザで受け取る <span>↗</span></button>;
}
