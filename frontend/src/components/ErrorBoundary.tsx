// src/components/ErrorBoundary.tsx
import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Componente/elemento a exibir quando houver erro */
  fallback?: ReactNode;
  /** Ação ao clicar em "Tentar novamente" (por padrão recarrega a página) */
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para mostrar a UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log centralizado: substitua por envio a um serviço (Sentry/LogRocket/etc)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      // fallback: recarrega a página
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Fallback padrão com Tailwind (opcional)
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-2xl font-semibold mb-2">Algo deu errado.</h2>
          <p className="text-gray-600 mb-4">
            Tente novamente. Se o problema persistir, contate o suporte.
          </p>

          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Tentar novamente
          </button>

          <details className="mt-6 max-w-2xl text-left w-full bg-gray-50 border rounded p-4">
            <summary className="cursor-pointer font-medium">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {this.state.error?.toString()}
              {"\n"}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
