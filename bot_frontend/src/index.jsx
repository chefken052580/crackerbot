import 'structured-clone'; // Import the main module

import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import "./index.css"; // Tailwind CSS and global styles
import App from "./App";

async function main() {
  // Ensure structuredClone is available, polyfill if not
  if (!globalThis.structuredClone) {
    console.warn("structuredClone is not supported. Loading polyfill...");
    await import("structured-clone").then(({ structuredClone }) => {
      globalThis.structuredClone = structuredClone;
    });
  }

  const rootElement = document.getElementById("root");

  if (!rootElement) {
    console.error("Root element not found. Please ensure your HTML has a 'root' element.");
    return;
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
}

main().catch(e => console.error("Error in main:", e));