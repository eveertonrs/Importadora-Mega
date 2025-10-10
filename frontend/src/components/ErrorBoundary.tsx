// src/components/ErrorBoundary.tsx
import React from "react";
import { Link } from "react-router-dom";

type State = {
  hasError: boolean;
  error?: any;
  errorInfo?: { componentStack?: string } | null;
  showDetails: boolean;
  copied: boolean;
};

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary:", error, info);
    this.setState({ errorInfo: info });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else this.handleReload();
  };

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails, copied: false }));
  };

  private copyDetails = async () => {
    const { error, errorInfo } = this.state;
    const payload = [
      `Mensagem: ${String(error)}`,
      error?.stack ? `\nStack:\n${error.stack}` : "",
      errorInfo?.componentStack ? `\nReact stack:\n${errorInfo.componentStack}` : "",
      `\nURL: ${window.location.href}`,
      `UserAgent: ${navigator.userAgent}`,
      `Quando: ${new Date().toISOString()}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] grid place-items-center p-6">
          <div className="w-full max-w-2xl rounded-xl border bg-white p-6 shadow">
            <div className="flex items-start gap-4">
              <div className="text-4xl">💥</div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-slate-900">Ops, algo deu errado.</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Isso não era para acontecer. Você pode recarregar a página ou voltar para continuar trabalhando.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={this.handleBack} className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50">
                    Voltar
                  </button>
                  <button onClick={this.handleReload} className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                    Recarregar
                  </button>
                  <Link to="/" className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                    Ir para Início
                  </Link>
                  <button onClick={this.toggleDetails} className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50">
                    {this.state.showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
                  </button>
                  {this.state.showDetails && (
                    <button onClick={this.copyDetails} className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50">
                      {this.state.copied ? "Copiado ✓" : "Copiar detalhes"}
                    </button>
                  )}
                </div>

                {this.state.showDetails && (
                  <div className="mt-4">
                    <h2 className="text-sm font-medium text-slate-700">Detalhes técnicos</h2>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-800">
{String(this.state.error)}
{this.state.error?.stack ? `\n\n${this.state.error.stack}` : ""}
{this.state.errorInfo?.componentStack ? `\n\nReact stack:\n${this.state.errorInfo.componentStack}` : ""}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
