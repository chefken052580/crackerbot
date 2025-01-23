import React from "react";

const Sidebar = ({ onTabClick }) => {
  return (
    <div className="h-screen w-64 bg-black text-gray-200 border-r border-gray-700 shadow-lg">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-neon-yellow">CrackerBot.io</h1>
      </div>

      {/* Navigation Tabs */}
      <nav className="mt-6">
        <ul>
          <li
            className="px-6 py-3 hover:bg-gray-800 cursor-pointer"
            onClick={() => onTabClick("Ai Coders")}
          >
            AI Coders
          </li>
          <li
            className="px-6 py-3 hover:bg-gray-800 cursor-pointer"
            onClick={() => onTabClick("Wallet Tracker")}
          >
            Wallet Tracker
          </li>
          <li
            className="px-6 py-3 hover:bg-gray-800 cursor-pointer"
            onClick={() => onTabClick("Token Scanner")}
          >
            Token Scanner
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
