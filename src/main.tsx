import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { waitForWails } from "./lib/wailsapi";
import "./i18n/config";
import { registerGlobalErrorLoggers } from "./lib/errorLog";
import "./styles.css";

registerGlobalErrorLoggers();

// Wait for Wails to be ready before mounting React
waitForWails().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </StrictMode>
  );
});
