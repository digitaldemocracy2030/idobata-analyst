# エラー時にスクリプトを停止する & 変数が未定義の場合にエラーを出す & 実行したコマンドを表示する
# cf. https://qiita.com/yamato999/items/efb159e32fc37a9dc879
set -eux

# ルートディレクトリ
if [ -f .env ]; then
  echo "警告: .env ファイルが既に存在します。上書きしません。"
else
  cp .env.example .env
fi

# バックエンド
if [ -f packages/backend/.env ]; then
  echo "警告: packages/backend/.env ファイルが既に存在します。上書きしません。"
else
  cp packages/backend/.env.example packages/backend/.env
fi

# フロントエンド
if [ -f packages/frontend/.env ]; then
  echo "警告: packages/frontend/.env ファイルが既に存在します。上書きしません。"
else
  cp packages/frontend/.env.example packages/frontend/.env
fi