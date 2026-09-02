import type { AcquisitionFeeBreakdown } from '../../lib/housingAcquisitionFees';
import { formatAcquisitionTargetLabel } from '../../lib/housingAcquisitionFees';
import { OWNED_PROPERTY_TYPE_LABELS } from '../../lib/housingLabels';

export type { AcquisitionFeeBreakdown } from '../../lib/housingAcquisitionFees';
export {
  buildAcquisitionFeeBreakdown,
  buildAcquisitionFeeBreakdownFromProperty,
  calcAcquisitionTaxMan,
  calcBrokerageFeeMan,
  calcRegistrationFeeMan,
  resolveAcquisitionTarget,
} from '../../lib/housingAcquisitionFees';

export type AcquisitionReferenceSection = 'brokerage' | 'registration';

interface AcquisitionReferenceModalProps {
  open: boolean;
  section: AcquisitionReferenceSection;
  breakdown: AcquisitionFeeBreakdown | null;
  onClose: () => void;
}

function fmt(man: number): string {
  return `${man.toLocaleString()}万円`;
}

export function AcquisitionReferenceModal({
  open,
  section,
  breakdown,
  onClose,
}: AcquisitionReferenceModalProps) {
  if (!open || !breakdown) return null;

  const {
    buildingMan,
    landMan,
    basePriceMan,
    brokerageFeeMan,
    registrationFeeMan,
    propertyType,
    target,
    brokerageDetail,
    registrationDetail,
  } = breakdown;

  const typeLabel = OWNED_PROPERTY_TYPE_LABELS[propertyType];
  const targetLabel = formatAcquisitionTargetLabel(target);
  const isBrokerage = section === 'brokerage';
  const title = isBrokerage
    ? `仲介手数料の自動計算内訳 — ${typeLabel}`
    : `登記手数料の自動計算内訳 — ${typeLabel}`;

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal housing-acq-ref-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="housing-acq-ref-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>

        <h3
          id="housing-acq-ref-title"
          className="education-ref-modal-title"
        >
          {title}
        </h3>
        <p className="education-ref-modal-summary">
          対象物件「{targetLabel}」の前提で、入力された建物・土地の金額から
          {isBrokerage ? '仲介手数料' : '登記手数料'}の概算を自動入力しました。
          実際の費用は契約内容や物件の評価額によって変わるため、見積書等で確認してください。
        </p>

        <div className="education-ref-modal-body">

          {isBrokerage && (
          <section className="education-ref-section">
            <h4 className="education-ref-section-title">仲介手数料（法定上限・税込）</h4>
            <p className="education-ref-section-desc">{brokerageDetail.note}</p>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">建物 ＋ 土地</th>
                  <td>{fmt(basePriceMan)}</td>
                </tr>
                <tr>
                  <th scope="row">計算式</th>
                  <td>{brokerageDetail.formula}{brokerageFeeMan > 0 ? '（税込）' : ''}</td>
                </tr>
                <tr className="education-ref-row--highlight">
                  <th scope="row">自動入力した金額</th>
                  <td>{fmt(brokerageFeeMan)}{brokerageFeeMan > 0 ? '（税込）' : ''}</td>
                </tr>
              </tbody>
            </table>
          </section>
          )}

          {!isBrokerage && (
          <section className="education-ref-section">
            <h4 className="education-ref-section-title">登記手数料（登録免許税＋司法書士報酬）</h4>
            {registrationDetail.note && (
              <p className="education-ref-section-desc">{registrationDetail.note}</p>
            )}
            <table className="education-ref-kv-table">
              <tbody>
                {landMan > 0 && (
                  <>
                    <tr>
                      <th scope="row">土地の固定資産税評価額（目安）</th>
                      <td>{fmt(registrationDetail.landAssessedMan)}（{registrationDetail.landAssessedRateLabel}）</td>
                    </tr>
                    <tr>
                      <th scope="row">土地の登録免許税税率</th>
                      <td>{registrationDetail.landRateLabel}</td>
                    </tr>
                    <tr>
                      <th scope="row">土地の登録免許税概算</th>
                      <td>{fmt(registrationDetail.landRegistrationTaxMan)}</td>
                    </tr>
                  </>
                )}
                {propertyType !== 'land' && buildingMan > 0 && (
                  <>
                    <tr>
                      <th scope="row">建物の固定資産税評価額（目安）</th>
                      <td>{fmt(registrationDetail.buildingAssessedMan)}（{registrationDetail.buildingAssessedRateLabel}）</td>
                    </tr>
                    <tr>
                      <th scope="row">建物の登録免許税税率</th>
                      <td>{registrationDetail.buildingRateLabel}</td>
                    </tr>
                    <tr>
                      <th scope="row">建物の登録免許税概算</th>
                      <td>{fmt(registrationDetail.buildingRegistrationTaxMan)}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <th scope="row">司法書士報酬（目安）</th>
                  <td>
                    {fmt(registrationDetail.scrivenerFeeMan)}
                    {registrationDetail.pairLoanScrivenerSurchargeMan > 0 ? (
                      <span className="education-ref-subline">
                        内訳：基本
                        {fmt(
                          registrationDetail.scrivenerFeeMan -
                            registrationDetail.pairLoanScrivenerSurchargeMan,
                        )}{' '}
                        ＋ ペアローン上乗せ
                        {fmt(registrationDetail.pairLoanScrivenerSurchargeMan)}
                      </span>
                    ) : null}
                  </td>
                </tr>
                {registrationDetail.note ? (
                  <tr>
                    <th scope="row">補足</th>
                    <td>{registrationDetail.note}</td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">計算式</th>
                  <td>{registrationDetail.formula}</td>
                </tr>
                <tr className="education-ref-row--highlight">
                  <th scope="row">自動入力した金額</th>
                  <td>{fmt(registrationFeeMan)}</td>
                </tr>
              </tbody>
            </table>
          </section>
          )}

          <section className="education-ref-section education-ref-sources">
            <h4 className="education-ref-section-title">出典・前提</h4>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">対象物件</th>
                  <td>{targetLabel}</td>
                </tr>
                {isBrokerage ? (
                  <tr>
                    <th scope="row">仲介手数料上限</th>
                    <td>宅地建物取引業法 第46条</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <th scope="row">登録免許税</th>
                      <td>租税特別措置法（令和9年3月末まで特例）</td>
                    </tr>
                    <tr>
                      <th scope="row">固定資産税評価額の仮定</th>
                      <td>
                        土地は{registrationDetail.landAssessedRateLabel}、建物は
                        {registrationDetail.buildingAssessedRateLabel}
                        （いずれも目安）
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </section>

        </div>
      </div>
    </div>
  );
}
