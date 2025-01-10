import React from "react";

const ChatMessage = ({ message }) => {
  // Determine the message text based on message type
  let messageText;
  switch (message.type) {
    case 'command':
      messageText = message.command ? `Command: ${message.command}` : "Unknown command";
      break;
    case 'response':
      messageText = message.text || "Empty response";
      break;
    case 'general_message':
      messageText = message.text || "Empty message";
      break;
    default:
      messageText = message.text || message.command || "Unknown message type";
  }

  // Combine user information with the message text
  let userText = message.user ? `${message.user}: ` : "System: ";

  return (
    <div className="mb-3">
      <span className="text-neon-green font-semibold">{userText}</span>
      <span className="ml-2">{messageText}</span>
    </div>
  );
};

export default ChatMessage;