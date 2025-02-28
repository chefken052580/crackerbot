import React from 'react';

const ChatMessage = ({ message, onDownload, onPreview }) => {
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
        return 'text-neon-cyan bg-gray-800';
      case 'error':
        return 'text-neon-red bg-gray-800';
      case 'progress':
        const percentage = parseInt(message.text.match(/\d+%/)?.[0] || "0");
        const colorIntensity = Math.floor((percentage / 100) * 255);
        return `bg-gray-800 font-mono text-[rgb(${colorIntensity},${255 - colorIntensity},0)]`;
      case 'download':
        return 'text-neon-cyan bg-gray-800';
      case 'question':
        return 'text-[#ADD8E6] bg-gray-800';
      default:
        return 'text-gray-300 bg-gray-800';
    }
  };

  const handleDownloadClick = (fileName, fileContent) => {
    const extension = fileName.split('.').pop().toLowerCase();
    let blob;
    if (extension === 'zip') {
      try {
        const byteCharacters = atob(fileContent);
        console.log('Base64 decoded length:', byteCharacters.length);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'application/zip' });
        console.log('Zip Blob size:', blob.size);
      } catch (e) {
        console.error('Error decoding base64 zip:', e.message);
        alert('Failed to decode zip file—check console for details!');
        return;
      }
    } else {
      blob = new Blob([fileContent], { 
        type: {
          'html': 'text/html',
          'js': 'application/javascript',
          'py': 'text/x-python',
          'php': 'application/x-httpd-php',
          'rb': 'text/x-ruby',
          'java': 'text/x-java-source',
          'cpp': 'text/x-c++src'
        }[extension] || 'text/plain' 
      });
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={`p-2 mb-2 rounded-md ${getMessageStyle(message.type)} break-words whitespace-pre-wrap`}>
      <strong>{message.user}: </strong>
      {message.type === "progress" ? (
        <>
          {message.text}
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
            <div
              className="bg-neon-green h-2.5 rounded-full"
              style={{ width: `${parseInt(message.text.match(/\d+%/)?.[0] || "0")}%` }}
            ></div>
          </div>
        </>
      ) : message.type === "download" || (message.type === "success" && message.fileContent) ? (
        <>
          {message.text}
          {onPreview && (
            <button
              onClick={() => onPreview(message.fileContent)}
              className="text-neon-blue underline hover:text-neon-green ml-2"
            >
              Preview
            </button>
          )}
          <button
            onClick={() => handleDownloadClick(message.fileName || `${message.taskId || 'file'}.html`, message.fileContent)}
            className="text-neon-yellow underline hover:text-neon-green ml-2"
          >
            Download {message.fileName}
          </button>
        </>
      ) : (
        message.text
      )}
    </div>
  );
};

export default ChatMessage;