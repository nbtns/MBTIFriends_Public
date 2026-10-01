# iOSテスト計画

制作実績向けの公開用コピーです。`com.example.tomotype` と `example.com` は見本であり、iOSで配布・共有する場合は自分の設定へ変更します。以下は確認手順で、実機の検証完了を示すものではありません。

## 目的

「ともタイプ」はiPhoneを先にリリースします。Windowsで日常的な自動テストを行い、Apple固有の動きだけをMacと実機で確認します。

## Windowsで毎回行う確認

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd audit --omit=dev
```

これで次の内容を確認します。

- 通常画面とiPhone用画面がどちらも作れる
- 共有QRが許可したHTTPSリンクだけを使う
- StellaLogがアプリ内ブラウザ用機能に依存していない
- 端末内保存、カメラ許可、Universal Linksの設定が残っている
- QR受信、プライバシーポリシー、問い合わせページが表示できる

## Macで最初に行う準備

1. MacにNode.js、Xcode、Xcode Command Line Toolsを入れる
2. このプロジェクトで `npm install` と `npm run mobile:sync` を実行する
3. `ios/App/App.xcodeproj` をXcodeで開く
4. Signing & CapabilitiesでApple Developer Teamを選ぶ
5. Bundle IdentifierがApp Store Connectの登録と一致していることを確認する
6. Associated Domainsに `applinks:example.com` があることを確認する

現在のBundle Identifierは仮の `com.example.tomotype` です。App Store Connect登録前に正式決定します。

## iPhone実機で確認する項目

- 初回起動後、自分のMBTIと年を含む生年月日を登録し、星座と現在の年齢が自動表示され、アプリを閉じても内容が残る
- 自分の実際の好みを登録し、QRを受け取った側にも選択済みの項目だけが表示される
- カメラを許可した場合、別のiPhoneに表示したQRを読み取れる
- カメラを拒否した場合、アプリが落ちず読み取り画面を閉じられる
- アプリを終了した状態でQRリンクを開くと、アプリが起動して友達確認画面になる
- アプリを開いた状態で別のQRリンクを開いても、同じ確認画面になる
- ともタイプ以外のURLや壊れたQRを友達として登録しない
- StellaLogのボタンを押すと、アプリ内画面ではなくiPhoneで選んだ既定ブラウザが開く
- バックアップを書き出して、共有先を選べる
- 機内モードでも登録済みの友達と相性を見られる
- MBTI・生年月日が不明な友達を登録し、再起動後も消えない
- 誕生日通知をONにした操作でだけ通知許可が表示され、拒否してもアプリが落ちない
- 通知を許可すると、誕生日当日の朝9時に友達の呼び名を含む通知が届く
- 誕生日・呼び名の編集、友達の削除、通知OFF後に古い内容の通知が残らない
- 2月29日生まれは、平年には3月1日の朝9時に通知される
- 友達の情報、実際の好み、「次に会ったら」メモを編集できる
- 会う直前モードに、次回メモ・好み・会話のきっかけが表示される
- 友達同士を選んで相性と紹介提案を表示でき、同じ友達同士は比較しない
- 目的を変えると相性ランキングの順位と％が更新される
- 旧形式のバックアップと旧QRを引き続き読み取れる
- 文字サイズを大きくしても主要なボタンを押せる
- VoiceOverで登録・QR・戻るボタンの意味が分かる

Universal LinksはApple側のキャッシュがあるため、設定変更後はアプリの再インストールを含めて確認します。

## TestFlightで確認する項目

- 新規インストール、上書き更新、アプリ削除後の挙動
- 複数のiPhoneサイズと最新・ひとつ前のiOS
- QRを送る側と受け取る側の両方
- プライバシーポリシーと問い合わせ先へ到達できる
- App Store案内ページから正しいアプリページへ進める

## 公開前に必要な未確定項目

- Apple Developer Team ID
- 正式なBundle Identifier
- App Store公開後のURL
- アプリアイコンとストア用画像
- サブスクの商品IDと審査文言

Apple Developer Team IDとApp Store URLが決まるまでは、Universal Links設定ファイルとストアボタンを意図的に無効にしています。また、Appleが設定ファイルを取得できるよう、QR入口ページを置くドメインは最終的に外部からアクセス可能である必要があります。

## 将来のプレミアム機能

初回はiOSだけを対象にするため、Androidなど別OSへの移行は実装しません。一方で、同じApple IDによる再インストールや機種変更に備え、サブスク導入時には「購入を復元」ボタンを用意します。アプリ独自アカウントは作りません。
