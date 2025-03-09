import 'structured-clone';
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import "./index.css";
import App from "./App";

async function main() {
  console.log("index.jsx: Starting main()");

  if (!globalThis.structuredClone) {
    console.warn("index.jsx: structuredClone not supported. Loading polyfill...");
    try {
      await import("structured-clone").then(({ structuredClone }) => {
        globalThis.structuredClone = structuredClone;
        console.log("index.jsx: Polyfill loaded successfully");
      });
    } catch (e) {
      console.error("index.jsx: Failed to load structuredClone polyfill:", e);
      return;
    }
  } else {
    console.log("index.jsx: Native structuredClone detected, skipping polyfill");
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("index.jsx: Root element not found. Check HTML for 'root' element.");
    return;
  }
  console.log("index.jsx: Root element found");

  const root = ReactDOM.createRoot(rootElement);
  console.log("index.jsx: React root created");

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
  console.log("index.jsx: React root rendered with App");
}

main().catch(e => console.error("index.jsx: Error in main:", e));