import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBirthShort, getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import { MemberAvatar } from '../family/MemberAvatar';

interface MemberTabAddInBarProps {
  addableMembers: FamilyMember[];
  onAdd: (memberId: string) => void;
  referenceDate?: Date;
}

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
}

/** タブ列の右端に置く「入力する人を追加」 */
export function MemberTabAddInBar({
  addableMembers,
  onAdd,
  referenceDate,
}: MemberTabAddInBarProps) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!pickerOpen) {
      setMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const minWidth = Math.max(220, Math.ceil(rect.width));
      const maxLeft = window.innerWidth - minWidth - 8;
      const left = Math.max(8, Math.min(rect.right - minWidth, maxLeft));

      const estimatedHeight =
        (menuRef.current?.offsetHeight ??
          Math.min(addableMembers.length, 6) * 56 + 12) + 8;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const top = openUpward
        ? Math.max(8, rect.top - estimatedHeight)
        : rect.bottom + 4;

      setMenuPos({ top, left, minWidth });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [pickerOpen, addableMembers.length]);

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  if (addableMembers.length === 0) return null;

  const menu =
    pickerOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="member-tab-add-menu"
            role="listbox"
            aria-label="追加する家族"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
            }}
          >
            {addableMembers.map((member) => {
              const label = getMemberTabLabel(member);
              return (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  className="member-tab-add-menu-item"
                  onClick={() => {
                    onAdd(member.id);
                    setPickerOpen(false);
                  }}
                >
                  <MemberAvatar
                    role={member.role}
                    gender={member.gender}
                    age={member.age}
                  />
                  <span className="member-tab-add-menu-text">
                    <span className="member-tab-add-menu-name">{label}</span>
                    {referenceDate ? (
                      <span className="member-tab-add-menu-meta">
                        {formatBirthShort(member, referenceDate)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="member-tab-add-wrap">
      <button
        ref={buttonRef}
        type="button"
        className={`member-tab member-tab--add${pickerOpen ? ' active' : ''}`}
        aria-expanded={pickerOpen}
        aria-haspopup="listbox"
        aria-controls={pickerOpen ? listId : undefined}
        onClick={() => setPickerOpen((open) => !open)}
      >
        <span className="member-tab-add-plus" aria-hidden>
          ＋
        </span>
        <div className="member-tab-info">
          <span className="member-tab-name">入力する人を追加</span>
        </div>
      </button>
      {menu}
    </div>
  );
}

interface MemberPersonTabProps {
  member: FamilyMember;
  active: boolean;
  count: number;
  referenceDate: Date;
  canRemove: boolean;
  onSelect: (memberId: string) => void;
  onRemove?: (memberId: string) => void;
}

export function MemberPersonTab({
  member,
  active,
  count,
  referenceDate,
  canRemove,
  onSelect,
  onRemove,
}: MemberPersonTabProps) {
  const label = getMemberTabLabel(member);

  return (
    <div className={`member-tab ${active ? 'active' : ''}`}>
      <button
        type="button"
        className="member-tab-select"
        onClick={() => onSelect(member.id)}
      >
        <MemberAvatar
          role={member.role}
          gender={member.gender}
          age={member.age}
        />
        <div className="member-tab-info">
          <span className="member-tab-name">
            {label}
            {count > 0 && (
              <span className="member-tab-badge">（{count}件）</span>
            )}
          </span>
          <span className="member-tab-birth">
            {formatBirthShort(member, referenceDate)}
          </span>
        </div>
      </button>
      {canRemove && onRemove ? (
        <button
          type="button"
          className="member-tab-close"
          aria-label={`${label}のタブを外す`}
          title="タブを外す（入力が空のとき）"
          onClick={() => onRemove(member.id)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function MemberTabHouseholdGuidance() {
  return (
    <p className="member-tab-extras-guidance">
      ご家族タブは本宅など世帯の物件をまとめる場所です。家賃やローンの支払い（CF上の出口）は契約者個人に紐づきます。個人名義の物件は「入力する人を追加」で個人タブを出してください。
    </p>
  );
}
