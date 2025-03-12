import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./redux/store.js"; // Ensure this path matches your project structure
import "./index.css"; // Import Tailwind CSS or other global styles
import App from "./App";

// Log immediately to confirm the script is running
console.log("index.jsx: Script loaded");

async function main() {
  console.log("index.jsx: Starting main()");

  // Polyfill for structuredClone if not supported natively
  if (!globalThis.structuredClone) {
    console.warn("index.jsx: structuredClone not supported. Loading polyfill...");
    try {
      const { structuredClone } = await import("structured-clone");
      globalThis.structuredClone = structuredClone;
      console.log("index.jsx: Polyfill loaded successfully");
    } catch (e) {
      console.error("index.jsx: Failed to load structuredClone polyfill:", e);
      document.body.innerHTML = `<p style="color: red;">Polyfill Error: ${e.message}</p>`;
      return;
    }
  } else {
    console.log("index.jsx: Native structuredClone detected, skipping polyfill");
  }

  // Check for the root element
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("index.jsx: Root element not found.");
    document.body.innerHTML = `<p style="color: red;">Error: Root element '#root' not found</p>`;
    return;
  }
  console.log("index.jsx: Root element found");

  // Render the app with error handling
  try {
    const root = ReactDOM.createRoot(rootElement);
    console.log("index.jsx: React root created");
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Provider>
      </React.StrictMode>
    );
    console.log("index.jsx: React root rendered with App");
  } catch (e) {
    console.error("index.jsx: Render error:", e);
    document.body.innerHTML = `<p style="color: red;">Render Error: ${e.message}</p>`;
  }
}

// ErrorBoundary component to catch and display rendering errors
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    console.error("index.jsx: ErrorBoundary caught error during render:", error);
    return { error: error.message };
  }

  componentDidCatch(error, errorInfo) {
    console.error("index.jsx: ErrorBoundary detailed catch:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "red", padding: "20px" }}>
          <p>Application Error: {this.state.error}</p>
          <p>Please check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Run the main function and catch any initialization errors
main().catch((e) => {
  console.error("index.jsx: Error in main:", e);
  document.body.innerHTML = `<p style="color: red;">Main Error: ${e.message}</p>`;
});

// Log when the script finishes loading
console.log("index.jsx: Script fully loaded and executed");