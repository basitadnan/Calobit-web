import { Component } from 'react';

/**
 * Catches any render error (including the brief window while the Google
 * sign-in deep link hands back to the app) and shows a recoverable screen
 * instead of a blank white WebView. Tap to reload.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[error-boundary]', error);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: '#F9FAFB', color: '#1A1A1A', padding: 30, fontFamily: 'inherit',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😵</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>Something went wrong</h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280', maxWidth: 280 }}>
            Your data is safe on this device — this was just a display hiccup.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
