import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { DeveloperModeProvider } from "./context/DeveloperModeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <DeveloperModeProvider>
        <App />
      </DeveloperModeProvider>
    </AuthProvider>
  </StrictMode>
);

