/** 三大疾病プリセットのカテゴリ */
export type MedicalDiseaseCategory =
  | 'average'
  | 'cancer'
  | 'heartAttack'
  | 'stroke';

export const MEDICAL_DISEASE_CATEGORY_LABELS: Record<
  MedicalDiseaseCategory,
  string
> = {
  average: '平均（傷病全体）',
  cancer: 'がん',
  heartAttack: '心疾患',
  stroke: '脳血管疾患',
};

export const MEDICAL_DISEASE_CATEGORY_ORDER: MedicalDiseaseCategory[] = [
  'average',
  'cancer',
  'heartAttack',
  'stroke',
];

export interface MedicalReferenceLink {
  label: string;
  url: string;
}

export interface MedicalPresetFieldSource {
  /** UI表示用の短い説明 */
  summary: string;
  links: MedicalReferenceLink[];
}

/** 厚生労働省「令和5年患者調査」（退院患者平均在院日数） */
export const MEDICAL_PATIENT_SURVEY_LINKS: MedicalReferenceLink[] = [
  {
    label: '厚生労働省 患者調査（一覧）',
    url: 'https://www.mhlw.go.jp/toukei/list/10-20.html',
  },
  {
    label: '令和5年患者調査 概況（PDF）',
    url: 'https://www.mhlw.go.jp/toukei/saikin/hw/kanja/23/dl/kanjya.pdf',
  },
  {
    label: 'e-Stat 令和5年患者調査',
    url: 'https://www.e-stat.go.jp/stat-search/database?toukei=00450022',
  },
  {
    label: '生命保険文化センター（傷病別平均在院日数の要約）',
    url: 'https://www.jili.or.jp/lifeplan/lifesecurity/1212.html',
  },
];

/** 治療期間の目安（診療ガイドライン等） */
export const MEDICAL_TREATMENT_GUIDELINE_LINKS: MedicalReferenceLink[] = [
  {
    label: '大腸癌診療ガイドライン（日本癌治療学会）',
    url: 'https://www.jsco-cpg.jp/colorectal-cancer/guideline/',
  },
  {
    label: '大腸癌研究会 診療ガイドライン',
    url: 'https://www.jsccr.jp/guideline/2024/cq.html',
  },
  {
    label: '肺癌診療ガイドライン2023年版',
    url: 'https://www.haigan.gr.jp/publication/guideline/examination/2023/1/2/230102040100.html',
  },
];

/** 疾患プリセット全体の ? ポップアップ用 */
export const MEDICAL_DISEASE_PRESET_HELP = {
  title: '疾患プリセットの参考値について',
  body: `入院日数は、厚生労働省「令和5年患者調査」（令和5年9月1〜30日に退院した患者）の退院患者平均在院日数を基本としています。平均（傷病全体）の28.4日は、同調査の傷病別・総数の値です。

治療月数について、「高額療養費が発生する月数」の公的統計はありません。一方で、がんの術後補助化学療法が約6か月など、治療そのものの標準期間は診療ガイドライン等に記載があります。この試算の治療月数は、そうした治療期間の目安と、入院・通院を含む最悪寄りシナリオから設定した参考値です。

統計に該当項目がない疾患や、軽症・重症の想定シナリオは、試算用の参考値として設定しています。参照リンクは下にあります。`,
  inpatientLinks: MEDICAL_PATIENT_SURVEY_LINKS,
  treatmentLinks: MEDICAL_TREATMENT_GUIDELINE_LINKS,
};

function patientSurveyInpatientSource(
  summary: string,
  extraLinks: MedicalReferenceLink[] = [],
): MedicalPresetFieldSource {
  return {
    summary,
    links: [...MEDICAL_PATIENT_SURVEY_LINKS, ...extraLinks],
  };
}

/** 疾患プリセット1件 */
export interface MedicalDiseasePreset {
  key: string;
  label: string;
  category: MedicalDiseaseCategory;
  /** 平均入院日数（日） */
  inpatientDays: number;
  /** 治療月数（高額療養費が発生する月数）の目安 */
  treatmentMonthsPerYear: number;
  /** 備考 */
  note: string;
  /** 入院日数の根拠 */
  inpatientDaysSource?: MedicalPresetFieldSource;
  /** 治療月数の根拠 */
  treatmentMonthsSource?: MedicalPresetFieldSource;
}

const CANCER_ADJUVANT_6M_SOURCE: MedicalPresetFieldSource = {
  summary:
    '大腸がんなどの術後補助化学療法は、ガイドライン上6か月投与が原則（試算では通院期間の目安）。',
  links: MEDICAL_TREATMENT_GUIDELINE_LINKS,
};

const DESIGN_ESTIMATE_TREATMENT_SOURCE: MedicalPresetFieldSource = {
  summary:
    '患者調査に「高額療養費が発生する月数」の統計がないため、入院日数と一般的な治療経過から設定した試算用の目安。',
  links: [],
};

/**
 * 三大疾病・平均の疾患プリセット。
 * 入院日数は厚生労働省「令和5年患者調査」の退院患者平均在院日数。
 * 治療月数は試算用（高額療養費発生月数の統計は患者調査にない）。
 */
export const MEDICAL_DISEASE_PRESETS: MedicalDiseasePreset[] = [
  {
    key: 'average_all',
    label: '平均（傷病全体）',
    category: 'average',
    inpatientDays: 28,
    treatmentMonthsPerYear: 6,
    note: '退院患者の平均在院日数は28.4日。精神・認知症など長期入院も含むため、三大疾病だけより長め。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・退院患者平均在院日数（傷病別・総数）28.4日。',
    ),
    treatmentMonthsSource: {
      summary:
        '患者調査に「高額療養費が発生する月数」の統計がないため、三大疾病を含む傷病全体の試算用目安（6か月）。',
      links: [],
    },
  },
  {
    key: 'cancer_stomach',
    label: '胃がん',
    category: 'cancer',
    inpatientDays: 15,
    treatmentMonthsPerYear: 6,
    note: '手術＋術後外来化学療法が主流。再発・転移例では治療が長期化。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・胃の悪性新生物 14.7日。',
    ),
    treatmentMonthsSource: CANCER_ADJUVANT_6M_SOURCE,
  },
  {
    key: 'cancer_colon',
    label: '大腸がん',
    category: 'cancer',
    inpatientDays: 15,
    treatmentMonthsPerYear: 6,
    note: '手術が主体。術後補助化学療法は約6か月。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・結腸及び直腸の悪性新生物 15.3日。',
    ),
    treatmentMonthsSource: CANCER_ADJUVANT_6M_SOURCE,
  },
  {
    key: 'cancer_liver',
    label: '肝がん',
    category: 'cancer',
    inpatientDays: 14,
    treatmentMonthsPerYear: 6,
    note: '手術・アブレーション・化学療法など。外来治療が続く場合も多い。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・肝及び肝内胆管の悪性新生物 13.6日。',
    ),
    treatmentMonthsSource: DESIGN_ESTIMATE_TREATMENT_SOURCE,
  },
  {
    key: 'cancer_lung',
    label: '肺がん',
    category: 'cancer',
    inpatientDays: 14,
    treatmentMonthsPerYear: 8,
    note: '手術＋術後薬物療法。外来での薬物療法が長期化する傾向。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・気管・気管支及び肺の悪性新生物 14.1日。',
    ),
    treatmentMonthsSource: {
      summary:
        '入院日数に加え、術後薬物療法・外来治療の長期化を見込んだ試算用目安（8か月）。',
      links: MEDICAL_TREATMENT_GUIDELINE_LINKS,
    },
  },
  {
    key: 'cancer_esophagus',
    label: '食道がん',
    category: 'cancer',
    inpatientDays: 28,
    treatmentMonthsPerYear: 9,
    note: '開胸手術は侵襲が大きく入院が長い傾向。患者調査に食道がん単独の項目はないため参考値。',
    inpatientDaysSource: {
      summary:
        '患者調査に食道がん単独の項目はないため、開胸手術を想定した試算用参考値（28日）。',
      links: MEDICAL_PATIENT_SURVEY_LINKS,
    },
    treatmentMonthsSource: DESIGN_ESTIMATE_TREATMENT_SOURCE,
  },
  {
    key: 'cancer_breast',
    label: '乳がん',
    category: 'cancer',
    inpatientDays: 10,
    treatmentMonthsPerYear: 6,
    note: '手術後は抗がん剤・ホルモン療法を外来で継続。入院日数は調査値9.4日を参考に四捨五入。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・乳房の悪性新生物 9.4日（試算では10日に四捨五入）。',
    ),
    treatmentMonthsSource: CANCER_ADJUVANT_6M_SOURCE,
  },
  {
    key: 'cancer_blood',
    label: '血液がん（白血病・悪性リンパ腫）',
    category: 'cancer',
    inpatientDays: 60,
    treatmentMonthsPerYear: 12,
    note: '入院化学療法が長期に及ぶ想定。中分類「血液及び造血器…」の平均在院日数は18.1日だが、白血病等は個別統計がないため参考値。',
    inpatientDaysSource: {
      summary:
        '中分類「血液及び造血器の疾患…」の平均在院日数は18.1日。白血病等の個別項目はなく、長期入院化学療法を想定した試算用参考値（60日）。',
      links: MEDICAL_PATIENT_SURVEY_LINKS,
    },
    treatmentMonthsSource: DESIGN_ESTIMATE_TREATMENT_SOURCE,
  },
  {
    key: 'heart_disease',
    label: '心疾患（心筋梗塞・狭心症など）',
    category: 'heartAttack',
    inpatientDays: 18,
    treatmentMonthsPerYear: 3,
    note: 'カテーテル治療後はリハビリ入院。退院後は外来での薬物療法・心臓リハビリを継続。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・心疾患（高血圧性を除く）18.3日。',
    ),
    treatmentMonthsSource: {
      summary:
        '患者調査に「高額療養費が発生する月数」の統計がないため、急性期入院＋外来フォローの試算用目安（3か月）。',
      links: [],
    },
  },
  {
    key: 'stroke_cerebrovascular',
    label: '脳血管疾患（脳卒中）',
    category: 'stroke',
    inpatientDays: 69,
    treatmentMonthsPerYear: 9,
    note: '急性期＋回復期リハビリを含む平均。重症度により入院は大きく変わる。',
    inpatientDaysSource: patientSurveyInpatientSource(
      '令和5年患者調査・脳血管疾患 68.9日。',
    ),
    treatmentMonthsSource: {
      summary:
        '患者調査に「高額療養費が発生する月数」の統計がないため、急性期＋回復期リハビリを含めた試算用目安（9か月）。',
      links: [],
    },
  },
  {
    key: 'stroke_mild',
    label: '脳卒中（軽症想定）',
    category: 'stroke',
    inpatientDays: 30,
    treatmentMonthsPerYear: 6,
    note: '平均より短い想定。急性期後に短期リハビリで退院するケース。',
    inpatientDaysSource: {
      summary:
        '脳血管疾患の調査平均68.9日より短い軽症シナリオの試算用参考値（30日）。',
      links: MEDICAL_PATIENT_SURVEY_LINKS,
    },
    treatmentMonthsSource: DESIGN_ESTIMATE_TREATMENT_SOURCE,
  },
  {
    key: 'stroke_severe',
    label: '脳卒中（重症想定）',
    category: 'stroke',
    inpatientDays: 120,
    treatmentMonthsPerYear: 12,
    note: '平均より長い想定。重篤な後遺症で回復期・生活期が長期化するケース。',
    inpatientDaysSource: {
      summary:
        '脳血管疾患の調査平均68.9日より長い重症シナリオの試算用参考値（120日）。',
      links: MEDICAL_PATIENT_SURVEY_LINKS,
    },
    treatmentMonthsSource: DESIGN_ESTIMATE_TREATMENT_SOURCE,
  },
];

export function getMedicalDiseasePresetByKey(
  key: string,
): MedicalDiseasePreset | undefined {
  return MEDICAL_DISEASE_PRESETS.find((p) => p.key === key);
}

export function getMedicalDiseasePresetsByCategory(
  category: MedicalDiseaseCategory,
): MedicalDiseasePreset[] {
  return MEDICAL_DISEASE_PRESETS.filter((p) => p.category === category);
}

/** 入院日数を月数相当に換算（30日＝1か月） */
export function inpatientDaysToMonths(days: number): number {
  return Math.max(0, days) / 30;
}
