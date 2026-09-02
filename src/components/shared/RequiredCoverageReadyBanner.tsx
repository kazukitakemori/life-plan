export function RequiredCoverageReadyBanner() {
  return (
    <div
      className="required-coverage-ready-banner"
      role="status"
      aria-live="polite"
    >
      <p className="required-coverage-ready-banner-title">
        必須項目の入力が完了しました
      </p>
      <p className="required-coverage-ready-banner-text">
        試算結果は画面上部の「必要保障額」タブで確認できます。
      </p>
    </div>
  );
}
