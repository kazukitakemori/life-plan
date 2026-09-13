from pathlib import Path

p = Path('src/lib/secondLifeGuide.ts')
s = p.read_text(encoding='utf-8')

old = """  const housingItem: SecondLifeChecklistItem = design
    ? {
        id: 'housing',
        stepId: 'housing',
        stepLabel: '5',
        title: '住まい',
        status: 'done',
        summary: design.housingSkip
          ? '今の住まい計画をそのまま使います'
          : design.housingScenario === 'stay' && design.stayOption === 'continue'
            ? '今の住まいをそのまま継続します'
            : `${design.housingActionAge}歳から、見直した住まい方で計算します`,
        detailLines: design.housingSkip
          ? ['現在入力している住まいの期間・費用をそのまま使います。']
          : ['元の住まい入力は残したまま試算します。'],
      }
    : buildHousingChecklistItem(input.housingState, startAge, headId);
"""
new = """  const housingItem: SecondLifeChecklistItem = design
    ? {
        id: 'housing',
        stepId: 'housing',
        stepLabel: '5',
        title: '住まい',
        status: design.housingConfigured === false ? 'missing' : 'done',
        summary:
          design.housingConfigured === false
            ? '未設定です'
            : design.housingSkip
              ? '今の住まい計画をそのまま使います'
              : design.housingScenario === 'stay' && design.stayOption === 'continue'
                ? '今の住まいをそのまま継続します'
                : `${design.housingActionAge}歳から、見直した住まい方で計算します`,
        detailLines:
          design.housingConfigured === false
            ? []
            : design.housingSkip
              ? ['現在入力している住まいの期間・費用をそのまま使います。']
              : ['元の住まい入力は残したまま試算します。'],
      }
    : buildHousingChecklistItem(input.housingState, startAge, headId);
"""
if old not in s:
    raise RuntimeError('housing guide block not found')
s = s.replace(old, new, 1)

old = """  const livingItem: SecondLifeChecklistItem = design
    ? {
        id: 'living',
        stepId: 'living',
        stepLabel: '4',
        title: '生活水準',
        status: 'done',
        summary: design.livingSkip
          ? '今の生活費計画をそのまま使います'
          : `${design.startAge}歳から、選んだ生活費で計算します`,
        detailLines: design.livingSkip
          ? ['現在入力している生活費計画をそのまま使います。']
          : ['元の生活費入力は残したまま試算します。'],
      }
    : buildLivingChecklistItem({
"""
new = """  const livingItem: SecondLifeChecklistItem = design
    ? {
        id: 'living',
        stepId: 'living',
        stepLabel: '4',
        title: '生活水準',
        status: design.livingConfigured === false ? 'missing' : 'done',
        summary:
          design.livingConfigured === false
            ? '未設定です'
            : design.livingSkip
              ? '今の生活費計画をそのまま使います'
              : `${design.startAge}歳から、選んだ生活費で計算します`,
        detailLines:
          design.livingConfigured === false
            ? []
            : design.livingSkip
              ? ['現在入力している生活費計画をそのまま使います。']
              : ['元の生活費入力は残したまま試算します。'],
      }
    : buildLivingChecklistItem({
"""
if old not in s:
    raise RuntimeError('living guide block not found')
s = s.replace(old, new, 1)

old = """    const projections = findNursingProjections(
      lifeEventState.byMember[member.id] ?? [],
    );

    if (design.skip) {
"""
new = """    const projections = findNursingProjections(
      lifeEventState.byMember[member.id] ?? [],
    );

    if (design.configured === false) {
      needsCost += 1;
      detailLines.push(`${getMemberTabLabel(member)}：未設定`);
      continue;
    }

    if (design.skip) {
"""
if old not in s:
    raise RuntimeError('nursing guide loop marker not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('Guide compatibility patch applied')
