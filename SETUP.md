# つぶやき帳の公開手順

## 1. GitHubへ入れる

このZIPを展開し、中にあるファイルとフォルダをすべて `yosakoi-web/kiyu_private` の一番上へアップロードします。

`index.html` がリポジトリの一番上に見える状態にしてください。ZIPファイル自体を置くだけでは動きません。

## 2. GitHub Pagesを有効にする

リポジトリの `Settings` → `Pages` を開きます。

`Build and deployment` の `Source` を `Deploy from a branch` にし、`main` と `/(root)` を選んで `Save` を押します。

公開後に見るアドレスは次です。

`https://yosakoi-web.github.io/kiyu_private/`

最初の公開や更新反映には数分かかる場合があります。

## 3. 管理者のiPhoneを接続する

上の公開アドレスをSafariで開き、管理者パスワード `7290` でログインします。

表示された `GitHub接続` 画面へFine-grained tokenを貼り、`接続確認` を押します。トークンは管理者のiPhone内だけに保存され、GitHubのファイルや投稿内容には入りません。

トークンの設定は次の2点です。

1. `Repository access` は `Only select repositories` で `kiyu_private` を選択
2. `Repository permissions` の `Contents` は `Read and write`

`Account permissions` は追加不要です。

## 4. 見る人へ渡すもの

見る人には公開アドレスと閲覧パスワード `2525` だけを渡します。GitHubトークンは渡しません。

見る人は画面の `更新` を押すと最新投稿を読み直せます。

## パスワードについて

この方式のパスワードは、身内向けの簡易ロックです。GitHub Pagesを一般公開すると、詳しい人はリポジトリや通信から内容を直接取得できます。機密写真や本当に外部へ見せられない内容には使わないでください。
