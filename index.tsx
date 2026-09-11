import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: unknown) {
    console.error('[App Error Boundary]', error);
  }
  render() {
    if (this.state.error) {
      return <pre style={{ whiteSpace: 'pre-wrap', padding: 24, color: '#991b1b' }}>APP_ERROR: {this.state.error}</pre>;
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
