import type {
  NationalHealthInsuranceViewConfig,
  NhiPremiumTableColumn,
} from '../../types/nationalHealthInsuranceView';
import { formatPercent, formatYen } from '../../lib/nationalHealthInsuranceView';

interface NationalHealthInsuranceBreakdownViewProps {
  config: NationalHealthInsuranceViewConfig;
}

function AmountCell({
  amountYen,
  formula,
}: {
  amountYen: number;
  formula?: string;
}) {
  if (!formula && amountYen <= 0) {
    return <span className="nhi-cell-empty">—</span>;
  }

  return (
    <div className="nhi-cell-stack">
      <span className="nhi-cell-amount">
        {amountYen > 0 ? formatYen(amountYen) : '—'}
      </span>
      {formula && <span className="nhi-cell-formula">{formula}</span>}
    </div>
  );
}

function incomeFormula(col: NhiPremiumTableColumn): string | undefined {
  if (!col.applicable || col.incomeBaseYen <= 0) return undefined;
  return `${formatYen(col.incomeBaseYen)} × ${formatPercent(col.incomeRate)}`;
}

function ColumnTotalLine({ col }: { col: NhiPremiumTableColumn }) {
  if (!col.applicable || col.cappedTotalYen <= 0) {
    return (
      <p className="nhi-column-total-line nhi-column-total-line--empty">
        {col.resultRef} {col.officialRef}
        {col.title}：対象外
      </p>
    );
  }

  const parts = [
    col.incomeYen,
    col.perCapitaYen,
    col.perHouseholdYen,
    col.assetYen,
  ].filter((yen) => yen > 0);
  const sumText = parts.map((yen) => formatYen(yen)).join(' ＋ ');
  const truncatedYen = Math.floor(col.rawTotalYen / 100) * 100;
  const notes: string[] = [];
  if (truncatedYen !== col.rawTotalYen) {
    notes.push('100円未満切捨て');
  }
  if (col.cappedTotalYen < truncatedYen) {
    notes.push('上限適用');
  }

  return (
    <p className="nhi-column-total-line">
      <span className="nhi-column-total-label">
        {col.resultRef} {col.officialRef}
        {col.title}
      </span>
      <span className="nhi-column-total-formula">
        {sumText} ＝ {formatYen(col.rawTotalYen)}
        {(notes.length > 0 || col.cappedTotalYen !== col.rawTotalYen) && (
          <>
            {' '}
            → <strong>{formatYen(col.cappedTotalYen)}</strong>
          </>
        )}
        {notes.length > 0 && (
          <span className="nhi-column-total-note">（{notes.join('・')}）</span>
        )}
      </span>
    </p>
  );
}

export function NationalHealthInsuranceBreakdownView({
  config,
}: NationalHealthInsuranceBreakdownViewProps) {
  const applicableColumns = config.columns.filter((col) => col.applicable);
  const sumLine = applicableColumns
    .map((col) => `${col.resultRef} ${formatYen(col.cappedTotalYen)}`)
    .join(' ＋ ');

  return (
    <div className="nhi-breakdown">
      <div className="nhi-breakdown-header">
        {config.fiscalYearLabel} 国民健康保険料（福岡市）
      </div>

      <div className="nhi-breakdown-body">
        <dl className="nhi-summary">
          <div className="nhi-summary-item">
            <dt>世帯の総所得金額等</dt>
            <dd>{formatYen(config.householdIncomeYen)}</dd>
          </div>
          <div className="nhi-summary-item">
            <dt>国保加入者</dt>
            <dd>{config.insuredCount}人</dd>
          </div>
          <div className="nhi-summary-item">
            <dt>均等割・平等割の軽減</dt>
            <dd>{config.reductionLabel}</dd>
          </div>
        </dl>

        <details className="nhi-details">
          <summary>総所得金額等の内訳を見る</summary>
          <div className="nhi-details-body">
            <p className="nhi-details-lead">
              <strong>※注1</strong>{' '}
              算定基礎となる所得とは、前年1月～12月の総所得金額等から基礎控除（43万円）を除いた金額です（加入者ごとに計算し合算）。
            </p>
            <ul className="nhi-details-bases">
              <li>
                (1)(2)(4)の所得割基礎：
                <strong>{formatYen(config.incomeBaseGeneralYen)}</strong>
              </li>
              <li>
                (3)介護分の所得割基礎：
                <strong>{formatYen(config.incomeBaseLtcYen)}</strong>
                {config.incomeBaseLtcYen === 0 && '（40～64歳の加入者なし）'}
              </li>
            </ul>
            {config.members.map((member) => (
              <div key={member.name} className="nhi-member-income">
                <p className="nhi-member-income-name">
                  {member.name}
                  <span className="nhi-member-income-total">
                    総所得金額等 {formatYen(member.totalIncomeYen)}
                  </span>
                </p>
                <ul className="nhi-member-income-lines">
                  {member.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>

        <h3 className="nhi-section-title">保険料率とこの世帯の計算結果</h3>

        <div className="nhi-table-wrap">
          <table className="nhi-table nhi-table--official">
            <thead>
              <tr>
                <th scope="col">区分</th>
                <th scope="col">算定基礎</th>
                {config.columns.map((col) => (
                  <th key={col.segment} scope="col" className="nhi-table-col-head">
                    <span className="nhi-table-col-ref">{col.officialRef}</span>
                    <span className="nhi-table-col-title">{col.title}</span>
                    <span className="nhi-table-col-sub">{col.subtitle}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">（ア）所得割</th>
                <td className="nhi-table-basis">
                  算定基礎となる所得
                  <span className="nhi-table-basis-note">※注1</span>
                </td>
                {config.columns.map((col) => (
                  <td key={`${col.segment}-income`}>
                    <AmountCell
                      amountYen={col.incomeYen}
                      formula={incomeFormula(col)}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">（イ）均等割</th>
                <td className="nhi-table-basis">１人につき</td>
                {config.columns.map((col) => (
                  <td key={`${col.segment}-per-capita`}>
                    <AmountCell
                      amountYen={col.perCapitaYen}
                      formula={
                        col.applicable && col.perCapitaLabel !== '—'
                          ? col.perCapitaLabel
                          : undefined
                      }
                    />
                    {col.segment === 'childcare' && col.applicable && (
                      <span className="nhi-table-cell-note">※注2</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">（ウ）平等割</th>
                <td className="nhi-table-basis">１世帯につき</td>
                {config.columns.map((col) => (
                  <td key={`${col.segment}-per-household`}>
                    <AmountCell amountYen={col.perHouseholdYen} />
                  </td>
                ))}
              </tr>
              <tr className="nhi-table-row-caps">
                <th scope="row">賦課限度額</th>
                <td className="nhi-table-basis">１世帯につき</td>
                {config.columns.map((col) => (
                  <td key={`${col.segment}-cap`} className="nhi-table-cap">
                    {formatYen(col.capYen)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="nhi-footnotes">
          <p>
            <strong>※注1</strong>{' '}
            算定基礎となる所得 ＝ 総所得金額等 − 基礎控除（43万円）。合計所得2,400万円超では基礎控除が異なります（本試算では43万円固定）。
          </p>
          <p>
            <strong>※注2</strong>{' '}
            子ども分の均等割額には、18歳以上被保険者均等割額（1人あたり72円）を含みます。18歳未満は均等割が全額軽減されます。
          </p>
        </div>

        <div className="nhi-column-totals">
          <h4 className="nhi-column-totals-title">区分ごとの合計</h4>
          {config.columns.map((col) => (
            <ColumnTotalLine key={col.segment} col={col} />
          ))}
        </div>

        <div className="nhi-grand-total">
          <p className="nhi-grand-total-formula">{sumLine}</p>
          <p className="nhi-grand-total-result">
            年間保険料（世帯）
            <strong>{formatYen(config.premiumYen)}</strong>
          </p>
        </div>

        {config.isNhiMember && (
          <div className="nhi-member-share">
            <p className="nhi-member-share-label">この人の負担額</p>
            {config.nationalPensionYen > 0 && (
              <p>
                国民年金 {formatYen(config.nationalPensionYen)}
                <span className="nhi-member-share-note">（国保とは別）</span>
              </p>
            )}
            <p className="nhi-member-share-amount">
              国民健康保険料（按分）
              <strong>{formatYen(config.memberShareYen)}</strong>
            </p>
            {config.insuredCount > 1 && (
              <p className="nhi-member-share-note">
                世帯合計を{config.insuredCount}人で按分
              </p>
            )}
          </div>
        )}
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
