import type { FamilyMemberRole, Gender } from '../../types/family';
import {
  memberAvatarEmoji,
  resolveMemberAvatarSrc,
} from '../../lib/memberAvatar';

interface MemberAvatarProps {
  role: FamilyMemberRole;
  gender?: Gender | null;
  age?: number | null;
}

export function MemberAvatar({
  role,
  gender,
  age = null,
}: MemberAvatarProps) {
  const src = resolveMemberAvatarSrc(role, gender, age);

  return (
    <div className="member-avatar" aria-hidden>
      {src ? (
        <img
          className="member-avatar-img"
          src={src}
          alt=""
          draggable={false}
        />
      ) : (
        memberAvatarEmoji(role)
      )}
    </div>
  );
}
