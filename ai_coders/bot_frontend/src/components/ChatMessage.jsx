// bot_frontend/src/components/ChatMessage.jsx
import React, { useEffect, useState } from 'react';

const ChatMessage = ({ message, onPreview, onOptionClick, colorScheme }) => {
  const [progress, setProgress] = useState(0); // Single progress state
  const [displayText, setDisplayText] = useState(message.text);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  // Unified progress and completion handling
  useEffect(() => {
    if (message.type === 'progress') {
      setProgress(message.progress);
      setDisplayText(message.text);
      if (message.progress === 100) {
        setIsComplete(true);
        setIsVisible(true); // Persist at 100% instead of hiding
      }
    } else if (message.type === 'download' || message.type === 'success') {
      setIsVisible(true); // Ensure download/success messages are visible
    }
  }, [message.progress, message.text, message.type]);

  // Dynamic message styling based on type and color scheme
  const getMessageStyle = (type) => {
    if (type === 'progress') {
      return `${colorScheme.progress} font-mono transition-all duration-300 ease-in-out`;
    }
    return `${colorScheme[type] || colorScheme.text} ${colorScheme.chatBg} rounded-md shadow-md`;
  };

  // Enhanced download handler with MIME type support and error resilience
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
        'zip': 'application/zip',
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

  // Parse options for post-task actions
  const parseOptions = (text, predefinedOptions) => {
    return predefinedOptions || [];
  };

  const options = (message.type === 'question' || message.type === 'success')
    ? parseOptions(message.text, message.options)
    : [];
  const displayUser = message.from || message.user || message.userId || 'Admin';

  if (!isVisible) return null;

  return (
    <div
      className={`p-3 mb-3 rounded-lg ${getMessageStyle(
        message.type
      )} break-words whitespace-pre-wrap flex flex-col justify-between items-start animate-fadeIn`}
    >
      <div className="w-full">
        <strong className="text-lg">{displayUser}: </strong>
        {message.type === 'progress' ? (
          <>
            <div className="text-sm">{displayText}</div>
            <div className="w-full bg-gray-800 rounded-full h-4 mt-2 overflow-hidden shadow-inner">
              <div
                className="h-4 bg-gradient-to-r from-neon-green via-neon-yellow to-neon-red transition-all duration-500 ease-in-out"
                style={{
                  width: `${progress}%`,
                  animation: progress < 100 ? 'pulse 1.5s infinite' : 'glow 2s infinite',
                }}
              />
            </div>
            <div className="text-xs text-center mt-1">{progress}%</div>
          </>
        ) : (
          <>
            <div className="text-sm">{displayText}</div>
            {message.downloadUrl && (
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = message.downloadUrl;
                  link.download = message.fileName || `${message.taskName || 'file'}.${message.taskType || 'txt'}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className={`${colorScheme.accent} underline hover:text-neon-green ml-2 px-2 py-1 rounded hover:bg-opacity-80 transition-all`}
                aria-label={`Download ${message.fileName || 'file'}`}
              >
                Download {message.fileName || 'file'}
              </button>
            )}
            {(message.type === 'download' || (isComplete && message.fileContent)) && (
              <div className="flex flex-col gap-2">
                {onPreview && message.fileContent && (
                  <button
                    onClick={() => onPreview(message.fileContent)}
                    className={`${colorScheme.accent} underline hover:text-neon-green px-3 py-1 rounded hover:bg-opacity-80 transition-transform transform hover:scale-105`}
                    aria-label={`Preview ${message.fileName || 'file'}`}
                  >
                    Preview
                  </button>
                )}
                {message.fileContent && (
                  <button
                    onClick={() =>
                      handleDownloadClick(
                        message.fileName || `${message.taskId || 'file'}.${message.taskType || 'txt'}`,
                        message.fileContent
                      )
                    }
                    className={`${colorScheme.accent} underline hover:text-neon-green px-3 py-1 rounded hover:bg-opacity-80 transition-transform transform hover:scale-105`}
                    aria-label={`Download ${message.fileName || 'file'}`}
                  >
                    Download {message.fileName || 'file'}
                  </button>
                )}
              </div>
            )}
            {(message.type === 'question' || message.type === 'success') && options.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOptionClick(option)}
                    className={`${colorScheme.bubble} px-4 py-1 rounded-full text-sm cursor-pointer hover:bg-opacity-90 transition-all transform hover:scale-105`}
                    aria-label={`Select ${option}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <span className="text-xs text-gray-400 mt-1">{message.timestamp || new Date().toLocaleTimeString()}</span>
    </div>
  );
};

// Inline CSS animations for enhanced visual flair
const styles = `
  @keyframes pulse {
    0% { box-shadow: 0 0 5px rgba(0, 255, 0, 0.5); }
    50% { box-shadow: 0 0 15px rgba(255, 255, 0, 0.8); }
    100% { box-shadow: 0 0 5px rgba(0, 255, 0, 0.5); }
  }
  @keyframes glow {
    0% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
    50% { box-shadow: 0 0 20px rgba(255, 255, 0, 1); }
    100% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
  }
  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-in-out;
  }
`;
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default ChatMessage;