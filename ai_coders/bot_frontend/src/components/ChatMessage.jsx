import React, { useEffect, useState } from 'react';

const ChatMessage = ({ message, onPreview, onOptionClick, colorScheme }) => {
  const [progress, setProgress] = useState(message.type === "progress" ? message.progress : 0);
  const [displayText, setDisplayText] = useState(message.text);

  useEffect(() => {
    if (message.type === "progress") {
      setProgress(message.progress);
      setDisplayText(message.text); // No percentage appended, handled by bar
    }
  }, [message.progress, message.text, message.type]);

  const getMessageStyle = (type) => {
    if (type === "progress") {
      return `${colorScheme.progress} font-mono`;
    }
    return colorScheme[type] || `${colorScheme.text} ${colorScheme.chatBg}`;
  };

  const handleDownloadClick = (fileName, fileContent) => {
    const extension = fileName.split('.').pop().toLowerCase();
    let blob;

    try {
      const byteCharacters = atob(fileContent);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const mimeTypes = {
        'html': 'text/html',
        'js': 'application/javascript',
        'py': 'text/x-python',
        'php': 'application/x-httpd-php',
        'rb': 'text/x-ruby',
        'java': 'text/x-java-source',
        'cpp': 'text/x-c++src',
        'ts': 'application/typescript',
        'go': 'text/x-go',
        'rs': 'text/x-rust',
        'kt': 'text/x-kotlin',
        'swift': 'text/x-swift',
        'cs': 'text/x-csharp',
        'r': 'text/x-r',
        'scala': 'text/x-scala',
        'dart': 'application/vnd.dart',
        'pl': 'text/x-perl',
        'lua': 'text/x-lua',
        'sh': 'text/x-shellscript',
        'ps1': 'application/x-powershell',
        'sql': 'text/x-sql',
        'yaml': 'application/x-yaml',
        'xml': 'application/xml',
        'md': 'text/markdown',
        'toml': 'application/toml',
        'jsx': 'text/jsx',
        'vue': 'text/x-vue',
        'dockerfile': 'text/x-dockerfile',
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'csv': 'text/csv',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'zip': 'application/zip'
      };
      const mimeType = mimeTypes[extension] || 'application/octet-stream';
      blob = new Blob([byteNumbers], { type: mimeType });
    } catch (e) {
      console.error(`Error decoding base64 for ${fileName}: ${e.message}`);
      alert(`Failed to download ${fileName}: Invalid file content. Check console for details.`);
      return;
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

  const parseOptions = (text, predefinedOptions) => {
    return predefinedOptions || [];
  };

  const options = (message.type === "question" || message.type === "success") ? 
    parseOptions(message.text, message.options) : [];
  const displayUser = message.from || message.user || message.userId || "Admin";

  return (
    <div className={`p-2 mb-2 rounded-md ${getMessageStyle(message.type)} break-words whitespace-pre-wrap flex justify-between items-start`}>
      <div>
        <strong>{displayUser}: </strong>
        {message.type === "progress" ? (
          <>
            {displayText}
            <div className="w-full bg-gray-700 rounded-full h-3 mt-1 overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-neon-green via-neon-yellow to-neon-red transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%`, animation: progress < 100 ? 'pulse 1.5s infinite' : 'none' }}
              ></div>
            </div>
          </>
        ) : message.type === "download" || (message.type === "success" && message.fileContent) ? (
          <>
            {message.text}
            {onPreview && message.fileContent && (
              <button
                onClick={() => onPreview(message.fileContent)}
                className={`${colorScheme.accent} underline hover:text-neon-green ml-2`}
                aria-label={`Preview ${message.fileName || 'file'}`}
              >
                Preview
              </button>
            )}
            {message.fileContent && (
              <button
                onClick={() => handleDownloadClick(message.fileName || `${message.taskId || 'file'}.${message.type === 'zip' ? 'zip' : 'txt'}`, message.fileContent)}
                className={`${colorScheme.accent} underline hover:text-neon-green ml-2`}
                aria-label={`Download ${message.fileName || 'file'}`}
              >
                Download {message.fileName || 'file'}
              </button>
            )}
          </>
        ) : (message.type === "question" || message.type === "success") && options.length > 0 ? (
          <>
            {message.text}
            <div className="flex flex-wrap gap-2 mt-1">
              {options.length === 1 ? (
                <span className={`${colorScheme.bubble} px-3 py-1 rounded-full text-sm`}>{options[0]}</span>
              ) : (
                options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOptionClick(option)}
                    className={`${colorScheme.bubble} px-3 py-1 rounded-full text-sm cursor-pointer`}
                    aria-label={`Select ${option}`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          message.text
        )}
      </div>
      <span className="text-xs text-gray-500 ml-2">{message.timestamp}</span>
    </div>
  );
};

export default ChatMessage;