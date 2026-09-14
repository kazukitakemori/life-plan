# UI Unification Checklist

## Foundation
- [x] UI統一専用ブランチを作成
- [x] 共通UIレイヤーを追加
- [x] 共通UIレイヤーを画面別CSSより後に読み込む
- [x] 一時検証データ `tmp-*.json` を削除
- [x] 一時検証データを `.gitignore` 対象へ追加

## Shared primitives
- [ ] Primary / Secondary / Danger ボタンを統一
- [ ] Input / Select / Textarea を統一
- [ ] Card / Panel を統一
- [ ] Tab / Segmented control を統一
- [ ] Page title / Section title / Helper text を統一
- [ ] Notice / Warning / Error を役割別に統一

## Steps
- [ ] Q1 ご家族
- [ ] Q2 教育費
- [ ] Q3 ライフイベント
- [ ] Q4 生活費
- [ ] Q5 住まい
- [ ] Q6 乗り物
- [ ] Q7 収入
- [ ] Q8 年金
- [ ] Q9 ローン
- [ ] Q10 保険
- [ ] Q11 貯蓄・運用
- [ ] Q12 老後の暮らし

## Analysis screens
- [ ] 資産形成
- [ ] 必要保障額
- [ ] 管理画面

## Responsive
- [ ] PCで主要画面を確認
- [ ] モバイルで主要画面を確認
- [ ] 不自然な改行がない
- [ ] 横はみ出しがない
- [ ] タップ対象が小さすぎない

## Cleanup
- [ ] 不要CSSを削除
- [ ] 重複CSSを削除
- [ ] 旧色指定を削除
- [ ] 旧文字サイズ指定を削除
- [ ] 未使用クラスを整理
