from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# If an older saved plan points to a pension option that is no longer available
# (e.g. pension inputs were removed), never silently produce a zero/undefined plan.
replace(
    'src/lib/secondLifeApply.ts',
    "  const selected = options.find((o) => o.level === secondLifeState.livingLevel);\n  if (!selected) return livingState;",
    "  const selected =\n    options.find((o) => o.level === secondLifeState.livingLevel) ??\n    options.find((o) => o.level === 'same');\n  if (!selected) return livingState;",
)

# Keep the visible selection aligned with that safe fallback.
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "  const useCurrentPlan = state.livingSkip;\n\n  return (",
    "  const useCurrentPlan = state.livingSkip;\n  const effectiveLivingLevel = options.some(\n    (option) => option.level === state.livingLevel,\n  )\n    ? state.livingLevel\n    : 'same';\n\n  return (",
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "              const active = state.livingLevel === option.level;",
    "              const active = effectiveLivingLevel === option.level;",
)

# Remove remaining step-number jargon from novice-facing warnings.
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "        title: `${secondLifeState.startAge}歳時点の住まいがQ5にありません`,",
    "        title: `${secondLifeState.startAge}歳時点の住まいが入力されていません`,",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "        title: `${actionAge}歳時点の持ち家がQ5にありません`,",
    "        title: `${actionAge}歳時点の持ち家が入力されていません`,",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "      title: `${actionAge}歳のリフォーム費を計算上追加します`,",
    "      title: `${actionAge}歳にリフォーム費を追加して計算します`,",
)

# These are template assumptions, not a personal quotation. Label accordingly.
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "                    総額{' '}",
    "                    目安額{' '}",
)

print('Q12 safety follow-up applied')
