import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-dark-bg flex items-center justify-center p-4 z-[9999] relative text-white">
          <div className="max-w-2xl w-full bg-dark-surface border border-red-500/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(255,0,0,0.15)] flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-3xl font-bold mb-4">Application Error</h1>
            <p className="text-gray-400 mb-8">
              A critical error occurred while rendering this page. The engineering team has been notified.
            </p>
            
            <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-left overflow-auto max-h-64 mb-8">
              <p className="text-red-400 font-mono text-sm font-bold mb-2">
                {this.state.error?.toString()}
              </p>
              <pre className="text-gray-500 font-mono text-xs whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-full font-bold transition-colors"
            >
              <RefreshCcw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
