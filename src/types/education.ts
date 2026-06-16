export type SchoolCategory =
  | 'nursery'
  | 'kindergarten'
  | 'elementary'
  | 'junior_high'
  | 'high_school'
  | 'university'
  | 'graduate'
  | 'other';

export type SchoolType =
  | 'public'
  | 'private'
  | 'part_time_public'
  | 'part_time_private'
  | 'correspondence_public'
  | 'correspondence_private'
  | 'technical_college_public'
  | 'technical_college_private'
  | 'junior_college_national'
  | 'junior_college_private'
  | 'national_medical'
  | 'national_other'
  | 'private_liberal_arts'
  | 'private_science'
  | 'private_medical'
  | 'graduate_national_medical'
  | 'graduate_national_other'
  | 'graduate_private_liberal_arts'
  | 'graduate_private_science'
  | 'graduate_private_medical'
  | 'national'
  | 'licensed_childcare'
  | 'unlicensed_childcare';

export type TuitionPaymentCycle = 'monthly' | 'yearly' | 'semiannual';

export type OtherExpensePaymentCycle = 'monthly' | 'yearly';

/** 大学の通学形態 */
export type UniversityHousingType = 'home_commute' | 'dorm_apartment';

/** 大学院の課程種別 */
export type GraduateProgramType = 'masters' | 'doctoral' | 'working_adult';

export interface EducationOtherExpense {
  id: string;
  /** 費用の内容（保育材料費など） */
  label: string;
  /** 在籍期間内の何年目か（1始まり）。0は毎年 */
  enrollmentYear: number;
  paymentCycle: OtherExpensePaymentCycle;
  amount: number;
}

export interface EducationExpenseEntry {
  id: string;
  schoolCategory: SchoolCategory;
  schoolType: SchoolType;
  /** 大学・大学院の通学形態（大学・大学院以外は未使用） */
  universityHousingType?: UniversityHousingType;
  /** 大学院の課程種別（大学院以外は未使用） */
  graduateProgramType?: GraduateProgramType;
  schoolName: string;
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
  entranceFee: number;
  tuitionAnnual: number;
  tuitionPaymentCycle: TuitionPaymentCycle;
  otherExpenses: EducationOtherExpense[];
}

export type EducationByMember = Record<string, EducationExpenseEntry[]>;

export interface EducationReferenceKeyValue {
  label: string;
  value: string;
}

export interface EducationReferenceTableRow {
  cells: string[];
  highlight?: boolean;
}

export interface EducationReferenceTable {
  caption?: string;
  columns: string[];
  rows: EducationReferenceTableRow[];
}

export interface EducationReferenceSection {
  title: string;
  description?: string;
  keyValues?: EducationReferenceKeyValue[];
  table?: EducationReferenceTable;
}

export interface EducationReferenceSource {
  label: string;
  detail?: string;
}

export interface EducationReferenceDetail {
  title: string;
  summary: string;
  sections: EducationReferenceSection[];
  sources: EducationReferenceSource[];
}

export interface FetchedEducationCosts {
  entranceFee: number;
  tuitionAnnual: number;
  tuitionPaymentCycle: TuitionPaymentCycle;
  otherExpenses: Omit<EducationOtherExpense, 'id'>[];
  sourceNote: string;
  referenceDetail: EducationReferenceDetail;
}
