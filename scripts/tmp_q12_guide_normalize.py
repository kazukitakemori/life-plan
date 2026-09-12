from pathlib import Path

path = Path('src/lib/secondLifeGuide.ts')
text = path.read_text()

old_housing = """        summary: design.housingSkip
          ? 'Q5「住まい」の現在の計画をそのまま使います'
          : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,
        detailLines: design.housingSkip
          ? ['Q12では住まいを見直さず、Q5の入力をそのまま使用します。']
          : ['Q5の住まい入力自体は変更しません。'],"""
new_housing = """        summary: design.housingSkip
          ? 'Q5「住まい」の現在入力をそのまま計算に使用します'
          : design.housingScenario === 'stay' && design.stayOption === 'continue'
            ? 'Q5の現在の住まいをそのまま継続します'
            : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,
        detailLines: design.housingSkip
          ? ['Q12による住まいの上書きは無効です。']
          : ['Q5の住まい入力自体は変更しません。'],"""
if old_housing not in text:
    raise RuntimeError('current housing guide block not found')
text = text.replace(old_housing, new_housing, 1)

old_living = """        summary: design.livingSkip
          ? 'Q4「生活費」の現在の計画をそのまま使います'
          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,
        detailLines: design.livingSkip
          ? ['Q12では生活費を見直さず、Q4の入力をそのまま使用します。']
          : ['Q4の生活費入力自体は変更しません。'],"""
new_living = """        summary: design.livingSkip
          ? 'Q4「生活費」の現在入力をそのまま計算に使用します'
          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,
        detailLines: design.livingSkip
          ? ['Q12による生活費の上書きは無効です。']
          : ['Q4の生活費入力自体は変更しません。'],"""
if old_living not in text:
    raise RuntimeError('current living guide block not found')
text = text.replace(old_living, new_living, 1)

path.write_text(text)
print('Q12 guide normalized for patch')
