import React, { useState } from "react";
import { FiCode, FiMonitor, FiSearch } from "react-icons/fi";
import ChatRoom from "@components/ChatRoom";
import WalletTracker from "@components/WalletTracker";
import TokenScanner from "@components/TokenScanner";

const App = () => {
  const [activeTab, setActiveTab] = useState("chatroom");

  const renderContent = () => {
    switch (activeTab) {
      case "chatroom":
        return <ChatRoom />;
      case "wallet":
        return <WalletTracker />;
      case "token":
        return <TokenScanner />;
      default:
        return <ChatRoom />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 overflow-hidden">
      <aside className="w-64 bg-gray-800 flex flex-col shadow-lg">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-neon-yellow text-center">
            CrackerBot.io
          </h1>
        </div>

        <nav className="flex-1 flex flex-col mt-4 space-y-2">
          <button
            onClick={() => setActiveTab("chatroom")}
            className={`flex items-center p-3 rounded-md ${
              activeTab === "chatroom"
                ? "bg-gray-700 text-neon-green shadow-md"
                : "hover:bg-gray-700 hover:text-neon-yellow transition"
            }`}
          >
            <FiCode size={20} className="mr-3" />
            <span>Ai Coders</span>
          </button>
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex items-center p-3 rounded-md ${
              activeTab === "wallet"
                ? "bg-gray-700 text-neon-green shadow-md"
                : "hover:bg-gray-700 hover:text-neon-yellow transition"
            }`}
          >
            <FiMonitor size={20} className="mr-3" />
            <span>Wallet Tracker</span>
          </button>
          <button
            onClick={() => setActiveTab("token")}
            className={`flex items-center p-3 rounded-md ${
              activeTab === "token"
                ? "bg-gray-700 text-neon-green shadow-md"
                : "hover:bg-gray-700 hover:text-neon-yellow transition"
            }`}
          >
            <FiSearch size={20} className="mr-3" />
            <span>Token Scanner</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-4xl h-full max-h-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 overflow-hidden">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;