import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import "./index.css"; // Tailwind CSS and global styles
import App from "./App";

async function main() {
  if (!globalThis.structuredClone) {
    console.warn("structuredClone is not supported. Loading polyfill...");
    await import("structured-clone");
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

main();