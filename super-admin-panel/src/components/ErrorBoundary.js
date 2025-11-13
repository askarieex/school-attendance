import React from 'react';

/**
 * ✅ CRITICAL FIX (Bug #6): React Error Boundary
 * Prevents blank screen on errors - shows user-friendly error message instead
 * Catches errors in any child component and prevents entire app crash
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    // Optionally reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.errorBox}>
            <h1 style={styles.title}>⚠️ Something went wrong</h1>
            <p style={styles.message}>
              We're sorry, but something unexpected happened.
              Don't worry - your data is safe.
            </p>

            <div style={styles.actions}>
              <button
                onClick={this.handleReset}
                style={styles.primaryButton}
              >
                🔄 Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={styles.secondaryButton}
              >
                🏠 Go to Dashboard
              </button>
            </div>

            {/* Show error details in development mode only */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>
                  🔍 Error Details (Dev Mode)
                </summary>
                <pre style={styles.errorDetails}>
                  <strong>Error:</strong> {this.state.error.toString()}
                  {'\n\n'}
                  <strong>Stack Trace:</strong>
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={styles.help}>
              <p>
                If this problem persists, please contact support with the following information:
              </p>
              <ul style={styles.helpList}>
                <li>What you were trying to do</li>
                <li>Current page URL: {window.location.href}</li>
                <li>Time: {new Date().toLocaleString()}</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inline styles for error boundary (works without CSS)
const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  errorBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    maxWidth: '600px',
    width: '100%'
  },
  title: {
    color: '#dc2626',
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '16px',
    textAlign: 'center'
  },
  message: {
    color: '#4b5563',
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '24px',
    textAlign: 'center'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  details: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '24px',
    marginTop: '24px'
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: '12px'
  },
  errorDetails: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    padding: '16px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    lineHeight: '1.5'
  },
  help: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    padding: '16px',
    color: '#1e40af',
    fontSize: '14px'
  },
  helpList: {
    marginTop: '8px',
    paddingLeft: '20px'
  }
};

export default ErrorBoundary;
