from pathlib import Path

path = Path('src/lib/secondLifeHousingApplySummary.ts')
text = path.read_text(encoding='utf-8')
needle = '''  if (\n    kind === 'purchase' &&\n    input.secondLifeState.housingScenario === 'stay' &&\n    input.existingHousingCount > 0\n  ) {\n    warnings.push(\n      '今の場所での購入・建て替えでは、既存の住まいは自動終了しません。期間が重なる場合は、既存物件の終了時期を確認してください。',\n    );\n  }\n\n  return warnings;\n'''
replacement = '''  if (\n    kind === 'purchase' &&\n    input.secondLifeState.housingScenario === 'stay' &&\n    input.existingHousingCount > 0\n  ) {\n    warnings.push(\n      '今の場所での購入・建て替えでは、既存の住まいは自動終了しません。期間が重なる場合は、既存物件の終了時期を確認してください。',\n    );\n  }\n\n  const improvementApplied = (input.changes ?? []).some(\n    (change) => change.type === 'improvement',\n  );\n  if (\n    kind === 'renovate' &&\n    input.secondLifeState.housingScenario === 'stay' &&\n    !improvementApplied\n  ) {\n    warnings.push(\n      'リフォーム費を反映できる持ち家が見つかりません。Q5「住まい」で現在の持ち家を登録・確認してから、もう一度反映してください。リフォーム費はライフイベントには自動登録しません。',\n    );\n  }\n\n  return warnings;\n'''
if needle not in text:
    raise SystemExit('warning insertion target not found')
path.write_text(text.replace(needle, replacement, 1), encoding='utf-8')

# Update stale comments so the source documents the new ownership rule.
path = Path('src/lib/secondLifeTemplates.ts')
text = path.read_text(encoding='utf-8')
text = text.replace(
    ' * Q12/Q5 の住まい設計を Q5 住まい入力へ反映する（変更インベントリ付き）。',
    ' * Q12 の住まい設計を Q5 住まい入力へ反映する（変更インベントリ付き）。',
    1,
)
text = text.replace(
    '/** リフォーム等、Q5に載らない一時金だけを Q3 へ反映 */',
    '/** 旧バージョンで作成された住まい連動ライフイベントを除去する互換処理 */',
    1,
)
text = text.replace(
    ' * 住まい設計の一括反映（Q5 + 必要時 Q3）。変更インベントリ付き。',
    ' * 住まい設計の一括反映。住まい費用の本体は Q5 / housingState のみ。',
    1,
)
path.write_text(text, encoding='utf-8')
print('final warning patch applied')
