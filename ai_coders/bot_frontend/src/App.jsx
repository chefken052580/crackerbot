import React from "react";
import ChatRoom from "@components/ChatRoom";

console.log("App.jsx: Module loaded");

const App = () => {
  console.log("App.jsx: App component initializing");
  console.log("App.jsx: Rendering App component");
  return (
    <div>
      <ChatRoom />
    </div>
  );
};

export default App;