from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


# 1) Persist the original housing end boundary whenever Q12 temporarily overrides it.
path = Path('src/types/housing.ts')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "export type RentalEndMode = 'lifetime' | 'until';\n",
    """export type RentalEndMode = 'lifetime' | 'until';

/**
 * Q12 セカンドライフが転居のために終了時期を一時上書きしたときの退避値。
 * シナリオ変更時に元へ戻すため、住まいデータ側に保持する。
 */
export interface SecondLifeEndOverride {
  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
}
""",
    'housing end override type',
)
text = replace_once(
    text,
    """  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  /** 家賃負担者。未設定時は格納タブから推定 */
""",
    """  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  /** Q12 の転居反映前に設定されていた終了条件 */
  secondLifeEndOverride?: SecondLifeEndOverride;
  /** 家賃負担者。未設定時は格納タブから推定 */
""",
    'rental end override field',
)
text = replace_once(
    text,
    """  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  buildingMan: number;
""",
    """  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  /** Q12 の転居反映前に設定されていた終了条件 */
  secondLifeEndOverride?: SecondLifeEndOverride;
  buildingMan: number;
""",
    'owned end override field',
)
path.write_text(text, encoding='utf-8')


# 2) Owned-property migration is explicit, so preserve the Q12 restoration metadata.
path = Path('src/lib/housingDefaults.ts')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    """    endAge:
      property.endAge ?? Math.max(startAge + 1, member?.expectedLifespan ?? 90),
    endMonth: property.endMonth ?? referenceMonth,
    buildingMan: property.buildingMan ?? 0,
""",
    """    endAge:
      property.endAge ?? Math.max(startAge + 1, member?.expectedLifespan ?? 90),
    endMonth: property.endMonth ?? referenceMonth,
    ...(property.secondLifeEndOverride
      ? { secondLifeEndOverride: property.secondLifeEndOverride }
      : {}),
    buildingMan: property.buildingMan ?? 0,
""",
    'owned migration end override',
)
path.write_text(text, encoding='utf-8')


# 3) Always restore a previous Q12-generated end override before applying the latest scenario.
path = Path('src/lib/secondLifeTemplates.ts')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    """  T extends {
    id: string;
    name: string;
    startAge: number;
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
  },
""",
    """  T extends {
    id: string;
    name: string;
    startAge: number;
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
    secondLifeEndOverride?: {
      endMode: 'lifetime' | 'until';
      endAge: number;
      endMonth: number;
    };
  },
""",
    'end existing generic metadata',
)
text = replace_once(
    text,
    """    return {
      ...item,
      endMode: 'until' as const,
      endAge: end.age,
      endMonth: end.month,
    };
""",
    """    return {
      ...item,
      secondLifeEndOverride: item.secondLifeEndOverride ?? {
        endMode: item.endMode,
        endAge: item.endAge,
        endMonth: item.endMonth,
      },
      endMode: 'until' as const,
      endAge: end.age,
      endMonth: end.month,
    };
""",
    'save original end boundary',
)
insert_after = """function isSecondLifeHousingItem(name: string): boolean {
  return (
    name === SECOND_LIFE_RENTAL_NAME ||
    name === SECOND_LIFE_OWNED_NAME ||
    name === SECOND_LIFE_HOMETOWN_HOME_NAME
  );
}
"""
restore_fn = """

function restoreSecondLifeManagedEnds<
  T extends {
    endMode: 'lifetime' | 'until';
    endAge: number;
    endMonth: number;
    secondLifeEndOverride?: {
      endMode: 'lifetime' | 'until';
      endAge: number;
      endMonth: number;
    };
  },
>(items: T[]): T[] {
  return items.map((item) => {
    const original = item.secondLifeEndOverride;
    if (!original) return item;
    return {
      ...item,
      endMode: original.endMode,
      endAge: original.endAge,
      endMonth: original.endMonth,
      secondLifeEndOverride: undefined,
    };
  });
}
"""
text = replace_once(text, insert_after, insert_after + restore_fn, 'restore managed end function')
text = replace_once(
    text,
    """  let rentals = stripped.rentals;
  let owned = stripped.owned;

  if (relocating) {
""",
    """  // 前回の Q12 反映で終了時期を動かしていた場合は、まず元の条件へ戻す。
  // そのうえで今回の最新シナリオを適用することで、転居→住み続ける等の変更でも
  // Q5 に古い終了境界を残さない。
  let rentals = restoreSecondLifeManagedEnds(stripped.rentals);
  let owned = restoreSecondLifeManagedEnds(stripped.owned);

  if (relocating) {
""",
    'restore before latest scenario',
)
path.write_text(text, encoding='utf-8')
