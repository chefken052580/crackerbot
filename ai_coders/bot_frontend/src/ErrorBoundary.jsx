// bot_frontend/src/ErrorBoundary.jsx
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error) {
    console.error(`[${new Date().toISOString()}] ⚠️ Top-Level ErrorBoundary caught error: ${error.message}`);
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, info) {
    console.error(`[${new Date().toISOString()}] ⚠️ Top-Level ErrorBoundary details: ${error.message}, Info: ${JSON.stringify(info)}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-screen bg-black text-white p-4">
          <h2>⚠️ Galactic System Failure</h2>
          <p>Error: {this.state.errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-[#ff00ff] to-[#00ffff] text-white rounded-md"
          >
            Reconnect
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;