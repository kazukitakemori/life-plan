import { useMemo, useState } from 'react';

import {

  createEducationExpenseEntry,

  createStandardChildEducationPath,

} from '../../lib/educationDefaults';

import {

  getEducationDefaultActiveMemberId,

  getIncomeEligibleMembers,

  getMemberTabLabel,

} from '../../lib/memberDisplay';

import type { FamilyMember } from '../../types/family';

import type { EducationByMember } from '../../types/education';

import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';

import type { TaxSocialState } from '../../types/taxSocial';

import { EducationExpenseChart } from './EducationExpenseChart';

import { EducationExpenseTable } from './EducationExpenseTable';

import {

  EDUCATION_AGGREGATE_TAB_ID,

  MemberEducationTabs,

} from './MemberEducationTabs';



interface EducationStepProps {

  members: FamilyMember[];

  educationByMember: EducationByMember;

  incomeByMember: IncomeByMember;

  priorYearIncomeByMember: PriorYearIncomeByMember;

  taxSocialState: TaxSocialState;

  referenceDate: Date;

  onChange: (state: EducationByMember) => void;

}



export function EducationStep({

  members,

  educationByMember,

  incomeByMember,

  priorYearIncomeByMember,

  taxSocialState,

  referenceDate,

  onChange,

}: EducationStepProps) {

  const eligibleMembers = useMemo(

    () => getIncomeEligibleMembers(members),

    [members],

  );

  const headMember = members.find((m) => m.role === 'head');

  const defaultActiveId = useMemo(

    () => getEducationDefaultActiveMemberId(members),

    [members],

  );



  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);

  const [copySourceId, setCopySourceId] = useState(

    headMember?.id ?? eligibleMembers[0]?.id ?? '',

  );



  const isAggregateTab = activeMemberId === EDUCATION_AGGREGATE_TAB_ID;

  const resolvedActiveId = isAggregateTab

    ? EDUCATION_AGGREGATE_TAB_ID

    : eligibleMembers.some((m) => m.id === activeMemberId)

      ? activeMemberId

      : defaultActiveId;



  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);

  const entries = activeMember

    ? (educationByMember[activeMember.id] ?? [])

    : [];



  const entryCounts = useMemo(() => {

    const counts: Record<string, number> = {};

    for (const member of eligibleMembers) {

      counts[member.id] = educationByMember[member.id]?.length ?? 0;

    }

    return counts;

  }, [eligibleMembers, educationByMember]);



  const totalEntryCount = useMemo(

    () => Object.values(entryCounts).reduce((sum, count) => sum + count, 0),

    [entryCounts],

  );



  const copySourceOptions = useMemo(

    () =>

      eligibleMembers.map((member) => ({

        id: member.id,

        label: getMemberTabLabel(member),

      })),

    [eligibleMembers],

  );



  const persistEntries = (memberId: string, updated: typeof entries) => {

    onChange({

      ...educationByMember,

      [memberId]: updated,

    });

  };



  const addEntry = () => {

    if (!activeMember) return;

    const last = entries[entries.length - 1];

    const nextEntry = last

      ? createEducationExpenseEntry({

          schoolCategory: last.schoolCategory,

          schoolType: last.schoolType,

          universityHousingType: last.universityHousingType,

          graduateProgramType: last.graduateProgramType,

          startAge: last.endAge,

          startMonth: last.endMonth === 12 ? 1 : last.endMonth + 1,

          endAge: Math.min(last.endAge + 3, activeMember.expectedLifespan),

          endMonth: last.endMonth,

        })

      : activeMember.role === 'child'

        ? createStandardChildEducationPath()[0]

        : createEducationExpenseEntry();

    persistEntries(resolvedActiveId, [...entries, nextEntry]);

  };



  const copySettingsFrom = () => {

    const source = educationByMember[copySourceId] ?? [];

    if (source.length === 0 || copySourceId === resolvedActiveId) return;



    const cloned = source.map((entry) => ({

      ...entry,

      id: crypto.randomUUID(),

      otherExpenses: entry.otherExpenses.map((item) => ({

        ...item,

        id: crypto.randomUUID(),

      })),

    }));

    persistEntries(resolvedActiveId, cloned);

  };



  if (!headMember) {

    return (

      <div className="step-page">

        <p className="placeholder-message">

          ご家族（Q1）で世帯主を登録してください。

        </p>

      </div>

    );

  }



  return (

    <div className="step-page education-step">

      <div className="step-header">

        <div>

          <h2 className="step-title">Q2. 教育費</h2>

        </div>

        <div className="step-header-right">

          <button type="button" className="step-action-btn" disabled>

            解説

          </button>

          <button type="button" className="step-action-btn" disabled>

            ガイド

          </button>

          <button type="button" className="step-action-btn" disabled>

            参考リンク

          </button>

          <button type="button" className="step-action-btn" disabled>

            メモ

          </button>

          <button type="button" className="show-all-btn" disabled>

            全員まとめて表示

          </button>

        </div>

      </div>



      <div className="education-toolbar">

        <MemberEducationTabs

          members={eligibleMembers}

          activeMemberId={resolvedActiveId}

          entryCounts={entryCounts}

          totalEntryCount={totalEntryCount}

          referenceDate={referenceDate}

          onSelect={setActiveMemberId}

        />



        {!isAggregateTab && activeMember && (

          <div className="education-copy-bar">

            <select

              className="select-input"

              value={copySourceId}

              onChange={(e) => setCopySourceId(e.target.value)}

            >

              {copySourceOptions.map((opt) => (

                <option key={opt.id} value={opt.id}>

                  {opt.label}

                </option>

              ))}

            </select>

            <button

              type="button"

              className="education-copy-btn"

              onClick={copySettingsFrom}

              disabled={

                copySourceId === resolvedActiveId ||

                (educationByMember[copySourceId]?.length ?? 0) === 0

              }

            >

              設定をコピー

            </button>

          </div>

        )}

      </div>



      {isAggregateTab ? (

        <p className="education-aggregate-note">

          世帯全体の教育費を合算したグラフです。メンバーごとの入力は各タブで行ってください。

        </p>

      ) : (

        activeMember && (

          <>

            <EducationExpenseTable

              entries={entries}

              member={activeMember}

              headMember={headMember}

              familyMembers={members}

              incomeByMember={incomeByMember}

              priorYearIncomeByMember={priorYearIncomeByMember}

              taxSocialState={taxSocialState}

              referenceDate={referenceDate}

              onChange={(updated) => persistEntries(resolvedActiveId, updated)}

            />



            <div className="education-footer-actions">

              <button

                type="button"

                className="footer-action-btn"

                onClick={addEntry}

              >

                ＋ 教育費を追加

              </button>

            </div>

          </>

        )

      )}



      {isAggregateTab ? (

        <EducationExpenseChart

          mode="aggregate"

          headMember={headMember}

          familyMembers={members}

          eligibleMembers={eligibleMembers}

          educationByMember={educationByMember}

          referenceDate={referenceDate}

        />

      ) : (

        activeMember && (

          <EducationExpenseChart

            member={activeMember}

            headMember={headMember}

            familyMembers={members}

            entries={entries}

            referenceDate={referenceDate}

          />

        )

      )}

    </div>

  );

}


