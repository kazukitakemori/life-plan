# Content Model Case workflow

記事制作でライフプランソフトの実計算結果を再現・撮影するための運用仕様。

## 1. 記事設計
記事ごとに固定の `articleId` を決める。記事内で複数ケースを比較する場合は、ケースごとに固定の `modelCaseId` を付ける。

## 2. Content Model Case
ケース定義は次を持つ。

- version
- articleId
- modelCaseId
- title
- editorialPurpose
- assumptions
- captureSpecs
- payload

数値入力の正本は `payload`。説明文だけから計算値を推測しない。

## 3. Capture Spec
各撮影対象は固定の `id` を持ち、以下を意味的に指定する。

- view
- displayState
- captureRegion
- viewport
- privacyMode
- purpose
- note

CSS selector やDOM構造を正本にしない。

例:

```json
{
  "id": "SIM-001-CF-01",
  "view": "cash-flow-table",
  "displayState": { "startAge": 35 },
  "captureRegion": "viewport",
  "viewport": { "width": 1440, "height": 1000 },
  "privacyMode": "content-safe",
  "purpose": "記事本文で家計改善前後のキャッシュフローを説明する"
}
```

## 4. 保存
アプリ内部では通常プランと同じ `PlanPayload / PlanRecord / PlanRepository` を利用する。
`modelCaseId` から `content-model:<modelCaseId>` を生成し、同一ケースの再実行は同じレコードを更新する。

保存後は必ず readback し、IDと記事メタデータを検証する。

## 5. Cloudflare接続可能時
制作専用Workspaceを1つ用意し、そのWorkspace IDを `CONTENT_MODEL_WORKSPACE_ID` に設定する。
ランダムな長い秘密値を `CONTENT_MODEL_API_TOKEN` としてSecret設定する。

`PUT /api/internal/content-models` はこの2値が未設定なら404で無効化される。通常顧客Workspaceを制作先に指定しない。

## 6. 撮影
Capture Specに従って通常計算結果を表示する。実UI・数値・グラフは固定原稿として扱い、AIで描き直さない。
記事用の矢印、囲み、短い注釈などは撮影後の別レイヤーで加える。

## 7. 現在の実装段階
Phase 1:
- Content Model Case型
- PlanRecordへの変換
- idempotent保存
- readback検証
- 制作専用Workspaceへの保護API
- Capture Spec基礎

Phase 2:
- capture mode
- semantic capture target
- privacy-safe UI
- deterministic viewport/display state

Phase 3:
- 記事パイプラインから自動投入
- 自動キャプチャ
- 注釈合成
- WordPress下書きへの接続
