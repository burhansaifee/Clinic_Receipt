import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Buvora Error Boundary] Uncaught error:', error, errorInfo);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8fafc',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: '2rem',
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'white',
            borderRadius: '16px',
            padding: '2.5rem',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#fef2f2',
              color: '#ef4444',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '2rem',
            }}>
              ⚠
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1e293b',
              margin: '0 0 0.75rem',
            }}>
              Something went wrong
            </h2>
            <p style={{
              color: '#64748b',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              margin: '0 0 1.5rem',
            }}>
              An unexpected error occurred. Your data is safe — try recovering or reloading the application.
            </p>

            {this.state.error && (
              <details style={{
                textAlign: 'left',
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                border: '1px solid #e2e8f0',
              }}>
                <summary style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                }}>
                  Error Details
                </summary>
                <pre style={{
                  fontSize: '0.75rem',
                  color: '#ef4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: '0.5rem 0 0',
                  fontFamily: 'monospace',
                }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={this.handleRecover}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Try to Recover
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0284c7',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
