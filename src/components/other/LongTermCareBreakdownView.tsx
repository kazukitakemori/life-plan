import type { LongTermCareViewConfig } from '../../types/longTermCareView';
import { formatPercent, formatYen } from '../../lib/longTermCareView';

interface LongTermCareBreakdownViewProps {
  config: LongTermCareViewConfig;
}

function variantLabel(variant: LongTermCareViewConfig['variant']): string {
  switch (variant) {
    case 'late_elderly':
      return '第1号（後期高齢者）';
    case 'employee_first_class':
      return '第1号（健康保険と併徴）';
    case 'first_class':
      return '第1号（市町村から賦課）';
    case 'employee_second_class':
      return '第2号（給与天引き）';
    case 'nhi_segment':
      return '第2号（国保介護分）';
    default:
      return '—';
  }
}

export function LongTermCareBreakdownView({
  config,
}: LongTermCareBreakdownViewProps) {
  return (
    <div className="nhi-breakdown">
      <div className="nhi-breakdown-header">
        {config.fiscalYearLabel} 介護保険料
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
          <div className="nhi-summary-item">
            <dt>区分</dt>
            <dd>{variantLabel(config.variant)}</dd>
          </div>
          {config.rate != null && (
            <div className="nhi-summary-item">
              <dt>保険料率（被保険者負担）</dt>
              <dd>{formatPercent(config.rate)}</dd>
            </div>
          )}
          {config.monthlyPremiumYen != null && (
            <div className="nhi-summary-item">
              <dt>月額概算</dt>
              <dd>{formatYen(config.monthlyPremiumYen)}</dd>
            </div>
          )}
        </dl>

        <div className="nhi-grand-total">
          {config.isApplicable && config.monthlyPremiumYen != null ? (
            <p className="nhi-grand-total-formula">
              {formatYen(config.monthlyPremiumYen)} × 12か月 ＝{' '}
              {formatYen(config.memberPremiumYen)}
            </p>
          ) : null}
          <p className="nhi-grand-total-result">
            この人の年間負担額
            <strong>{formatYen(config.memberPremiumYen)}</strong>
          </p>
          {config.viaNhi && config.isApplicable && (
            <p className="nhi-member-share-note">
              国民健康保険料の介護分（③）に含まれます
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
