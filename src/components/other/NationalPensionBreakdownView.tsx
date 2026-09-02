import type { NationalPensionViewConfig } from '../../types/nationalPensionView';
import { formatYen } from '../../lib/nationalPensionView';

interface NationalPensionBreakdownViewProps {
  config: NationalPensionViewConfig;
}

export function NationalPensionBreakdownView({
  config,
}: NationalPensionBreakdownViewProps) {
  return (
    <div className="nhi-breakdown">
      <div className="nhi-breakdown-header">
        {config.fiscalYearLabel} 国民年金保険料
      </div>

      <div className="nhi-breakdown-body">
        <dl className="nhi-summary">
          <div className="nhi-summary-item">
            <dt>月額保険料</dt>
            <dd>{formatYen(config.monthlyPremiumYen)}</dd>
          </div>
          <div className="nhi-summary-item">
            <dt>年額保険料</dt>
            <dd>{formatYen(config.annualPremiumYen)}</dd>
          </div>
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
        </dl>

        <div className="nhi-grand-total">
          <p className="nhi-grand-total-formula">
            {formatYen(config.monthlyPremiumYen)} × 12か月 ＝{' '}
            {formatYen(config.annualPremiumYen)}
          </p>
          <p className="nhi-grand-total-result">
            この人の年間負担額
            <strong>{formatYen(config.memberPremiumYen)}</strong>
          </p>
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
