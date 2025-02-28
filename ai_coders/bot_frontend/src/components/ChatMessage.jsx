import React from 'react';

const ChatMessage = ({ message, onDownload }) => {
  const getMessageStyle = (type) => {
    switch (type) {
      case 'user':
        return 'text-neon-yellow bg-gray-700';
      case 'bot':
        return 'text-neon-green bg-gray-800';
      case 'system':
        return 'text-neon-blue bg-gray-900 italic';
      case 'command':
        return 'text-neon-purple bg-gray-700';
      case 'success':
        return 'text-neon-cyan bg-gray-800'; // Light blue for success
      case 'error':
        return 'text-neon-red bg-gray-800';
      case 'progress':
        const percentage = parseInt(message.text.match(/\d+%/)?.[0] || "0");
        const colorIntensity = Math.floor((percentage / 100) * 255);
        return `bg-gray-800 font-mono text-[rgb(${colorIntensity},${255 - colorIntensity},0)]`;
      case 'download':
        return 'text-neon-cyan bg-gray-800'; // Light blue for download
      default:
        return 'text-gray-300 bg-gray-800';
    }
  };

  return (
    <div className={`p-2 mb-2 rounded-md ${getMessageStyle(message.type)} break-words whitespace-pre-wrap`}>
      <strong>{message.user}: </strong>
      {message.type === "download" || (message.type === "success" && message.fileContent) ? (
        <>
          {message.text} <button onClick={onDownload} className="text-neon-yellow underline hover:text-neon-green ml-2">Download {message.fileName}</button>
        </>
      ) : (
        message.text
      )}
    </div>
  );
};

export default ChatMessage;