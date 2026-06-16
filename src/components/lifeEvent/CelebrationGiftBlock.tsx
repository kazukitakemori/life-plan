import { getCelebrationGiftAgeOptions } from '../../lib/lifeEventDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import type { FamilyMember } from '../../types/family';
import type {
  LifeEventCelebrationBeneficiary,
  LifeEventEntry,
} from '../../types/lifeEvent';

interface CelebrationGiftBlockProps {
  entry: LifeEventEntry;
  familyMembers: FamilyMember[];
  onChange: (entry: LifeEventEntry) => void;
  onRemove: () => void;
}

const AGE_OPTIONS = getCelebrationGiftAgeOptions();

export function CelebrationGiftBlock({
  entry,
  familyMembers,
  onChange,
  onRemove,
}: CelebrationGiftBlockProps) {
  const beneficiaries = entry.celebrationBeneficiaries ?? [];

  const updateBeneficiary = (
    memberId: string,
    patch: Partial<LifeEventCelebrationBeneficiary>,
  ) => {
    onChange({
      ...entry,
      celebrationBeneficiaries: beneficiaries.map((beneficiary) =>
        beneficiary.memberId === memberId
          ? { ...beneficiary, ...patch }
          : beneficiary,
      ),
    });
  };

  return (
    <div className="celebration-gift-block">
      <div className="celebration-gift-block-header">
        <h3 className="celebration-gift-block-title">子・孫の祝い金</h3>
        <button
          type="button"
          className="life-event-row-remove"
          onClick={onRemove}
          aria-label="削除"
        >
          −
        </button>
      </div>

      {beneficiaries.length === 0 ? (
        <p className="celebration-gift-empty">
          Q1で子ども・孫を登録すると、ここに名前が表示されます。
        </p>
      ) : (
        <div className="celebration-gift-table">
          <div className="celebration-gift-table-header">
            <div className="celebration-gift-header-cell celebration-gift-col-name">
              名前
            </div>
            <div className="celebration-gift-header-cell celebration-gift-col-age">
              適齢期
            </div>
            <div className="celebration-gift-header-cell celebration-gift-col-amount">
              援助金
            </div>
          </div>

          <div className="celebration-gift-table-body">
            {beneficiaries.map((beneficiary) => {
              const child = familyMembers.find(
                (m) => m.id === beneficiary.memberId,
              );
              if (!child) return null;

              return (
                <div
                  key={beneficiary.memberId}
                  className="celebration-gift-table-row"
                >
                  <div className="celebration-gift-table-cell celebration-gift-col-name">
                    {getMemberTabLabel(child)}
                  </div>
                  <div className="celebration-gift-table-cell celebration-gift-col-age">
                    <select
                      className="select-input celebration-gift-select"
                      value={beneficiary.targetAge}
                      onChange={(e) =>
                        updateBeneficiary(beneficiary.memberId, {
                          targetAge: Number(e.target.value),
                        })
                      }
                    >
                      {AGE_OPTIONS.map((age) => (
                        <option key={age} value={age}>
                          {age}才
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="celebration-gift-table-cell celebration-gift-col-amount">
                    <div className="celebration-gift-amount-field">
                      <input
                        type="number"
                        className="amount-input celebration-gift-amount-input"
                        value={beneficiary.amountMan}
                        min={0}
                        step={0.1}
                        onChange={(e) =>
                          updateBeneficiary(beneficiary.memberId, {
                            amountMan: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="amount-unit">万円</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
