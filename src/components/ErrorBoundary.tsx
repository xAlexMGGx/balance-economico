import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last resort screen if something breaks, instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 pt-safe text-center">
        <h1 className="mt-16 text-lg font-semibold">Algo ha fallado</h1>
        <p className="mt-2 text-sm text-muted">
          Tus datos siguen guardados en el dispositivo. Prueba a recargar la app.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-surface p-3 text-left text-xs text-muted">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-12 w-full rounded-xl bg-accent font-semibold text-white"
        >
          Recargar
        </button>
      </div>
    );
  }
}
