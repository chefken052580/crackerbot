import React from 'react';

const ChatMessage = ({ message, onPreview, onOptionClick, colorScheme }) => {
  const getMessageStyle = (type) => {
    if (type === "progress") {
      const percentage = parseInt(message.text.match(/\d+%/)?.[0] || "0");
      const colorIntensity = Math.floor((percentage / 100) * 255);
      return `${colorScheme.progress} font-mono text-[rgb(${colorIntensity},${255 - colorIntensity},0)]`;
    }
    return colorScheme[type] || `${colorScheme.text} ${colorScheme.chatBg}`;
  };

  const handleDownloadClick = (fileName, fileContent) => {
    const extension = fileName.split('.').pop().toLowerCase();
    let blob;

    if (typeof fileContent === 'string' && !fileContent.match(/^[A-Za-z0-9+/=]+$/)) {
      alert(`Cannot download ${fileName}: ${fileContent}`);
      return;
    }

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
      const mimeTypes = {
        'html': 'text/html',
        'js': 'application/javascript',
        'py': 'text/x-python',
        'php': 'application/x-httpd-php',
        'rb': 'text/x-ruby',
        'java': 'text/x-java-source',
        'cpp': 'text/x-c++src',
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'csv': 'text/csv',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'gif': 'image/gif',
        'mp4': 'video/mp4'
      };
      const mimeType = mimeTypes[extension] || 'application/octet-stream';
      try {
        blob = ['png', 'jpg', 'gif', 'pdf', 'mp4'].includes(extension)
          ? new Blob([Uint8Array.from(atob(fileContent), c => c.charCodeAt(0))], { type: mimeType })
          : new Blob([fileContent], { type: mimeType });
      } catch (e) {
        console.error(`Error creating blob for ${extension}:`, e.message);
        alert(`Failed to download ${fileName}—check console! Likely not a binary file.`);
        return;
      }
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
    if (predefinedOptions) return predefinedOptions;
    const optionPatterns = [
      /HTML, JS, Python, PHP, Ruby, Java, C\+\+, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4/i,
      /network or features/i,
      /mainnet-beta, testnet, devnet, or none/i,
      /add more, edit, or done/i,
      /go/i
    ];
    for (const pattern of optionPatterns) {
      const match = text.match(pattern);
      if (match) return match[0].split(/,\s*(?:or\s*)?/).map(opt => opt.trim());
    }
    return [];
  };

  const options = message.type === "question" ? parseOptions(message.text, message.options) : [];
  const displayUser = message.from || message.user || message.userId || "Admin";

  return (
    <div className={`p-2 mb-2 rounded-md ${getMessageStyle(message.type)} break-words whitespace-pre-wrap flex justify-between items-start`}>
      <div>
        <strong>{displayUser}: </strong>
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
                className={`${colorScheme.accent} underline hover:text-neon-green ml-2`}
              >
                Preview
              </button>
            )}
            <button
              onClick={() => handleDownloadClick(message.fileName || `${message.taskId || 'file'}.html`, message.fileContent)}
              className={`${colorScheme.accent} underline hover:text-neon-green ml-2`}
            >
              Download {message.fileName}
            </button>
          </>
        ) : message.type === "question" && options.length > 0 ? (
          <>
            {message.text.split(options.join(', '))[0]}
            <div className="flex flex-wrap gap-2 mt-1">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => onOptionClick(option === "custom" ? "custom " : option)}
                  className={`${colorScheme.bubble} px-3 py-1 rounded-full text-sm cursor-pointer`}
                >
                  {option}
                </button>
              ))}
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