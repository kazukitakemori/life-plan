import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
} from '../types/secondLife';

export interface ThirdLifeCareScenarioInfo {
  id: SecondLifeNursingScenario;
  label: string;
  description: string;
  note?: string;
  referenceLabel: string;
  referenceUrl: string;
}

export const THIRD_LIFE_CARE_SCENARIOS: ThirdLifeCareScenarioInfo[] = [
  {
    id: 'home',
    label: '在宅介護',
    description:
      '自宅で暮らしながら、訪問介護・訪問看護など必要なサービスを組み合わせる想定です。利用するサービス量や自己負担割合で費用が変わります。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
  },
  {
    id: 'day_service',
    label: '在宅＋デイサービス',
    description:
      '自宅での生活を続けながら、通所介護（デイサービス）などを利用する想定です。食事・入浴・機能訓練などを受けられ、家族の介護負担軽減にもつながります。',
    note: '利用できるサービスや自己負担は要介護度などで異なります。',
    referenceLabel: '厚生労働省：通所介護（デイサービス）',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group7.html',
  },
  {
    id: 'special_nursing_home',
    label: '特別養護老人ホーム（特養）',
    description:
      '常時介護が必要な人向けの介護保険施設です。新規入所は原則として要介護3以上で、介護度・居室タイプ・所得区分などにより自己負担が変わります。',
    note: '厚生労働省の計算例では、要介護5・1割負担の場合でも多床室とユニット型個室で月額の目安が異なります。これは一例であり、自動入力には使用しません。',
    referenceLabel: '厚生労働省：介護サービスの利用料',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/commentary/fee.html',
  },
  {
    id: 'paid_care',
    label: '介護付き有料老人ホーム',
    description:
      '特定施設入居者生活介護の指定を受けた有料老人ホームで、ホームが介護保険サービスを包括的に提供するタイプです。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
  },
  {
    id: 'paid_residential',
    label: '住宅型有料老人ホーム',
    description:
      '生活支援付きの住まいで、介護保険サービスが必要な場合は外部の介護事業所と個別に契約して利用するタイプです。',
    note: '介護サービスの利用量によって追加費用が変わりやすい点に注意が必要です。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
  },
  {
    id: 'serviced_elderly',
    label: 'サービス付き高齢者向け住宅（サ高住）',
    description:
      'バリアフリーの高齢者向け住宅で、安否確認と生活相談が必須です。介護・食事・生活支援など、それ以外のサービス内容は住宅ごとに異なります。',
    referenceLabel: '国土交通省：サービス付き高齢者向け住宅',
    referenceUrl: 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000005.html',
  },
  {
    id: 'group_home',
    label: '認知症グループホーム',
    description:
      '認知症の人が少人数で共同生活し、日常生活上の支援や機能訓練などを受ける地域密着型サービスです。',
    note: '要支援2または要介護1〜5など、利用条件があります。食費・居住費などは介護サービス費とは別にかかります。',
    referenceLabel: '厚生労働省：認知症グループホーム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group18.html',
  },
  {
    id: 'other',
    label: 'その他・まだ決めていない',
    description:
      '施設種別をまだ決めていない場合や、上記に当てはまらない介護の形を想定する場合に使います。費用は分かる範囲で入力してください。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
  },
];

export const THIRD_LIFE_CARE_SCENARIO_LABELS = Object.fromEntries(
  THIRD_LIFE_CARE_SCENARIOS.map((scenario) => [scenario.id, scenario.label]),
) as Record<SecondLifeNursingScenario, string>;

export function getThirdLifeCareScenarioInfo(
  scenario: SecondLifeNursingScenario,
): ThirdLifeCareScenarioInfo {
  return (
    THIRD_LIFE_CARE_SCENARIOS.find((item) => item.id === scenario) ??
    THIRD_LIFE_CARE_SCENARIOS[THIRD_LIFE_CARE_SCENARIOS.length - 1]
  );
}

export function getThirdLifeAnnualAdditionalCostMan(
  design: Pick<SecondLifeNursingDesign, 'monthlyCostMan'>,
): number {
  return Math.round(Math.max(0, design.monthlyCostMan) * 12 * 100) / 100;
}

export function getThirdLifeCareStartAge(
  design: Pick<SecondLifeNursingDesign, 'startAge'>,
  expectedLifespan: number,
): number {
  return Math.min(
    Math.max(60, expectedLifespan),
    Math.max(60, Math.round(design.startAge || 60)),
  );
}

export function getThirdLifeCareEndAge(
  design: Pick<
    SecondLifeNursingDesign,
    'startAge' | 'durationMode' | 'durationYears'
  >,
  expectedLifespan: number,
): number {
  const startAge = getThirdLifeCareStartAge(design, expectedLifespan);
  if (design.durationMode === 'lifetime') return Math.max(startAge, expectedLifespan);
  const years = Math.max(1, Math.round(design.durationYears ?? 1));
  return Math.min(Math.max(startAge, expectedLifespan), startAge + years - 1);
}

export function formatThirdLifeCareDuration(
  design: Pick<SecondLifeNursingDesign, 'durationMode' | 'durationYears'>,
): string {
  return design.durationMode === 'lifetime'
    ? '一生涯'
    : `${Math.max(1, Math.round(design.durationYears ?? 1))}年間`;
}
