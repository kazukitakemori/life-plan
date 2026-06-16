import { useMemo, useState } from 'react';
import {
  createLifeEventEntryFromPreset,
} from '../../lib/lifeEventDefaults';
import {
  getIncomeEligibleMembers,
  getMemberTabLabel,
} from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type { LifeEventPresetId, LifeEventState } from '../../types/lifeEvent';
import { AddLifeEventCards } from './AddLifeEventCards';
import { LifeEventTable } from './LifeEventTable';
import { MemberLifeEventTabs } from './MemberLifeEventTabs';

interface LifeEventStepProps {
  members: FamilyMember[];
  lifeEventState: LifeEventState;
  referenceDate: Date;
  onChange: (state: LifeEventState) => void;
}

export function LifeEventStep({
  members,
  lifeEventState,
  referenceDate,
  onChange,
}: LifeEventStepProps) {
  const eligibleMembers = useMemo(
    () => getIncomeEligibleMembers(members),
    [members],
  );
  const headMember = members.find((m) => m.role === 'head');
  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';

  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);
  const [copySourceId, setCopySourceId] = useState(
    headMember?.id ?? eligibleMembers[0]?.id ?? '',
  );

  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)
    ? activeMemberId
    : defaultActiveId;

  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);
  const entries = activeMember
    ? (lifeEventState.byMember[activeMember.id] ?? [])
    : [];

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of eligibleMembers) {
      counts[member.id] = lifeEventState.byMember[member.id]?.length ?? 0;
    }
    return counts;
  }, [eligibleMembers, lifeEventState.byMember]);

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
      ...lifeEventState,
      byMember: { ...lifeEventState.byMember, [memberId]: updated },
    });
  };

  const addEntryFromPreset = (presetId: LifeEventPresetId) => {
    if (!activeMember) return;
    const refMonth = referenceDate.getMonth() + 1;
    const nextEntry = createLifeEventEntryFromPreset(
      presetId,
      activeMember,
      refMonth,
      members,
    );
    persistEntries(resolvedActiveId, [...entries, nextEntry]);
  };

  const copySettingsFrom = () => {
    const source = lifeEventState.byMember[copySourceId] ?? [];
    if (source.length === 0 || copySourceId === resolvedActiveId) return;

    const cloned = source.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      celebrationBeneficiaries: entry.celebrationBeneficiaries?.map(
        (beneficiary) => ({ ...beneficiary }),
      ),
    }));
    persistEntries(resolvedActiveId, cloned);
  };

  const setInflationRate = (inflationRate: number) => {
    onChange({ ...lifeEventState, inflationRate });
  };

  if (!headMember || !activeMember) {
    return (
      <div className="step-page">
        <p className="placeholder-message">
          ご家族（Q1）で世帯主を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="step-page life-event-step">
      <div className="step-header">
        <div>
          <h2 className="step-title">
            Q3. ライフイベント
            <span className="step-subtitle">
              結婚・夢・医療・介護など
            </span>
          </h2>
          <div className="life-event-inflation-field">
            <span className="life-event-inflation-label">※ 物価上昇率</span>
            <input
              type="number"
              className="life-event-inflation-input"
              value={lifeEventState.inflationRate}
              min={0}
              max={100}
              step={0.1}
              onChange={(e) => setInflationRate(Number(e.target.value) || 0)}
            />
            <span className="life-event-inflation-unit">%/年</span>
            <span
              className="life-event-help-icon"
              title="ライフイベント全体の物価上昇率"
            >
              ?
            </span>
          </div>
        </div>
        <div className="step-header-right">
          <button type="button" className="step-action-btn" disabled>
            解説
          </button>
          <button type="button" className="step-action-btn" disabled>
            ガイド
          </button>
          <button type="button" className="step-action-btn" disabled>
            メモ
          </button>
        </div>
      </div>

      <div className="life-event-toolbar">
        <MemberLifeEventTabs
          members={eligibleMembers}
          activeMemberId={resolvedActiveId}
          entryCounts={entryCounts}
          referenceDate={referenceDate}
          onSelect={setActiveMemberId}
        />

        <div className="life-event-copy-bar">
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
          <span className="life-event-copy-from">から</span>
          <button
            type="button"
            className="life-event-copy-btn"
            onClick={copySettingsFrom}
            disabled={
              copySourceId === resolvedActiveId ||
              (lifeEventState.byMember[copySourceId]?.length ?? 0) === 0
            }
          >
            設定をコピー
          </button>
        </div>
      </div>

      <LifeEventTable
        entries={entries}
        member={activeMember}
        familyMembers={members}
        referenceDate={referenceDate}
        onChange={(updated) => persistEntries(resolvedActiveId, updated)}
      />

      <AddLifeEventCards activeMember={activeMember} onAdd={addEntryFromPreset} />
    </div>
  );
}
