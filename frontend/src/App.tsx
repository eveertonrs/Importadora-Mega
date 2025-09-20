// src/App.tsx
import "./index.css";
import type { ReactNode } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useParams,
  Outlet,
} from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";

// públicas
import Login from "./components/Login";
import Register from "./components/Register";

// home (dashboard)
import Home from "./components/Home";

// clientes
import Clientes from "./components/Clientes";
import ClienteForm from "./components/ClienteForm";            // ✅ NOVO
import ClienteDetalhes from "./components/ClienteDetalhes";
import ClienteDocumentoForm from "./components/ClienteDocumentoForm";

// financeiro
import PagamentoForm from "./components/PagamentoForm";
import HistoricoPagamentos from "./components/HistoricoPagamentos";
import FormaPagamentoForm from "./components/FormaPagamentoForm";

// auxiliares
import TransportadoraForm from "./components/TransportadoraForm";
import Dominios from "./components/Dominios";
import DominioItens from "./components/DominioItens";

// blocos
import Blocos from "./components/ui/Blocos";
import BlocoDetalhe from "./components/ui/BlocoDetalhe";

// ui
import Button from "./components/ui/button";

// auth
import { useAuth } from "./contexts/AuthContext";

// ---- Layout com header/nav e botão sair ----
const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  return (
    <div className="container mx-auto p-4">
      <header className="sticky top-0 z-40 mb-6 bg-white/70 backdrop-blur border-b border-slate-200">
        <div className="container mx-auto px-4 py-3 flex flex-wrap gap-4 justify-between items-center">
          <h1 className="text-lg md:text-xl font-semibold text-slate-900">
            Bem-vindo, {user?.nome}
          </h1>
          <nav className="text-sm">
            <ul className="flex flex-wrap gap-4">
              {[
                { to: "/", label: "Início" },
                { to: "/blocos", label: "Blocos" },
                { to: "/clientes", label: "Clientes" },
                { to: "/formas-pagamento", label: "Formas de Pagamento" },
                { to: "/transportadoras", label: "Transportadoras" },
                { to: "/dominios", label: "Domínios" },
                { to: "/pagamentos", label: "Pagamentos" },
                { to: "/historico-pagamentos", label: "Histórico" },
              ].map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        "px-2 py-1 rounded-md transition-colors",
                        isActive
                          ? "text-slate-900 bg-slate-100"
                          : "text-blue-600 hover:text-blue-700 hover:bg-blue-50",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Button variant="destructive" size="sm" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
};

// ---- Wrapper para usar useParams dentro do Router ----
const ClienteDocumentoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <ClienteDocumentoForm clienteId={id ?? ""} />;
};

/**
 * Área protegida: só cria o <Layout> depois que verificamos o auth.
 * Evita qualquer NavLink fora do Router.
 */
const ProtectedArea: React.FC = () => {
  const { isAuthenticated, loadingAuth } = useAuth();
  if (loadingAuth) return <div className="p-6">Carregando…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* protegidas */}
        <Route element={<ProtectedArea />}>
          <Route path="/" element={<Home />} />
          {/* Blocos */}
          <Route path="/blocos" element={<Blocos />} />
          <Route path="/blocos/:id" element={<BlocoDetalhe />} />
          {/* Clientes */}
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/novo" element={<ClienteForm />} /> {/* ✅ NOVO */}
          <Route path="/clientes/:id" element={<ClienteDetalhes />} />
          <Route path="/clientes/:id/documentos" element={<ClienteDocumentoPage />} />
          {/* Financeiro/auxiliares */}
          <Route path="/pagamentos" element={<PagamentoForm />} />
          <Route path="/historico-pagamentos" element={<HistoricoPagamentos />} />
          <Route path="/formas-pagamento" element={<FormaPagamentoForm />} />
          <Route path="/transportadoras" element={<TransportadoraForm />} />
          <Route path="/dominios" element={<Dominios />} />
          <Route path="/dominios/:id/itens" element={<DominioItens />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
