import type { HousingLoanBankFeeReference } from '../../lib/housingLoanFeeReference';

interface HousingLoanBankFeeReferenceModalProps {
  open: boolean;
  breakdown: HousingLoanBankFeeReference | null;
  onClose: () => void;
}

function fmt(man: number): string {
  return `${man.toLocaleString()}万円`;
}

export function HousingLoanBankFeeReferenceModal({
  open,
  breakdown,
  onClose,
}: HousingLoanBankFeeReferenceModalProps) {
  if (!open || !breakdown) return null;

  const {
    loanAmountMan,
    loanYears,
    financingFeeMan,
    guaranteeFeeMan,
    administrativeFeeMan,
  } = breakdown;

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal housing-acq-ref-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="housing-loan-fee-ref-title"
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
          id="housing-loan-fee-ref-title"
          className="education-ref-modal-title"
        >
          住宅ローン諸手数料の自動計算内訳
        </h3>
        <p className="education-ref-modal-summary">
          借入額と返済期間をもとに、各手数料の概算を自動入力しました。
          金融機関・保証会社・商品により異なるため、見積書等で確認してください。
        </p>

        <div className="education-ref-modal-body">
          <section className="education-ref-section">
            <h4 className="education-ref-section-title">融資手数料</h4>
            <p className="education-ref-section-desc">
              一般的な住宅ローン手数料率（税込2.2%）を借入額に乗じて概算しています。
            </p>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">借入額</th>
                  <td>{fmt(loanAmountMan)}</td>
                </tr>
                <tr>
                  <th scope="row">計算式</th>
                  <td>
                    {fmt(loanAmountMan)} × 2.2% ≒ {financingFeeMan}万円（税込）
                  </td>
                </tr>
                <tr className="education-ref-row--highlight">
                  <th scope="row">自動入力した金額</th>
                  <td>{fmt(financingFeeMan)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="education-ref-section">
            <h4 className="education-ref-section-title">保証料</h4>
            <p className="education-ref-section-desc">
              機構保証等の概算として、借入額の1.5%を35年返済を基準に返済年数で按分しています。
            </p>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">借入額</th>
                  <td>{fmt(loanAmountMan)}</td>
                </tr>
                <tr>
                  <th scope="row">返済期間</th>
                  <td>{loanYears}年</td>
                </tr>
                <tr>
                  <th scope="row">計算式</th>
                  <td>
                    {fmt(loanAmountMan)} × 1.5% ×（{loanYears}年 / 35年）≒{' '}
                    {guaranteeFeeMan}万円
                  </td>
                </tr>
                <tr className="education-ref-row--highlight">
                  <th scope="row">自動入力した金額</th>
                  <td>{fmt(guaranteeFeeMan)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="education-ref-section">
            <h4 className="education-ref-section-title">事務手数料</h4>
            <p className="education-ref-section-desc">
              多くの金融機関で課される事務手数料の一般的な目安（税込）です。
            </p>
            <table className="education-ref-kv-table">
              <tbody>
                <tr className="education-ref-row--highlight">
                  <th scope="row">自動入力した金額</th>
                  <td>{fmt(administrativeFeeMan)}（税込・固定）</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="education-ref-section education-ref-sources">
            <h4 className="education-ref-section-title">出典・前提</h4>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">融資手数料</th>
                  <td>民間金融機関の一般的な手数料率（税込2.2%前後）を参考</td>
                </tr>
                <tr>
                  <th scope="row">保証料</th>
                  <td>住宅金融支援機構等の保証料率を簡略化した概算</td>
                </tr>
                <tr>
                  <th scope="row">事務手数料</th>
                  <td>金融機関の一般的な課金水準（税込3.3万円前後）を参考</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
