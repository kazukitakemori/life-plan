import type { LateElderlyHealthViewConfig } from '../../types/lateElderlyHealthView';

import { formatPercent, formatYen } from '../../lib/lateElderlyHealthView';

import { TAX_RATE_CONSTANTS } from '../../lib/taxCalculator';



interface LateElderlyHealthBreakdownViewProps {

  config: LateElderlyHealthViewConfig;

}



function formatPerCapitaLabel(config: LateElderlyHealthViewConfig): string {

  if (!config.isApplicable) {

    return '—';

  }



  const base = `${formatYen(config.rawPerCapitaYen)} × 1人`;

  if (config.flatPayRate < 1) {

    return `${base}（${config.reductionLabel}）`;

  }

  return base;

}



export function LateElderlyHealthBreakdownView({

  config,

}: LateElderlyHealthBreakdownViewProps) {

  const incomeFormula =

    config.isApplicable && config.incomeBaseYen > 0

      ? `${formatYen(config.incomeBaseYen)} × ${formatPercent(config.incomeLevyRate)}`

      : null;



  return (

    <div className="nhi-breakdown">

      <div className="nhi-breakdown-header">

        {config.fiscalYearLabel} 後期高齢者医療保険料

      </div>



      <div className="nhi-breakdown-body">

        <dl className="nhi-summary">

          <div className="nhi-summary-item">

            <dt>判定</dt>

            <dd>{config.statusLabel}</dd>

          </div>

          {config.memberAge != null && (

            <div className="nhi-summary-item">

              <dt>年齢（{config.fiscalYearLabel}末）</dt>

              <dd>{config.memberAge}歳</dd>

            </div>

          )}

          {config.isApplicable && config.lateElderlyInsuredCount > 0 && (

            <>

              <div className="nhi-summary-item">

                <dt>後期高齢被保険者数</dt>

                <dd>{config.lateElderlyInsuredCount}人</dd>

              </div>

              <div className="nhi-summary-item">

                <dt>軽減判定用の世帯所得</dt>

                <dd>{formatYen(config.householdIncomeYen)}</dd>

              </div>

              <div className="nhi-summary-item">

                <dt>均等割の軽減区分</dt>

                <dd>{config.reductionLabel}</dd>

              </div>

            </>

          )}

          <div className="nhi-summary-item">

            <dt>所得割率（福岡市・医療＋支援）</dt>

            <dd>{formatPercent(config.incomeLevyRate)}</dd>

          </div>

          <div className="nhi-summary-item">

            <dt>均等割（軽減前）</dt>

            <dd>

              {formatYen(

                config.isApplicable

                  ? config.rawPerCapitaYen

                  : TAX_RATE_CONSTANTS.lateElderlyHealthInsuranceFixed,

              )}

            </dd>

          </div>

        </dl>



        {config.isApplicable && (

          <details className="nhi-details" open>

            <summary>算定基礎となる所得の内訳（{config.levyIncomeYear}年）</summary>

            <div className="nhi-details-body">

              <ul className="nhi-details-bases">

                {config.pensionRevenueYen > 0 && (

                  <li>

                    公的年金収入 {formatYen(config.pensionRevenueYen)} → 雑所得{' '}

                    <strong>{formatYen(config.pensionIncomeYen)}</strong>

                  </li>

                )}

                {config.salaryIncomeYen > 0 && (

                  <li>

                    給与所得{' '}

                    <strong>{formatYen(config.salaryIncomeYen)}</strong>

                  </li>

                )}

                {config.otherIncomeYen > 0 && (

                  <li>

                    その他所得{' '}

                    <strong>{formatYen(config.otherIncomeYen)}</strong>

                  </li>

                )}

                <li>

                  算定基礎となる所得（基礎控除前） ＝{' '}

                  <strong>

                    {formatYen(

                      config.pensionIncomeYen +

                        config.salaryIncomeYen +

                        config.otherIncomeYen,

                    )}

                  </strong>

                </li>

                <li>

                  所得割の算定基礎（基礎控除43万円後） ＝{' '}

                  <strong>{formatYen(config.incomeBaseYen)}</strong>

                </li>

              </ul>

            </div>

          </details>

        )}



        <h3 className="nhi-section-title">保険料の計算</h3>



        <div className="nhi-table-wrap">

          <table className="nhi-table nhi-table--official">

            <thead>

              <tr>

                <th scope="col">区分</th>

                <th scope="col">算定基礎</th>

                <th scope="col">金額</th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <th scope="row">所得割</th>

                <td className="nhi-table-basis">この人の所得（基礎控除後）</td>

                <td>

                  {config.isApplicable ? (

                    <div className="nhi-cell-stack">

                      <span className="nhi-cell-amount">

                        {formatYen(config.incomeLevyYen)}

                      </span>

                      {incomeFormula && (

                        <span className="nhi-cell-formula">{incomeFormula}</span>

                      )}

                    </div>

                  ) : (

                    <span className="nhi-cell-empty">—</span>

                  )}

                </td>

              </tr>

              <tr>

                <th scope="row">均等割</th>

                <td className="nhi-table-basis">{formatPerCapitaLabel(config)}</td>

                <td>

                  {config.isApplicable ? (

                    <span className="nhi-cell-amount">

                      {formatYen(config.fixedYen)}

                    </span>

                  ) : (

                    <span className="nhi-cell-empty">—</span>

                  )}

                </td>

              </tr>

            </tbody>

          </table>

        </div>



        <div className="nhi-grand-total">

          {config.isApplicable ? (

            <>

              <p className="nhi-grand-total-formula">

                {formatYen(config.incomeLevyYen)} ＋ {formatYen(config.fixedYen)}{' '}

                ＝ {formatYen(config.memberPremiumYen)}

              </p>

              <p className="nhi-grand-total-result">

                この人の年間負担額

                <strong>{formatYen(config.memberPremiumYen)}</strong>

              </p>

            </>

          ) : (

            <p className="nhi-grand-total-result">

              この人の年間負担額

              <strong>{formatYen(0)}</strong>

            </p>

          )}

        </div>

      </div>



      <div className="nhi-breakdown-notes">

        <p className="nhi-breakdown-notes-title">注意</p>

        <ul>

          {config.notes.map((note) => (

            <li key={note}>{note}</li>

          ))}

        </ul>

      </div>

    </div>

  );

}

