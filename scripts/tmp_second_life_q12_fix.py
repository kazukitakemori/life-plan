from pathlib import Path

path = Path('src/components/secondLife/SecondLifeGuideStep.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '  onApplySecondLifeNursing?: () => void;\n',
    '  onApplySecondLifeNursing: () => void;\n',
    1,
)
text = text.replace(
    '''      <SecondLifeHousingSection\n        state={secondLifeState}\n        onChange={onSecondLifeChange}\n''',
    '''      <SecondLifeHousingSection\n        state={secondLifeState}\n        onChange={(patch) =>\n          onSecondLifeChange({ ...secondLifeState, ...patch })\n        }\n''',
    1,
)
text = text.replace(
    '''      <SecondLifeLivingSection\n        state={secondLifeState}\n        onChange={onSecondLifeChange}\n''',
    '''      <SecondLifeLivingSection\n        state={secondLifeState}\n        onChange={(patch) =>\n          onSecondLifeChange({ ...secondLifeState, ...patch })\n        }\n''',
    1,
)
text = text.replace(
    "        applyStatus={guide.items.find((item) => item.id === 'nursing')}\n",
    "        applyStatus={guide.items.find((item) => item.id === 'nursing')?.status ?? 'missing'}\n",
    1,
)
path.write_text(text, encoding='utf-8')
