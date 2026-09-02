import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 描画例外で画面全体が白くならないようにする */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-error-boundary">
        <h1 className="app-error-boundary-title">画面の表示に失敗しました</h1>
        <p className="app-error-boundary-desc">
          入力データは残っています。再読み込みで復帰できることが多いです。
        </p>
        <pre className="app-error-boundary-detail">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          className="app-error-boundary-reload"
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }
}
