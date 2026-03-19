import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { waitForWails } from "./lib/wailsapi";
import "./i18n/config";
import "./styles.css";

// Wait for Wails to be ready before mounting React
waitForWails().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  );
});
