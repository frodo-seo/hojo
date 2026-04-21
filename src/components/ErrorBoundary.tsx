import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[hojo] uncaught error", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>문제가 발생했습니다</h1>
          <p className="error-boundary-msg">{this.state.error.message}</p>
          <button className="error-boundary-btn" onClick={this.reset}>
            다시 시도
          </button>
          <button
            className="error-boundary-btn secondary"
            onClick={() => window.location.reload()}
          >
            앱 새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
