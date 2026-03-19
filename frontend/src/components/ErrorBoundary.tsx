import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback UI, e.g. "Galleries" */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    const section = this.props.label ? `"${this.props.label}"` : 'this section';

    return (
      <div className='flex flex-col items-center justify-center gap-3 rounded-xl border border-beige bg-ivory p-8 text-center'>
        <AlertTriangle size={28} className='text-rose-400' />
        <p className='text-sm font-medium text-charcoal'>Something went wrong loading {section}</p>
        {this.state.message && (
          <p className='text-xs text-warm-gray'>{this.state.message}</p>
        )}
        <button
          onClick={this.reset}
          className='mt-1 flex items-center gap-1.5 rounded-lg border border-beige px-4 py-2 text-xs text-warm-gray hover:bg-beige/30 transition-colors'
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    );
  }
}
