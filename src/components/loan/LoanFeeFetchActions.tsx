interface LoanFeeFetchActionsProps {
  canFetch: boolean;
  onFetch: () => void;
  showDetail?: boolean;
  onDetail?: () => void;
}

export function LoanFeeFetchActions({
  canFetch,
  onFetch,
  showDetail = false,
  onDetail,
}: LoanFeeFetchActionsProps) {
  return (
    <div className="loan-bank-fees-fetch">
      <button
        type="button"
        className="education-fetch-btn loan-fee-fetch-btn"
        disabled={!canFetch}
        onClick={onFetch}
      >
        参考
      </button>
      {showDetail && onDetail ? (
        <button
          type="button"
          className="education-fetch-detail-link"
          onClick={onDetail}
        >
          詳細
        </button>
      ) : null}
    </div>
  );
}
