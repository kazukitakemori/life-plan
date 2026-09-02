import { useMemo, useState } from 'react';

import { getIncomeEligibleMembers } from '../../lib/memberDisplay';

import {
  addHousingLoanWithStructure,
  createLoanEntry,
  findLoanEntryBucket,
  getLoanEntryCounts,
  getMemberLoanEntries,
  updateLoanByMember,
} from '../../lib/loanDefaults';

import { getLinkedHousingProperty, getLinkedVehicle, updatePairLoanShare, updateJointDebtDeductionShare, syncPairLoanFeeInclusionInState } from '../../lib/loanResolution';

import type { FamilyMember } from '../../types/family';

import type { HousingState, OwnedProperty } from '../../types/housing';

import type { LoanCategory, LoanEntry, LoanState, LoanStructureType } from '../../types/loan';

import type { VehicleEntry, VehicleState } from '../../types/vehicle';

import { MemberIncomeTabs } from '../income/MemberIncomeTabs';

import { AddLoanCards } from './AddLoanCards';

import { LoanEntryCard } from './LoanEntryCard';



interface LoanStepProps {

  members: FamilyMember[];

  housingState: HousingState;

  vehicleState: VehicleState;

  loanState: LoanState;

  referenceDate: Date;

  onChange: (state: LoanState) => void;

  onHousingChange: (state: HousingState) => void;

}



function findHousingPropertyName(

  housingState: HousingState,

  entry: LoanEntry,

): string | undefined {

  if (!entry.housingLink) return undefined;

  const data = housingState.byTarget[entry.housingLink.targetId];

  const property = data?.owned.find((p) => p.id === entry.housingLink?.propertyId);

  return property?.name;

}



function findVehicleName(

  vehicleState: VehicleState,

  entry: LoanEntry,

): string | undefined {

  if (!entry.vehicleLink) return undefined;

  return vehicleState.byMember[entry.vehicleLink.memberId]?.find(
    (vehicle) => vehicle.id === entry.vehicleLink?.vehicleId,
  )?.label;

}



export function LoanStep({

  members,

  housingState,

  vehicleState,

  loanState,

  referenceDate,

  onChange,

  onHousingChange,

}: LoanStepProps) {

  const eligibleMembers = useMemo(

    () => getIncomeEligibleMembers(members),

    [members],

  );



  const headMember = members.find((m) => m.role === 'head');

  const spouseMember = members.find((m) => m.role === 'spouse');

  const defaultActiveId = headMember?.id ?? eligibleMembers[0]?.id ?? '';



  const [activeMemberId, setActiveMemberId] = useState(defaultActiveId);



  const resolvedActiveId = eligibleMembers.some((m) => m.id === activeMemberId)

    ? activeMemberId

    : defaultActiveId;



  const activeMember = eligibleMembers.find((m) => m.id === resolvedActiveId);



  const entries = useMemo(() => {

    const memberEntries = getMemberLoanEntries(loanState, resolvedActiveId);

    if (resolvedActiveId === headMember?.id && loanState.byMember.__legacy__) {

      return [...memberEntries, ...loanState.byMember.__legacy__];

    }

    return memberEntries;

  }, [loanState, resolvedActiveId, headMember?.id]);



  const entryCounts = useMemo(

    () => {

      const counts = getLoanEntryCounts(loanState, eligibleMembers.map((m) => m.id));

      if (headMember && loanState.byMember.__legacy__) {

        counts[headMember.id] =

          (counts[headMember.id] ?? 0) + loanState.byMember.__legacy__.length;

      }

      return counts;

    },

    [eligibleMembers, headMember, loanState],

  );



  const housingPropertyNames = useMemo(() => {

    const names: Record<string, string | undefined> = {};

    for (const entry of entries) {

      names[entry.id] = findHousingPropertyName(housingState, entry);

    }

    return names;

  }, [entries, housingState]);



  const vehicleNames = useMemo(() => {

    const names: Record<string, string | undefined> = {};

    for (const entry of entries) {

      names[entry.id] = findVehicleName(vehicleState, entry);

    }

    return names;

  }, [entries, vehicleState]);



  const linkedHousingProperties = useMemo(() => {

    const properties: Record<string, OwnedProperty | undefined> = {};

    for (const entry of entries) {

      properties[entry.id] = getLinkedHousingProperty(housingState, entry);

    }

    return properties;

  }, [entries, housingState]);



  const linkedVehicles = useMemo(() => {

    const vehicles: Record<string, VehicleEntry | undefined> = {};

    for (const entry of entries) {

      vehicles[entry.id] = getLinkedVehicle(vehicleState, entry);

    }

    return vehicles;

  }, [entries, vehicleState]);



  const persistEntries = (memberId: string, updated: LoanEntry[]) => {

    onChange(updateLoanByMember(loanState, memberId, updated));

  };



  const resolveEntryBucket = (entryId: string): string | undefined => {

    const found = findLoanEntryBucket(loanState, entryId);

    return found?.memberId;

  };



  const persistEntryUpdate = (updated: LoanEntry) => {
    const bucketId = resolveEntryBucket(updated.id) ?? resolvedActiveId;
    if (!bucketId) return;
    const bucketEntries = loanState.byMember[bucketId] ?? [];
    let nextState = updateLoanByMember(
      loanState,
      bucketId,
      bucketEntries.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    nextState = syncPairLoanFeeInclusionInState(nextState, updated);
    onChange(nextState);
  };

  const updateEntry = (_id: string, updated: LoanEntry) => {
    persistEntryUpdate(updated);
  };



  const updatePropertyFees = (

    entry: LoanEntry,

    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,

  ) => {

    if (!entry.housingLink) return;

    const { targetId, propertyId } = entry.housingLink;

    const data = housingState.byTarget[targetId];

    if (!data) return;

    onHousingChange({

      ...housingState,

      byTarget: {

        ...housingState.byTarget,

        [targetId]: {

          ...data,

          owned: data.owned.map((property) =>

            property.id === propertyId ? { ...property, ...patch } : property,

          ),

        },

      },

    });

  };



  const removeEntry = (id: string) => {

    const bucketId = resolveEntryBucket(id) ?? resolvedActiveId;

    if (!bucketId) return;

    const bucketEntries = loanState.byMember[bucketId] ?? [];

    persistEntries(

      bucketId,

      bucketEntries.filter((entry) => entry.id !== id),

    );

  };



  const updatePairPartnerEntry = (updated: LoanEntry) => {
    persistEntryUpdate(updated);
  };

  const handlePairShareChange = (entry: LoanEntry, sharePct: number) => {
    onChange(updatePairLoanShare(loanState, entry, sharePct));
  };

  const handleJointDebtShareChange = (entry: LoanEntry, sharePct: number) => {
    onChange(updateJointDebtDeductionShare(loanState, entry, sharePct));
  };

  const addEntry = (category: LoanCategory, structureType?: LoanStructureType) => {

    if (!resolvedActiveId) return;

    if (category === 'housing' && structureType) {

      const ids =

        structureType === 'pair' && spouseMember && headMember

          ? ([headMember.id, spouseMember.id] as [string, string])

          : ([resolvedActiveId] as [string]);

      onChange(addHousingLoanWithStructure(loanState, structureType, ids));

      return;

    }

    const current = getMemberLoanEntries(loanState, resolvedActiveId);

    persistEntries(resolvedActiveId, [...current, createLoanEntry(category)]);

  };



  if (!activeMember) {

    return (

      <div className="step-page">

        <p className="placeholder-message">

          ご家族（Q1）で世帯主を登録してください。

        </p>

      </div>

    );

  }



  return (

    <div className="step-page loan-step">

      <div className="step-header">

        <div>

          <h2 className="step-title">Q9. ローン</h2>

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



      <MemberIncomeTabs

        members={eligibleMembers}

        activeMemberId={resolvedActiveId}

        entryCounts={entryCounts}

        referenceDate={referenceDate}

        onSelect={setActiveMemberId}

      />



      <section className="loan-section">

        <h3 className="loan-section-title">登録済みローン</h3>



        {entries.length > 0 ? (

          <div className="loan-entry-list">

            {entries.map((entry) => (

              <LoanEntryCard
                key={entry.id}
                entry={entry}
                housingPropertyName={housingPropertyNames[entry.id]}
                vehicleName={vehicleNames[entry.id]}
                linkedHousingProperty={linkedHousingProperties[entry.id]}
                linkedVehicle={linkedVehicles[entry.id]}
                referenceDate={referenceDate}
                member={activeMember}
                members={eligibleMembers}
                loanState={loanState}
                onChange={(updated) => updateEntry(entry.id, updated)}
                onPairPartnerChange={updatePairPartnerEntry}
                onPairShareChange={(sharePct) => handlePairShareChange(entry, sharePct)}
                onJointDebtShareChange={(sharePct) =>
                  handleJointDebtShareChange(entry, sharePct)
                }
                onPropertyFeeChange={updatePropertyFees}
                onRemove={() => removeEntry(entry.id)}
              />

            ))}

          </div>

        ) : (

          <div className="loan-empty">

            ローンが登録されていません。下から追加するか、住まい（Q5）・乗り物（Q6）から追加してください。

          </div>

        )}

      </section>



      <AddLoanCards hasSpouse={Boolean(spouseMember)} onAdd={addEntry} />

    </div>

  );

}


