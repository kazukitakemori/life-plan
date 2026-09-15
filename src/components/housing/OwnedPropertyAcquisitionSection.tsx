import type { OwnedProperty } from '../../types/housing';
import { HousingManInput } from './HousingManInput';
import type {
  AcquisitionFeeBreakdown,
  AcquisitionReferenceSection,
} from './AcquisitionReferenceModal';

interface OwnedPropertyAcquisitionSectionProps {
  sectionNumber: number;
  property: OwnedProperty;
  acquisitionTotal: string;
  showBuildingField: boolean;
  isCurrentlyOccupied: boolean;
  canFetchAcquisitionFees: boolean;
  breakdown: AcquisitionFeeBreakdown | null;
  onChange: (patch: Partial<OwnedProperty>) => void;
  onFetchReference: () => void;
  onOpenReference: (section: AcquisitionReferenceSection) => void;
  onOpenTaxDetail: () => void;
}

export function OwnedPropertyAcquisitionSection({
  sectionNumber,
  property,
  acquisitionTotal,
  showBuildingField,
  isCurrentlyOccupied,
  canFetchAcquisitionFees,
  breakdown,
  onChange,
  onFetchReference,
  onOpenReference,
  onOpenTaxDetail,
}: OwnedPropertyAcquisitionSectionProps) {
  return (
    <section className="housing-owned-detail-section">
      <h4 className="housing-owned-detail-title">({sectionNumber}) 取得価格</h4>

      <div className="housing-owned-acquisition-total">
        <span className="housing-owned-acquisition-total-label">取得価格</span>
        <strong className="housing-owned-acquisition-total-amount">
          {acquisitionTotal}
        </strong>
        <span className="housing-owned-acquisition-note">
          建物 + 土地 + 仲介手数料
        </span>
      </div>

      {isCurrentlyOccupied ? (
        <p className="housing-owned-loan-existing-note">
          居住中でも、当時の取得価格・諸費用を入力してください。ローン借入額はこれらと「諸費用のローン組み込み」から計算します。過去の購入時現金支出はキャッシュフローには含めません。
        </p>
      ) : null}

      <div className="housing-rental-card housing-owned-acquisition-card">
        <div className="housing-rental-card-body">
          <section className="housing-rental-block">
            <h5 className="housing-rental-block-title">物件価格</h5>
            <div className="housing-rental-cost-grid housing-rental-cost-grid--two">
              {showBuildingField ? (
                <label className="housing-rental-field">
                  <span className="housing-rental-field-label">建物</span>
                  <HousingManInput
                    compact
                    value={property.buildingMan}
                    onChange={(buildingMan) => onChange({ buildingMan })}
                  />
                </label>
              ) : null}

              <label className="housing-rental-field">
                <span className="housing-rental-field-label">土地</span>
                <HousingManInput
                  compact
                  value={property.landMan}
                  onChange={(landMan) => onChange({ landMan })}
                />
              </label>
            </div>
          </section>

          <section className="housing-rental-block">
            <h5 className="housing-rental-block-title">取得時の諸費用</h5>
            <p className="housing-linked-overview-note">
              建物・土地の金額をもとに、仲介手数料・登記手数料・不動産取得税の参考額をまとめて計算できます。
            </p>
            <div className="housing-linked-add-area">
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                disabled={!canFetchAcquisitionFees}
                onClick={onFetchReference}
              >
                諸費用の参考額を計算
              </button>
              {!canFetchAcquisitionFees ? (
                <p className="housing-linked-add-note">
                  建物または土地の金額を入力すると計算できます。
                </p>
              ) : (
                <p className="housing-linked-add-note">
                  3項目を参考額で更新します。計算後も手入力で変更できます。
                </p>
              )}
            </div>

            <div className="housing-rental-cost-grid housing-rental-cost-grid--two">
              <div className="housing-rental-field">
                <span className="housing-rental-field-label">仲介手数料</span>
                <HousingManInput
                  compact
                  value={property.brokerageFeeMan}
                  onChange={(brokerageFeeMan) => onChange({ brokerageFeeMan })}
                />
                {breakdown ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost"
                    onClick={() => onOpenReference('brokerage')}
                  >
                    計算根拠を見る
                  </button>
                ) : null}
              </div>

              <div className="housing-rental-field">
                <span className="housing-rental-field-label">登記手数料</span>
                <HousingManInput
                  compact
                  value={property.registrationFeeMan}
                  onChange={(registrationFeeMan) =>
                    onChange({ registrationFeeMan })
                  }
                />
                {breakdown ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost"
                    onClick={() => onOpenReference('registration')}
                  >
                    計算根拠を見る
                  </button>
                ) : null}
              </div>

              <div className="housing-rental-field">
                <span className="housing-rental-field-label">不動産取得税</span>
                <HousingManInput
                  compact
                  value={property.acquisitionTaxMan}
                  onChange={(acquisitionTaxMan) =>
                    onChange({ acquisitionTaxMan })
                  }
                />
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  disabled={!canFetchAcquisitionFees}
                  onClick={onOpenTaxDetail}
                >
                  詳細条件で計算
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
