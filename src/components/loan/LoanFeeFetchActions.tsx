interface LoanFeeFetchActionsProps {
  canFetch: boolean;
  onFetch: () => void;
  showDetail?: boolean;
  onDetail?: () => void;
  fetchLabel?: string;
  detailLabel?: string;
}

export function LoanFeeFetchActions({
  canFetch,
  onFetch,
  showDetail = false,
  onDetail,
  fetchLabel = '目安を自動入力',
  detailLabel = '計算根拠を見る',
}: LoanFeeFetchActionsProps) {
  return (
    <div className="loan-bank-fees-fetch">
      <button
        type="button"
        className="ui-btn ui-btn--secondary ui-btn--compact loan-fee-fetch-btn"
        disabled={!canFetch}
        onClick={onFetch}
      >
        {fetchLabel}
      </button>
      {showDetail && onDetail ? (
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--compact loan-fee-detail-btn"
          onClick={onDetail}
        >
          {detailLabel}
        </button>
      ) : null}
    </div>
  );
}
