# GitHub への公開手順

## 1. 新規リポジトリを作る

GitHub で新規リポジトリを作成します。たとえば:

- Repository name: `hydraulic-simple-calc`
- Public / Private は用途に応じて選択

## 2. このフォルダを push する

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<YOUR_NAME>/hydraulic-simple-calc.git
git push -u origin main
```

## 3. GitHub Pages を有効化する

GitHub の対象リポジトリで:

1. `Settings`
2. `Pages`
3. `Deploy from a branch`
4. Branch を `main`
5. Folder を `/root`
6. `Save`

数分後に公開URLが発行されます。

## 4. 独自ドメインを使う場合

- GitHub Pages の設定で Custom domain を追加
- DNS 側で必要な設定を行う

## 5. いじるときの基本

- `index.html`: 画面
- `styles.css`: 見た目
- `calc.js`: 計算ロジック
- `app.js`: UIとイベント
- `tests/calc.test.mjs`: 計算テスト

## 6. 運用のコツ

- まずは MVP のまま公開
- 実データでズレる箇所を Issue 化
- その後に事業体別設定や帳票を追加

この順番のほうが、最短で使い始められます。
