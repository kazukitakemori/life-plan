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
        <div className="housing-owned-acquisition-total-main">
          <span className="housing-owned-acquisition-total-label">取得価格</span>
          <strong className="housing-owned-acquisition-total-amount">
            {acquisitionTotal}
          </strong>
        </div>
        <span className="housing-owned-acquisition-note">
          建物 + 土地 + 仲介手数料
        </span>
      </div>

      {isCurrentlyOccupied ? (
        <p className="housing-owned-loan-existing-note">
          居住中でも、当時の取得価格・諸費用を入力してください。ローン借入額はこれらと「諸費用のローン組み込み」から計算します。過去の購入時現金支出はキャッシュフローには含めません。
        </p>
      ) : null}

      <div className="housing-owned-acquisition-panel">
        <section className="housing-owned-acquisition-group">
          <div className="housing-owned-acquisition-group-header">
            <h5 className="housing-owned-acquisition-group-title">物件価格</h5>
            <p className="housing-owned-acquisition-group-note">
              建物・土地の内訳は、登記手数料や不動産取得税の試算に使います。
            </p>
          </div>

          <div className="housing-owned-acquisition-price-grid">
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

        <section className="housing-owned-acquisition-group">
          <div className="housing-owned-acquisition-cost-header">
            <div className="housing-owned-acquisition-group-header">
              <h5 className="housing-owned-acquisition-group-title">
                諸費用・税金
              </h5>
              <p className="housing-owned-acquisition-group-note">
                物件価格をもとに、購入時にかかる費用の参考額をまとめて試算できます。
              </p>
            </div>

            <div className="housing-owned-acquisition-reference-action">
              <button
                type="button"
                className="ui-btn ui-btn--ghost"
                disabled={!canFetchAcquisitionFees}
                onClick={onFetchReference}
              >
                諸費用の参考額を計算
              </button>
              <p className="housing-owned-acquisition-reference-note">
                {canFetchAcquisitionFees
                  ? '仲介・登記・取得税を参考額で更新します。あとから手入力で変更できます。'
                  : '建物または土地の金額を入力すると計算できます。'}
              </p>
            </div>
          </div>

          <div className="housing-owned-acquisition-fee-grid">
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
                  className="ui-btn ui-btn--ghost housing-owned-acquisition-detail-action"
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
                  className="ui-btn ui-btn--ghost housing-owned-acquisition-detail-action"
                  onClick={() => onOpenReference('registration')}
                >
                  計算根拠を見る
                </button>
              ) : null}
            </div>
          </div>

          <div className="housing-owned-acquisition-tax-row">
            <div className="housing-rental-field">
              <span className="housing-rental-field-label">不動産取得税</span>
              <HousingManInput
                compact
                value={property.acquisitionTaxMan}
                onChange={(acquisitionTaxMan) =>
                  onChange({ acquisitionTaxMan })
                }
              />
            </div>
            <div className="housing-owned-acquisition-tax-action">
              <p className="housing-owned-acquisition-tax-note">
                面積・築年数・納付時期まで指定する場合は、詳細条件から調整できます。
              </p>
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
    </section>
  );
}
