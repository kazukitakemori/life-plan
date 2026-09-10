import { useMemo } from 'react';
import type { FamilyMember } from '../types/family';
import type {
  MemberTabDomain,
  MemberTabExtras,
} from '../types/memberTabVisibility';
import {
  addMemberTabExtra,
  canRemoveMemberTab,
  listAddableTabMembers,
  removeMemberTabExtra,
  resolveVisibleTabMembers,
} from './memberTabVisibility';

export function useMemberTabDomain(params: {
  domain: MemberTabDomain;
  members: FamilyMember[];
  memberTabExtras: MemberTabExtras;
  onMemberTabExtrasChange: (extras: MemberTabExtras) => void;
  memberHasData: (memberId: string) => boolean;
  /** 外したあとに戻すアクティブID（ご家族キーや世帯主など） */
  fallbackActiveId: string;
  activeId: string;
  setActiveId: (id: string) => void;
}) {
  const {
    domain,
    members,
    memberTabExtras,
    onMemberTabExtrasChange,
    memberHasData,
    fallbackActiveId,
    activeId,
    setActiveId,
  } = params;

  const visibleMembers = useMemo(
    () =>
      resolveVisibleTabMembers({
        domain,
        members,
        extras: memberTabExtras,
        memberHasData,
      }),
    [domain, members, memberTabExtras, memberHasData],
  );

  const addableMembers = useMemo(
    () =>
      listAddableTabMembers({
        domain,
        members,
        extras: memberTabExtras,
        memberHasData,
      }),
    [domain, members, memberTabExtras, memberHasData],
  );

  const removableMemberIds = useMemo(
    () =>
      visibleMembers
        .filter((member) =>
          canRemoveMemberTab({
            domain,
            member,
            extras: memberTabExtras,
            memberHasData,
          }),
        )
        .map((member) => member.id),
    [visibleMembers, domain, memberTabExtras, memberHasData],
  );

  const handleAddMemberTab = (memberId: string) => {
    onMemberTabExtrasChange(
      addMemberTabExtra(memberTabExtras, domain, memberId),
    );
    setActiveId(memberId);
  };

  const handleRemoveMemberTab = (memberId: string) => {
    onMemberTabExtrasChange(
      removeMemberTabExtra(memberTabExtras, domain, memberId),
    );
    if (activeId === memberId) {
      setActiveId(fallbackActiveId);
    }
  };

  return {
    visibleMembers,
    addableMembers,
    removableMemberIds,
    handleAddMemberTab,
    handleRemoveMemberTab,
  };
}
