# UI Unification Notes

## 2026-09-14

- `master` を土台にUI統一作業を開始。
- 開いているPRは0件だったため、未採用変更との競合なし。
- UI共通基盤は既に `ui-system.css` に存在するが、旧色・直書きサイズ・画面別CSSが多数残っている。
- 最終上書きレイヤーとして `ui-unification.css` を追加。
- 一時検証データ `tmp-nursing.json`, `tmp-ui-tax.json`, `tmp-y2-tax-out.json`, `tmp-y2-tax.json` を削除。
- `.gitignore` に `tmp-*.json` を追加。
