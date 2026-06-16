import type { FamilyMemberRole } from '../../types/family';

const AVATARS: Record<FamilyMemberRole, string> = {
  head: '👨',
  spouse: '👩',
  child: '👶',
  other: '👤',
  pet: '🐾',
};

interface MemberAvatarProps {
  role: FamilyMemberRole;
}

export function MemberAvatar({ role }: MemberAvatarProps) {
  return (
    <div className="member-avatar" aria-hidden>
      {AVATARS[role]}
    </div>
  );
}
