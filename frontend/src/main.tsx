// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { ToasterProvider } from "./lib/toast";
import { bindNotifier } from "./services/api";
import { NotifyBridge } from "./lib/notify-bridge";

// liga o notify() global do axios aos toasts
bindNotifier(NotifyBridge);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToasterProvider>
          <App />
        </ToasterProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
