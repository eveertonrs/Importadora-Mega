import './index.css';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import ErrorBoundary from './components/ErrorBoundary';
import Clientes from './components/Clientes';
import PagamentoForm from './components/PagamentoForm';
import HistoricoPagamentos from './components/HistoricoPagamentos';
import FormaPagamentoForm from './components/FormaPagamentoForm';
import TransportadoraForm from './components/TransportadoraForm';
import ClienteDocumentoForm from './components/ClienteDocumentoForm';
import DominioItens from './components/DominioItens';
import Dominios from './components/Dominios';
import ClienteDetalhes from './components/ClienteDetalhes';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const { id } = useParams<{ id: string }>();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pagamentos" element={<PagamentoForm />} />
          <Route path="/historico-pagamentos" element={<HistoricoPagamentos />} />
          <Route path="/formas-pagamento" element={<FormaPagamentoForm />} />
          <Route path="/transportadoras" element={<TransportadoraForm />} />
          <Route path="/clientes/:id/documentos" element={<ClienteDocumentoForm clienteId={id ?? ""} />} />
          <Route path="/dominios/:id/itens" element={<DominioItens />} />
          <Route path="/dominios" element={<Dominios />} />
          <Route path="/clientes/:id" element={<ClienteDetalhes />} />
          <Route path="/" element={
            <div className="container mx-auto p-4">
              {isAuthenticated ? (
                <div>
                  <header className="flex justify-between items-center mb-6">
                    <h1 className="text-xl">Bem-vindo, {user?.nome}</h1>
                    <nav>
                      <ul className="flex space-x-4">
                        <li>
                          <Link to="/formas-pagamento" className="text-blue-500 hover:text-blue-700">Formas de Pagamento</Link>
                        </li>
                        <li>
                          <Link to="/transportadoras" className="text-blue-500 hover:text-blue-700">Transportadoras</Link>
                        </li>
                        <li>
                          <Link to="/dominios" className="text-blue-500 hover:text-blue-700">Domínios</Link>
                        </li>
                        <li>
                          <Link to="/pagamentos" className="text-blue-500 hover:text-blue-700">Pagamentos</Link>
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
                  <Clientes />
                </div>
              ) : (
                <Login />
              )}
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
