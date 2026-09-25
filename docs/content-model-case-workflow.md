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
- operatorMode（例: 個人情報非表示）
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
  "operatorMode": { "hidePersonalInfo": true },
  "purpose": "記事本文で家計改善前後のキャッシュフローを説明する"
}
```

## 4. 保存
アプリ内部では通常プランと同じ `PlanPayload / PlanRecord / PlanRepository` を利用する。
`modelCaseId` から `content-model:<modelCaseId>` を生成し、同一ケースの再実行は同じレコードを更新する。

保存後は必ず readback し、ID・定義メタデータ・schemaVersion・payload全体を検証する。新規ケースのステータスは入力中とし、保存だけでシミュレーション済みにしない。

## 5. Cloudflare接続可能時
制作専用Workspaceを1つ用意し、そのWorkspace IDを `CONTENT_MODEL_WORKSPACE_ID` に設定する。
ランダムな長い秘密値を `CONTENT_MODEL_API_TOKEN` としてSecret設定する。

`PUT /api/internal/content-models` はこの2値が未設定なら404で無効化される。通常顧客Workspaceを制作先に指定しない。

## 6. 撮影
Capture Specに従って通常計算結果を表示する。実UI・数値・グラフは固定原稿として扱い、AIで描き直さない。
撮影したPNGは原則として無加工の原本素材として扱う。ライフプランソフト開発側では、矢印・囲み・注釈・装飾の自動合成を標準工程に含めない。

## 7. 現在の実装段階
Phase 1:
- Content Model Case型
- PlanRecordへの変換
- idempotent保存
- readback検証
- 制作専用Workspaceへの保護API
- Capture Spec基礎

Phase 2（Capture Spec実行まで実装）:
- advisor利用権で個人情報非表示を利用可能（PC・スマホ）
- 顧客名・連絡先・プランメモを一覧・編集・削除確認で非表示（通常の編集ボタン等のUIは維持）
- 非表示中のメタデータ更新では元の個人情報を維持。書き出しデータはマスクしない
- URLの `modelCaseId` / `captureSpecId` から制作プランを自動で開く
- Capture Specの `view` をsemantic capture targetへ解決し、対象画面を自動表示
- `displayState.startAge`、キャッシュフロー表の `displayRange`、必要保障額の `riskKind` / `pageView` を表示専用状態として反映
- Capture Specのviewportと実viewportの一致を `data-content-capture-viewport-match` で機械判定
- フォント描画と2フレーム待機後に `data-content-capture-status="ready"` を公開
- capture modeではCSS animation / transitionを停止し、撮影差分を抑える
- 自動スクリーンショット自体はPhase 3で実装

Phase 3（自動撮影基盤）:
- Capture Spec URLをChromeで開く依存追加なしの撮影ランナー
- `data-content-capture-status="ready"` とviewport一致を待って撮影
- `captureRegion="viewport"` はviewport、その他はsemantic capture targetをPNG化
- PNGとmanifest JSONを同時生成
- PR Previewで `SIM-001-BASE` の主要4 view（cash-flow-table / asset-balance-chart / lifetime-balance / required-coverage）をE2E撮影
- 個別manifestを集約し、`SKILL-08-handoff.json` を生成
- handoffでは記事ID・モデルケースID・Capture Spec・画像ファイル・checksum・sourcePlanIdを機械的に追跡可能にする
- SKILL-08では撮影PNGを実画面原本として固定し、原則そのまま使用する。AI再描画・画像生成編集・自動注釈合成は標準手段にしない。ユーザーが別工程で合成する場合のみ、原本とは別の派生成果物として扱う

後続:
- 制作stagingでの認証済みブラウザ運用
- SKILL-08等の制作工程でhandoffを直接消費する運用
- 必要な場合のユーザー向け画像合成プロンプト生成
- WordPress下書きへの接続

## 8. 制作環境の運用

制作検証先は `life-plan-auth-staging`。`wrangler.content-staging.toml` は認証用staging D1に接続する。本番Worker/D1とは別で、Previewの認証解除も無効にする。

```powershell
$env:VITE_LICENSE_PREVIEW_UNLOCK='0'
$env:VITE_PREVIEW_SEED_DATA='0'
npm run build
npx wrangler deploy --config wrangler.content-staging.toml
```

SecretはCLIの標準入力またはCloudflareのSecret管理から設定し、値をリポジトリ・ログ・PRに残さない。既存Google/メール認証Secretは維持する。

モデル定義を通常のmigration経由で投入用JSONへ変換する:

```sh
npx tsx --tsconfig tsconfig.app.json scripts/prepare-content-model.mjs model.json request.json
npx tsx --tsconfig tsconfig.app.json scripts/verify-content-model.mjs
```

投入先はstagingの `PUT /api/internal/content-models`。BearerトークンとJSON本文を使用する。同一モデルを2回投入し、初回created=true、次回created=false、同一ID、revision増加、保存payloadの一致を確認する。APIは本文上限・Workspace存在・記事メタデータ・同時更新競合も検証する。

SIM-001-BASEはDrive正本TOP_baseの架空モデルを独立ケースとして固定したもの。標準Preview seedは変更しない。Googleログイン後に制作プランを開き、実計算結果を確認する。通常PRのPreviewは従来どおり認証解除・標準seed有効の別環境とする。


## 9. Capture Spec 実行URL

制作stagingへログイン済みの状態で、次のqueryを付けるとCapture Specを自動実行する。

```text
?modelCaseId=SIM-001-BASE&captureSpecId=SIM-001-CF
```

実行時は、制作Workspace内の `content-model:<modelCaseId>` を読み込み、保存済みdefinitionから該当Capture Specを取得する。通常顧客プランやURL側の任意payloadは使用しない。

撮影側は `html[data-content-capture-status="ready"]` を待つ。指定viewportがある場合は、`data-content-capture-viewport-match="true"` も確認してから撮影する。 `captureRegion="viewport"` 以外では、同名の `data-content-capture-target` を持つsemantic targetが存在することをready条件とする。

現時点で表示状態として対応するキー:
- `startAge`: 生涯収支グラフ / キャッシュフロー表の開始年齢
- `displayRange`: キャッシュフロー表の `all` / `10` / `20`
- `riskKind`: 必要保障額の `death` / `medical`
- `pageView`: 必要保障額の `simple` / `detail`


## 10. Phase 3 自動スクリーンショット

撮影はモデルケース保存とは別工程とする。撮影ランナーはPlanRecordを更新・再投入せず、既に表示可能なCapture Spec URLを開いて撮影するだけにする。

実行例:

```sh
node scripts/capture-content-image.mjs \
  --base-url https://pr-51-life-plan.kazuki-takemori-sub.workers.dev/ \
  --model-case-id SIM-001-BASE \
  --capture-spec-id SIM-001-CF \
  --source-environment pr-preview \
  --output-dir artifacts/content-captures
```

ランナーはCapture Specのviewportをページ側manifestから読み取り、初期viewportと異なる場合はviewportを合わせて再読込する。撮影対象はCSS selectorを仕様として持たず、ページが公開する `data-content-capture-target` のsemantic IDを使う。

生成manifestの主な項目:
- manifestVersion
- articleId
- modelCaseId
- captureSpecId
- view
- captureRegion
- viewport / actualViewport / viewportMatch
- operatorMode
- displayState
- imageFilename / imageWidth / imageHeight / imageSha256
- captureTimestamp
- sourceEnvironment / sourceUrl
- sourcePlanId

PR PreviewのE2Eでは、通常の `TOP_base` seedを上書きせず、Capture Spec URLで起動した場合だけ `content-model:SIM-001-BASE` のPreview専用fixtureを不足時に1回だけ作る。これは認証付き制作stagingのD1保存データとは独立したスモーク検証用であり、撮影ランナー自体は保存APIを呼ばない。

制作stagingを直接撮影する場合は、Google認証済みの専用ブラウザプロファイル等を撮影実行環境へ用意する。撮影失敗時はPlanRecordを再投入せず、同じCapture Specの撮影だけを再実行する。
