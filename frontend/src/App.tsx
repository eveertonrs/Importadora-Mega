// src/App.tsx
import "./index.css";
import type { ReactNode } from "react";
import { Routes, Route, NavLink, Navigate, Outlet } from "react-router-dom";

import ErrorBoundary from "./components/ErrorBoundary";

// públicas
import Login from "./components/Login";

// home (dashboard)
import Home from "./components/Home";

// clientes
import Clientes from "./components/Clientes";
import ClienteForm from "./components/ClienteForm";
import ClienteDetalhes from "./components/ClienteDetalhes";
import ClienteDocumentoForm from "./components/ClienteDocumentoForm";

// financeiro
import PagamentoForm from "./components/PagamentoForm";
import HistoricoPagamentos from "./components/HistoricoPagamentos";
import FormaPagamentoForm from "./components/PedidoParametrosPage";

// auxiliares
import TransportadoraForm from "./components/TransportadoraForm";
import Dominios from "./components/Dominios";
import DominioItens from "./components/DominioItens";
import DominioForm from "./components/DominioForm";

// blocos
import Blocos from "./components/ui/Blocos";
import BlocoDetalhe from "./components/ui/BlocoDetalhe";

// ui
import Button from "./components/ui/button";

// auth
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// toast bridge
import { NotifyBridge } from "./lib/notify-bridge";

// financeiro (novas telas)
import FinanceiroReceber from "./components/FinanceiroReceber";
import Conferencia from "./components/financeiro/Conferencia";
import { useState } from "react";

// usuários (gestão)
import Register from "./components/Register";          // /usuarios/novo
import UsuariosList from "./components/UsuariosList";  // /usuarios
import UsuarioEdit from "./components/UsuarioEdit";    // /usuarios/:id/editar

/* ---------------- Layout ---------------- */
const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Navegação dinâmica por papel
  const isAdmin = user?.permissao === "admin";
  const isAdministrativo = user?.permissao === "administrativo";

  const navItems = [
    { to: "/", label: "Início", show: true },
    { to: "/blocos", label: "Blocos", show: true },
    { to: "/clientes", label: "Clientes", show: true },
    { to: "/transportadoras", label: "Transportadoras", show: true },
    // Itens que o "administrativo" NÃO pode ver
    { to: "/formas-pagamento", label: "Parâmetros do pedido", show: !isAdministrativo },
    { to: "/financeiro/receber", label: "Financeiro", show: !isAdministrativo },
    { to: "/financeiro/conferencia", label: "Conferência", show: !isAdministrativo },
    { to: "/historico-pagamentos", label: "Histórico", show: !isAdministrativo },
    // Usuários — só admin
    ...(isAdmin ? [{ to: "/usuarios", label: "Usuários", show: true }] : []),
  ].filter((i) => i.show);

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        {/* hairline com “degradê” */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            {/* Brand + usuário */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center shadow-sm">
                <span className="text-[11px] font-bold">MEGA</span>
              </div>
              <div className="leading-tight">
                <div className="text-sm text-slate-500">Bem-vindo</div>
                <div className="text-base font-semibold text-slate-900">{user?.nome}</div>
              </div>
            </div>

            {/* Botão mobile */}
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menu"
              aria-expanded={open}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {/* Ações à direita */}
            <div className="hidden md:block">
              <Button variant="destructive" size="sm" onClick={logout}>Sair</Button>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 pb-3 md:pb-4">
          <div
            className={[
              "md:flex md:flex-wrap md:items-center md:gap-2",
              open ? "block" : "hidden md:block",
            ].join(" ")}
          >
            {/* scroller horizontal quando necessário */}
            <ul className="flex gap-2 overflow-x-auto no-scrollbar py-2 md:py-0">
              {navItems.map((item) => (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        "inline-flex items-center rounded-xl px-3 py-1.5 text-sm transition-colors border",
                        "focus:outline-none focus:ring-2 focus:ring-slate-300",
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}

              {/* botão sair visível no mobile dentro do menu */}
              <li className="md:hidden ml-auto">
                <button
                  onClick={logout}
                  className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700"
                >
                  Sair
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* sombra suave separando conteúdo */}
        <div className="h-[10px] w-full bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
};

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

export default function App() {
  return (
    <ErrorBoundary>
      <NotifyBridge />

      <Routes>
        {/* públicas */}
        <Route path="/login" element={<Login />} />

        {/* protegidas */}
        <Route element={<ProtectedArea />}>
          <Route path="/" element={<Home />} />

          {/* Blocos */}
          <Route path="/blocos" element={<Blocos />} />
          <Route path="/blocos/:id" element={<BlocoDetalhe />} />

          {/* Clientes */}
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/novo" element={<ClienteForm />} />
          <Route path="/clientes/:id/editar" element={<ClienteForm />} />
          <Route path="/clientes/:id" element={<ClienteDetalhes />} />
          <Route path="/clientes/:id/documentos" element={<ClienteDocumentoForm />} />

          {/* Domínios */}
          <Route path="/dominios" element={<Dominios />} />
          <Route path="/dominios/novo" element={<DominioForm />} />
          <Route path="/dominios/:id/editar" element={<DominioForm />} />
          <Route path="/dominios/:id/itens" element={<DominioItens />} />

          {/* Financeiro/auxiliares */}
          <Route path="/pagamentos" element={<PagamentoForm />} />
          <Route path="/historico-pagamentos" element={<HistoricoPagamentos />} />
          <Route path="/formas-pagamento" element={<FormaPagamentoForm />} />
          <Route path="/transportadoras" element={<TransportadoraForm />} />

          {/* Financeiro */}
          <Route path="/financeiro/receber" element={<FinanceiroReceber />} />
          <Route path="/financeiro/conferencia" element={<Conferencia />} />

          {/* Usuários — somente ADMIN */}
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <UsuariosList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios/novo"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <Register />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios/:id/editar"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <UsuarioEdit />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
