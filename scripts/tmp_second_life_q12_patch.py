from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


# 1) Q12 becomes the place to design/apply housing and living.
guide = Path('src/components/secondLife/SecondLifeGuideStep.tsx')
guide.write_text(r'''import { useMemo, useState } from 'react';

import {
  buildSecondLifeGuide,
  getSecondLifeChecklistStatusLabel,
  type SecondLifeChecklistItem,
} from '../../lib/secondLifeGuide';
import { SECOND_LIFE_DEFAULT_START_AGE } from '../../lib/secondLifeDefaults';
import { buildSecondLifeLivingOptions } from '../../lib/secondLifeEstimates';
import {
  buildSecondLifeHousingConsistency,
  getSecondLifeHousingConsistencyStatusLabel,
} from '../../lib/secondLifeHousingConsistency';
import {
  formatSecondLifeHousingApplyPreviewLines,
  getSecondLifeHousingApplyWarnings,
} from '../../lib/secondLifeHousingApplySummary';
import {
  getSecondLifeHousingDesignSummary,
  getSecondLifeLivingDesignSummary,
} from '../../lib/secondLifeLabels';
import type { SecondLifeHousingApplyResult } from '../../lib/secondLifeTemplates';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { HousingState } from '../../types/housing';
import type { PensionByMember } from '../../types/pension';
import type { SecondLifeState } from '../../types/secondLife';
import type { StepId } from '../../types/steps';
import { HousingSecondLifeApplyConfirmModal } from '../housing/HousingSecondLifeApplyConfirmModal';
import { StepHeading } from '../ui';
import { SecondLifeHousingSection } from './SecondLifeHousingSection';
import { SecondLifeLivingSection } from './SecondLifeLivingSection';
import { SecondLifeNursingSection } from './SecondLifeNursingSection';

interface SecondLifeGuideStepProps {
  members: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  secondLifeState: SecondLifeState;
  onSecondLifeChange: (state: SecondLifeState) => void;
  onApplySecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  onPreviewSecondLifeHousing?: () => SecondLifeHousingApplyResult | void;
  onApplySecondLifeLiving?: () => void;
  onApplySecondLifeNursing?: () => void;
  onNavigateToStep: (stepId: StepId) => void;
}

function ChecklistCard({
  item,
  designNote,
  actionLabel,
  onNavigate,
}: {
  item: SecondLifeChecklistItem;
  designNote?: string;
  actionLabel?: string;
  onNavigate: () => void;
}) {
  return (
    <article className={`second-life-guide-card second-life-guide-card--${item.status}`}>
      <div className="second-life-guide-card-head">
        <div>
          <p className="second-life-guide-card-step">
            {item.stepLabel} {item.title}
          </p>
          <p className="second-life-guide-card-summary">{item.summary}</p>
          {designNote ? (
            <p className="second-life-guide-card-design">設計：{designNote}</p>
          ) : null}
        </div>
        <span className={`second-life-guide-status second-life-guide-status--${item.status}`}>
          {getSecondLifeChecklistStatusLabel(item.status)}
        </span>
      </div>

      {item.detailLines.length > 0 ? (
        <ul className="second-life-guide-card-details">
          {item.detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="second-life-guide-nav-btn"
        onClick={onNavigate}
      >
        {actionLabel ?? `${item.stepLabel} の詳細を見る →`}
      </button>
    </article>
  );
}

export function SecondLifeGuideStep({
  members,
  housingState,
  livingState,
  lifeEventState,
  incomeByMember,
  pensionByMember,
  referenceDate,
  secondLifeState,
  onSecondLifeChange,
  onApplySecondLifeHousing,
  onPreviewSecondLifeHousing,
  onApplySecondLifeLiving,
  onApplySecondLifeNursing,
  onNavigateToStep,
}: SecondLifeGuideStepProps) {
  const head = members.find((member) => member.role === 'head');
  const [housingConfirmOpen, setHousingConfirmOpen] = useState(false);
  const [housingPreviewLines, setHousingPreviewLines] = useState<string[]>([]);
  const [housingWarnings, setHousingWarnings] = useState<string[]>([]);

  const guide = useMemo(
    () =>
      buildSecondLifeGuide({
        startAge: secondLifeState.startAge,
        secondLifeState,
        familyMembers: members,
        housingState,
        livingState,
        lifeEventState,
        referenceDate,
      }),
    [
      secondLifeState,
      members,
      housingState,
      livingState,
      lifeEventState,
      referenceDate,
    ],
  );

  const livingOptions = useMemo(
    () =>
      buildSecondLifeLivingOptions({
        livingState,
        familyMembers: members,
        incomeByMember,
        pensionByMember,
        referenceDate,
        startAge: secondLifeState.startAge,
      }),
    [
      livingState,
      members,
      incomeByMember,
      pensionByMember,
      referenceDate,
      secondLifeState.startAge,
    ],
  );

  const housingConsistency = useMemo(
    () =>
      buildSecondLifeHousingConsistency({
        housingState,
        secondLifeState,
      }),
    [housingState, secondLifeState],
  );

  if (!head) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族で世帯主を登録してください。
        </p>
      </div>
    );
  }

  const beginHousingApply = () => {
    if (!onApplySecondLifeHousing) return;
    const preview = onPreviewSecondLifeHousing?.();
    if (!preview) {
      onApplySecondLifeHousing();
      return;
    }
    const target = housingState.byTarget[head.id];
    const existingHousingCount =
      (target?.rentals.length ?? 0) + (target?.owned.length ?? 0);
    setHousingPreviewLines(
      preview.changes.length > 0
        ? formatSecondLifeHousingApplyPreviewLines(preview.changes)
        : preview.changeLines,
    );
    setHousingWarnings(
      getSecondLifeHousingApplyWarnings({
        secondLifeState,
        existingHousingCount,
        changes: preview.changes,
      }),
    );
    setHousingConfirmOpen(true);
  };

  const confirmHousingApply = () => {
    onApplySecondLifeHousing?.();
    setHousingConfirmOpen(false);
  };

  return (
    <div className="step-page second-life-step">
      <StepHeading
        number={12}
        title="セカンドライフ"
        lead="これからの暮らし方をここで具体化し、住まい・生活費・介護へ反映します"
      />

      <p className="second-life-guide-intro">
        セカンドライフ開始年齢を基準に、老後の住まい・生活水準・介護をこの画面で設計します。Q4・Q5・Q3は詳細データや反映結果を確認する画面として使います。
      </p>

      <div className="second-life-guide-start-age">
        <label className="second-life-timing">
          <span>セカンドライフ開始年齢（世帯主）</span>
          <input
            type="number"
            className="second-life-age-input"
            min={60}
            max={100}
            value={secondLifeState.startAge}
            onChange={(event) =>
              onSecondLifeChange({
                ...secondLifeState,
                startAge:
                  Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE,
              })
            }
          />
          <span>歳〜</span>
        </label>
      </div>

      <SecondLifeHousingSection
        state={secondLifeState}
        onChange={onSecondLifeChange}
        onApply={onApplySecondLifeHousing ? beginHousingApply : undefined}
        title="1. 住まいを決める"
      />

      <SecondLifeLivingSection
        state={secondLifeState}
        onChange={onSecondLifeChange}
        options={livingOptions}
        onApply={onApplySecondLifeLiving}
        title="2. 生活水準を決める"
      />

      <section
        className={`second-life-consistency second-life-consistency--${housingConsistency.status}`}
        aria-labelledby="second-life-housing-consistency-title"
      >
        <div className="second-life-consistency-head">
          <div>
            <p className="second-life-consistency-kicker">住まいとの整合性</p>
            <h3 id="second-life-housing-consistency-title">
              {housingConsistency.title}
            </h3>
          </div>
          <span
            className={`second-life-consistency-status second-life-consistency-status--${housingConsistency.status}`}
          >
            {getSecondLifeHousingConsistencyStatusLabel(housingConsistency.status)}
          </span>
        </div>
        <p className="second-life-consistency-summary">
          {housingConsistency.summary}
        </p>
        {housingConsistency.detailLines.length > 0 ? (
          <ul className="second-life-consistency-details">
            {housingConsistency.detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="second-life-consistency-actions">
          <span className="second-life-consistency-design">
            希望：{getSecondLifeHousingDesignSummary(secondLifeState)}
          </span>
          <button
            type="button"
            className="second-life-guide-nav-btn"
            onClick={() => onNavigateToStep('housing')}
          >
            住まいの詳細を見る →
          </button>
        </div>
      </section>

      <SecondLifeNursingSection
        members={members}
        state={secondLifeState}
        onChange={onSecondLifeChange}
        applyStatus={guide.items.find((item) => item.id === 'nursing')}
        onApply={onApplySecondLifeNursing}
        onOpenLifeEvent={() => onNavigateToStep('life-event')}
      />

      <h3 className="second-life-guide-checklist-title">整合性・反映状況</h3>
      <p className="second-life-guide-checklist-lead">
        Q12で決めた内容が、計算用データへ正しく反映されているか確認できます。
      </p>

      <div className="second-life-guide-grid">
        {guide.items.map((item) => (
          <ChecklistCard
            key={item.id}
            item={item}
            designNote={
              item.id === 'housing'
                ? getSecondLifeHousingDesignSummary(secondLifeState)
                : item.id === 'living'
                  ? getSecondLifeLivingDesignSummary(secondLifeState)
                  : undefined
            }
            actionLabel={
              item.id === 'housing'
                ? '住まいの詳細を見る →'
                : item.id === 'living'
                  ? '生活費の詳細を見る →'
                  : item.id === 'nursing'
                    ? 'ライフイベントの反映先を見る →'
                    : undefined
            }
            onNavigate={() => onNavigateToStep(item.stepId)}
          />
        ))}
      </div>

      <HousingSecondLifeApplyConfirmModal
        open={housingConfirmOpen}
        previewLines={housingPreviewLines}
        warnings={housingWarnings}
        onClose={() => setHousingConfirmOpen(false)}
        onConfirm={confirmHousingApply}
      />
    </div>
  );
}
''', encoding='utf-8')


# 2) Remove duplicate Q4/Q5 second-life editors and wire those actions into Q12.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

living_start = app.index('          <LivingStep')
living_end = app.index('          />', living_start) + len('          />')
living = app[living_start:living_end]
living = living.replace('            secondLifeState={secondLifeState}\n', '')
living = living.replace('            incomeByMember={incomeByMember}\n', '')
living = living.replace('            pensionByMember={pensionByMember}\n', '')
living = re.sub(
    r'\n            onSecondLifeChange=\{\(state\) => \{.*?\n            \}\}',
    '', living, count=1, flags=re.S,
)
living = re.sub(
    r'\n            onApplySecondLifeLiving=\{\(\) => \{.*?\n            \}\}',
    '', living, count=1, flags=re.S,
)
app = app[:living_start] + living + app[living_end:]

housing_start = app.index('          <HousingStep')
housing_end = app.index('          />', housing_start) + len('          />')
housing = app[housing_start:housing_end]
housing = housing.replace('            secondLifeState={secondLifeState}\n', '')
housing = re.sub(
    r'\n            onSecondLifeChange=\{\(state\) => \{.*?\n            \}\}',
    '', housing, count=1, flags=re.S,
)
housing = re.sub(
    r'\n            onApplySecondLifeHousing=\{\(\) => \{.*?\n            \}\}',
    '', housing, count=1, flags=re.S,
)
housing = re.sub(
    r'\n            onPreviewSecondLifeHousing=\{\(\) => \{.*?\n            \}\}',
    '', housing, count=1, flags=re.S,
)
housing = housing.replace('            onNavigateToStep={setActiveStep}\n', '')
app = app[:housing_start] + housing + app[housing_end:]

other_start = app.index('          <SecondLifeGuideStep')
other_end = app.index('          />', other_start) + len('          />')
other = app[other_start:other_end]
anchor = '            lifeEventState={lifeEventState}\n            referenceDate={referenceDate}\n'
addition = (
    '            lifeEventState={lifeEventState}\n'
    '            incomeByMember={incomeByMember}\n'
    '            pensionByMember={pensionByMember}\n'
    '            referenceDate={referenceDate}\n'
)
if anchor not in other:
    raise SystemExit('missing Q12 data props anchor')
other = other.replace(anchor, addition, 1)
apply_anchor = '            onApplySecondLifeNursing={() => {\n'
q12_actions = '''            onApplySecondLifeLiving={() => {
              markPlanInputsChanged();
              setLivingState(
                applySecondLifeLivingDesign({
                  livingState,
                  secondLifeState,
                  familyMembers,
                  incomeByMember,
                  pensionByMember,
                  referenceDate,
                }),
              );
            }}
            onApplySecondLifeHousing={() => {
              const head = familyMembers.find((member) => member.role === 'head');
              if (!head) return;
              markPlanInputsChanged();
              const applied = applySecondLifeHousingDesign({
                housingState,
                lifeEventState,
                secondLifeState,
                member: head,
                familyMembers,
                referenceDate,
                targetId: head.id,
              });
              setHousingState(applied.housingState);
              setLifeEventState(applied.lifeEventState);
              return applied;
            }}
            onPreviewSecondLifeHousing={() => {
              const head = familyMembers.find((member) => member.role === 'head');
              if (!head) return;
              return applySecondLifeHousingDesign({
                housingState,
                lifeEventState,
                secondLifeState,
                member: head,
                familyMembers,
                referenceDate,
                targetId: head.id,
              });
            }}
'''
if apply_anchor not in other:
    raise SystemExit('missing Q12 nursing action anchor')
other = other.replace(apply_anchor, q12_actions + apply_anchor, 1)
app = app[:other_start] + other + app[other_end:]
app_path.write_text(app, encoding='utf-8')


# 3) Represent second-life renovation costs inside housing whenever a home exists.
templates_path = Path('src/lib/secondLifeTemplates.ts')
templates = templates_path.read_text(encoding='utf-8')
templates = replace_once(
    templates,
    "import { createDefaultSecondLifeState } from './secondLifeDefaults';\n",
    "import { calcBirthYear, calcYearAtAge } from './birthDate';\nimport { createDefaultSecondLifeState } from './secondLifeDefaults';\n",
    'birth date imports',
)
templates = replace_once(
    templates,
    "  createOwnedProperty,\n  createRentalProperty,\n",
    "  createOwnedImprovementEntry,\n  createOwnedProperty,\n  createRentalProperty,\n",
    'improvement helper import',
)
templates = replace_once(
    templates,
    "export const SECOND_LIFE_OWNED_NAME = 'セカンドライフ購入住宅';\nexport const SECOND_LIFE_LIVING_LABEL = 'セカンドライフ生活費';\n",
    "export const SECOND_LIFE_OWNED_NAME = 'セカンドライフ購入住宅';\nexport const SECOND_LIFE_HOMETOWN_HOME_NAME = 'セカンドライフ実家';\nexport const SECOND_LIFE_LIVING_LABEL = 'セカンドライフ生活費';\n\nconst SECOND_LIFE_IMPROVEMENT_ID = 'second-life-renovation';\n",
    'hometown constants',
)
templates = replace_once(
    templates,
    "function isSecondLifeHousingItem(name: string): boolean {\n  return name === SECOND_LIFE_RENTAL_NAME || name === SECOND_LIFE_OWNED_NAME;\n}\n",
    "function isSecondLifeHousingItem(name: string): boolean {\n  return (\n    name === SECOND_LIFE_RENTAL_NAME ||\n    name === SECOND_LIFE_OWNED_NAME ||\n    name === SECOND_LIFE_HOMETOWN_HOME_NAME\n  );\n}\n",
    'second-life housing names',
)
templates = replace_once(
    templates,
    "  const owned = data.owned.filter((property) => {\n    if (!isSecondLifeHousingItem(property.name)) return true;\n    cleared.push({\n      type: 'cleared',\n      propertyKind: 'owned',\n      id: property.id,\n      name: property.name,\n    });\n    return false;\n  });\n  return { rentals, owned, cleared };\n",
    "  const owned = data.owned\n    .filter((property) => {\n      if (!isSecondLifeHousingItem(property.name)) return true;\n      cleared.push({\n        type: 'cleared',\n        propertyKind: 'owned',\n        id: property.id,\n        name: property.name,\n      });\n      return false;\n    })\n    .map((property) => ({\n      ...property,\n      maintenance: {\n        ...property.maintenance,\n        improvements: property.maintenance.improvements.filter(\n          (entry) => entry.id !== SECOND_LIFE_IMPROVEMENT_ID,\n        ),\n      },\n    }));\n  return { rentals, owned, cleared };\n",
    'strip generated improvements',
)
templates = replace_once(
    templates,
    "type HousingApplyMutation = {\n  housingState: HousingState;\n  kind: SecondLifeHousingTemplateKind;\n  relocating: boolean;\n  changes: SecondLifeHousingApplyChange[];\n};\n",
    "type HousingApplyMutation = {\n  housingState: HousingState;\n  kind: SecondLifeHousingTemplateKind;\n  relocating: boolean;\n  renovationAppliedToHousing: boolean;\n  changes: SecondLifeHousingApplyChange[];\n};\n",
    'housing mutation type',
)
old_early = """  if (kind === 'skip' || kind === 'renovate') {
    return {
      housingState: migrateHousingState({
        ...input.housingState,
        byTarget: {
          ...input.housingState.byTarget,
          [targetId]: { ...data, rentals, owned },
        },
      }),
      kind,
      relocating,
      changes,
    };
  }

  const refMonth = input.referenceDate.getMonth() + 1;
  const refYear = input.referenceDate.getFullYear();
"""
new_early = """  if (kind === 'skip') {
    return {
      housingState: migrateHousingState({
        ...input.housingState,
        byTarget: {
          ...input.housingState.byTarget,
          [targetId]: { ...data, rentals, owned },
        },
      }),
      kind,
      relocating,
      renovationAppliedToHousing: false,
      changes,
    };
  }

  const refMonth = input.referenceDate.getMonth() + 1;
  const refYear = input.referenceDate.getFullYear();

  if (kind === 'renovate') {
    const amountMan = estimateSecondLifeHousingTotalMan(input.secondLifeState) ?? 0;
    const birthYear = calcBirthYear(
      input.member.age,
      input.member.birthMonth,
      input.referenceDate,
    );
    const renovationYear = calcYearAtAge(
      birthYear,
      input.member.birthMonth ?? 1,
      startAge,
      1,
    );
    const improvement = () =>
      createOwnedImprovementEntry(renovationYear, 1, {
        id: SECOND_LIFE_IMPROVEMENT_ID,
        amountMan,
      });
    let renovationAppliedToHousing = false;

    if (
      input.secondLifeState.housingScenario === 'hometown' &&
      input.secondLifeState.hometownOption === 'renovate_parents'
    ) {
      let property = createOwnedProperty(
        'detached_house',
        input.member,
        refMonth,
        refYear,
        {
          usage: 'upcoming',
          name: SECOND_LIFE_HOMETOWN_HOME_NAME,
          startAge,
          startMonth: 1,
          buildingMan: 0,
          landMan: 0,
          paymentMethod: 'cash',
          currentExpenseMode: 'simple',
          simpleMonthlyExpenseMan: 0,
        },
        { rentals, owned },
      );
      property = {
        ...property,
        maintenance: {
          ...property.maintenance,
          improvements: [improvement()],
        },
      };
      owned = [...owned, property];
      renovationAppliedToHousing = true;
      changes.push(
        {
          type: 'added',
          propertyKind: 'owned',
          id: property.id,
          name: property.name,
          buildingMan: 0,
          landMan: 0,
        },
        {
          type: 'improvement',
          propertyId: property.id,
          propertyName: property.name,
          amountMan,
          year: renovationYear,
          month: 1,
        },
      );
    } else {
      const propertyIndex = owned.findIndex(
        (property) =>
          property.startAge <= startAge &&
          (property.endMode === 'lifetime' || property.endAge >= startAge),
      );
      if (propertyIndex >= 0) {
        const property = owned[propertyIndex];
        const updated = {
          ...property,
          maintenance: {
            ...property.maintenance,
            improvements: [
              ...property.maintenance.improvements,
              improvement(),
            ],
          },
        };
        owned = owned.map((item, index) =>
          index === propertyIndex ? updated : item,
        );
        renovationAppliedToHousing = true;
        changes.push({
          type: 'improvement',
          propertyId: updated.id,
          propertyName: updated.name,
          amountMan,
          year: renovationYear,
          month: 1,
        });
      }
    }

    return {
      housingState: migrateHousingState({
        ...input.housingState,
        byTarget: {
          ...input.housingState.byTarget,
          [targetId]: { ...data, rentals, owned },
        },
      }),
      kind,
      relocating,
      renovationAppliedToHousing,
      changes,
    };
  }
"""
templates = replace_once(templates, old_early, new_early, 'renovation housing handling')
templates = replace_once(
    templates,
    "    kind,\n    relocating,\n    changes,\n  };\n}\n\n/**\n * Q12/Q5 の住まい設計を Q5 住まい入力へ反映する。",
    "    kind,\n    relocating,\n    renovationAppliedToHousing: false,\n    changes,\n  };\n}\n\n/**\n * Q12 の住まい設計を Q5 住まい入力へ反映する。",
    'normal housing return',
)
templates = replace_once(
    templates,
    " * - リフォームのみ: Q5物件は追加せず、一時金は Q3 側で扱う\n",
    " * - リフォーム: 原則として Q5 の持ち家改良費へ反映\n",
    'housing comment',
)
templates = replace_once(
    templates,
    "  referenceDate: Date;\n}): LifeEventState {\n",
    "  referenceDate: Date;\n  renovationAppliedToHousing?: boolean;\n}): LifeEventState {\n",
    'life event function input',
)
templates = replace_once(
    templates,
    "  // 賃貸・購入は Q5 で本体を持つので、一時金イベントはリフォーム系のみ\n  if (kind === 'rent' || kind === 'purchase' || kind === 'skip') {\n",
    "  // 住まい側に反映できた内容は Q3 に複製しない。旧連動イベントがあれば削除する。\n  if (\n    kind === 'rent' ||\n    kind === 'purchase' ||\n    kind === 'skip' ||\n    input.renovationAppliedToHousing\n  ) {\n",
    'life event clearing rule',
)
templates = replace_once(
    templates,
    "    referenceDate: input.referenceDate,\n  });\n\n  const changes: SecondLifeHousingApplyChange[] = [",
    "    referenceDate: input.referenceDate,\n    renovationAppliedToHousing: housingMutation.renovationAppliedToHousing,\n  });\n\n  const changes: SecondLifeHousingApplyChange[] = [",
    'pass renovation ownership',
)
templates_path.write_text(templates, encoding='utf-8')


# 4) Add a housing-domain change type for generated one-time housing costs.
apply_type_path = Path('src/types/secondLifeHousingApply.ts')
apply_type = apply_type_path.read_text(encoding='utf-8')
apply_type = replace_once(
    apply_type,
    "  | {\n      type: 'life_event';\n",
    "  | {\n      type: 'improvement';\n      propertyId: string;\n      propertyName: string;\n      amountMan: number;\n      year: number;\n      month: number;\n    }\n  | {\n      type: 'life_event';\n",
    'improvement change type',
)
apply_type_path.write_text(apply_type, encoding='utf-8')

summary_path = Path('src/lib/secondLifeHousingApplySummary.ts')
summary = summary_path.read_text(encoding='utf-8')
summary = replace_once(
    summary,
    "      case 'life_event':\n        return `ライフイベント「${change.label}」に${change.amountMan}万円を反映${done}（${change.startAge}歳）`;\n",
    "      case 'improvement':\n        return `「${change.propertyName}」の住まい一時費用${change.amountMan}万円を${change.year}年${change.month}月に追加${done}`;\n      case 'life_event':\n        return `ライフイベント「${change.label}」に${change.amountMan}万円を反映${done}（${change.startAge}歳）`;\n",
    'improvement change formatting',
)
summary = replace_once(
    summary,
    "    case 'renovate':\n      lines.push(\n        '現在の住まいを継続し、リフォーム等の一時費用を計画へ反映します',\n      );\n      break;\n",
    "    case 'renovate':\n      lines.push(\n        state.housingScenario === 'hometown'\n          ? 'セカンドライフ実家を住まいに追加し、リフォーム等の一時費用を物件へ反映します'\n          : '現在の持ち家にリフォーム等の一時費用を反映します',\n      );\n      break;\n",
    'renovation plan wording',
)
summary_path.write_text(summary, encoding='utf-8')
