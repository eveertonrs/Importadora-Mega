// src/App.tsx
import "./index.css";
import { BrowserRouter, Routes, Route, Link, Navigate, useParams } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";

import Login from "./components/Login";
import Register from "./components/Register";
import Clientes from "./components/Clientes";
import ClienteDetalhes from "./components/ClienteDetalhes";
import ClienteDocumentoForm from "./components/ClienteDocumentoForm";
import PagamentoForm from "./components/PagamentoForm";
import HistoricoPagamentos from "./components/HistoricoPagamentos";
import FormaPagamentoForm from "./components/FormaPagamentoForm";
import TransportadoraForm from "./components/TransportadoraForm";
import Dominios from "./components/Dominios";
import DominioItens from "./components/DominioItens";

import { useAuth } from "./contexts/AuthContext";

// ---- Guard para rotas protegidas ----
const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// ---- Layout com header/nav e botão sair ----
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  return (
    <div className="container mx-auto p-4">
      <header className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <h1 className="text-xl">Bem-vindo, {user?.nome}</h1>
        <nav>
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link to="/" className="text-blue-500 hover:text-blue-700">
                Clientes
              </Link>
            </li>
            <li>
              <Link to="/formas-pagamento" className="text-blue-500 hover:text-blue-700">
                Formas de Pagamento
              </Link>
            </li>
            <li>
              <Link to="/transportadoras" className="text-blue-500 hover:text-blue-700">
                Transportadoras
              </Link>
            </li>
            <li>
              <Link to="/dominios" className="text-blue-500 hover:text-blue-700">
                Domínios
              </Link>
            </li>
            <li>
              <Link to="/pagamentos" className="text-blue-500 hover:text-blue-700">
                Pagamentos
              </Link>
            </li>
            <li>
              <Link to="/historico-pagamentos" className="text-blue-500 hover:text-blue-700">
                Histórico
              </Link>
            </li>
          </ul>
        </nav>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Sair
        </button>
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

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* protegidas + layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Clientes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ClienteDetalhes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:id/documentos"
            element={
              <ProtectedRoute>
                <Layout>
                  <ClienteDocumentoPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pagamentos"
            element={
              <ProtectedRoute>
                <Layout>
                  <PagamentoForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/historico-pagamentos"
            element={
              <ProtectedRoute>
                <Layout>
                  <HistoricoPagamentos />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/formas-pagamento"
            element={
              <ProtectedRoute>
                <Layout>
                  <FormaPagamentoForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transportadoras"
            element={
              <ProtectedRoute>
                <Layout>
                  <TransportadoraForm />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dominios"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dominios />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dominios/:id/itens"
            element={
              <ProtectedRoute>
                <Layout>
                  <DominioItens />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* 404 simples */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
