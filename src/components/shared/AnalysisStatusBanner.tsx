interface AnalysisStatusBannerProps {
  stale: boolean;
}

export function AnalysisStatusBanner({ stale }: AnalysisStatusBannerProps) {
  if (!stale) return null;

  return (
    <p className="analysis-status-message" role="status" aria-live="polite">
      入力が変更されています。表示中の結果は前回の分析時点のものです。更新するには「ライフプラン分析」を実行してください。
    </p>
  );
}
