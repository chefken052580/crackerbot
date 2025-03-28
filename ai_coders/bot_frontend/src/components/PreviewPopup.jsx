// ai_coders/bot_frontend/src/components/PreviewPopup.jsx
// Version: v2025-03-28-8
/* CrackerBot’s cosmic preview portal—unzip, view, edit, and blast off with interstellar flair! 🌌 */
import React, { useEffect, useState, useCallback } from 'react';
import JSZip from 'jszip';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-monokai';

/**
 * PreviewPopup component for viewing and editing task files with AI assistance.
 * @param {string} fileContent - Base64-encoded ZIP content
 * @param {string} fileName - Name of the ZIP file
 * @param {Function} onClose - Callback to close the popup
 * @param {Object} socket - WebSocket instance for communication
 * @param {Object} postTaskOptions - Task metadata (taskId, taskName, etc.)
 * @param {Function} setMessages - Function to update the message list
 * @returns {JSX.Element} The preview popup component
 */
const PreviewPopup = ({ fileContent, fileName, onClose, socket, postTaskOptions, setMessages }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [cssContent, setCssContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [progress, setProgress] = useState(0);
  const userName = localStorage.getItem('userName') || 'Guest';

  /**
   * Logs a message with timestamp for debugging.
   * @param {string} msg - Message to log
   */
  const logMessage = useCallback((msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }, []);

  useEffect(() => {
    /**
     * Loads and processes the ZIP file content into viewable files.
     */
    const loadFiles = async () => {
      setIsLoading(true);
      setProgress(10);
      if (!fileContent) {
        setError(`No content provided for "${fileName}"—cosmic void detected!`);
        logMessage(`No fileContent for ${fileName}`);
        setIsLoading(false);
        setProgress(0);
        return;
      }

      try {
        logMessage(`Loading ZIP for ${fileName}: ${fileContent.substring(0, 50)}...`);
        const zip = new JSZip();
        setProgress(20);
        await zip.loadAsync(fileContent, { base64: true });

        const fileList = [];
        let htmlFiles = [];
        let cssFiles = {};

        let fileCount = 0;
        const totalFiles = Object.keys(zip.files).length;
        for (const [name, file] of Object.entries(zip.files)) {
          if (!file.dir) {
            fileCount++;
            setProgress(20 + Math.floor((fileCount / totalFiles) * 60));
            const ext = name.split('.').pop().toLowerCase();
            const buffer = await file.async('arraybuffer');
            let content = await file.async('string');
            const mimeType = {
              html: 'text/html',
              css: 'text/css',
              js: 'application/javascript',
              jsx: 'application/javascript',
              ts: 'application/javascript',
              vue: 'application/javascript',
              md: 'text/markdown',
              txt: 'text/plain',
              csv: 'text/csv',
              json: 'application/json',
              xml: 'application/xml',
              yaml: 'application/x-yaml',
              toml: 'application/toml',
              sh: 'text/x-sh',
              ps1: 'text/x-powershell',
              sql: 'text/x-sql',
              dockerfile: 'text/x-dockerfile',
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              gif: 'image/gif',
              svg: 'image/svg+xml',
              webp: 'image/webp',
              pdf: 'application/pdf',
              mp4: 'video/mp4',
              mp3: 'audio/mpeg',
              wav: 'audio/wav',
              exe: 'application/octet-stream',
              bat: 'text/x-batch',
              py: 'text/x-python',
              php: 'application/x-httpd-php',
              rb: 'text/x-ruby',
              java: 'text/x-java-source',
              cpp: 'text/x-c++src',
              go: 'text/x-go',
              rs: 'text/x-rustsrc',
              kt: 'text/x-kotlin',
              swift: 'text/x-swift',
              cs: 'text/x-csharp',
              r: 'text/x-rsrc',
              scala: 'text/x-scala',
              dart: 'text/x-dart',
              pl: 'text/x-perl',
              lua: 'text/x-lua',
              zip: 'application/zip',
            }[ext] || 'application/octet-stream';

            if (ext === 'html' && !content.includes('<html')) {
              content = `<!DOCTYPE html><html><head><title>${name}</title></head><body><h1>${name} Preview</h1><p>Content incomplete—CrackerBot added a cosmic placeholder!</p></body></html>`;
              logMessage(`Enhanced incomplete HTML: ${name}`);
            } else if (ext === 'css' && !content.trim().startsWith('{') && !content.includes('}')) {
              content = `/* CrackerBot CSS Fallback */\nbody { background: #0a0a23; color: #00ff00; font-family: 'Courier New', monospace; }`;
              logMessage(`Added fallback CSS: ${name}`);
            }

            const blob = new Blob([buffer], { type: mimeType });
            const url = URL.createObjectURL(blob);
            fileList.push({ name, blob, url, ext, mimeType, content });

            if (ext === 'html') {
              htmlFiles.push({ name, content, url });
            } else if (ext === 'css') {
              cssFiles[name] = content;
            }
            logMessage(`Extracted file: ${name} (${ext}), content length: ${content.length}`);
          }
        }

        if (fileList.length === 0) {
          throw new Error('No files found in ZIP—cosmic void detected!');
        }

        setProgress(80);
        for (const htmlFile of htmlFiles) {
          let enhancedHtml = htmlFile.content;
          const cssLinks = enhancedHtml.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/g) || [];
          for (const link of cssLinks) {
            const hrefMatch = link.match(/href="([^"]+\.css)"/);
            if (hrefMatch) {
              const cssPath = hrefMatch[1];
              const cssContent = cssFiles[cssPath];
              if (cssContent) {
                enhancedHtml = enhancedHtml.replace(
                  link,
                  `<style>/* CrackerBot’s Cosmic CSS Injection */\n${cssContent}\n</style>`
                );
              }
            }
          }
          const jsLinks = enhancedHtml.match(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g) || [];
          for (const link of jsLinks) {
            const srcMatch = link.match(/src="([^"]+\.js)"/);
            if (srcMatch) {
              const jsPath = srcMatch[1];
              const jsFile = fileList.find(f => f.name === jsPath);
              if (jsFile) {
                enhancedHtml = enhancedHtml.replace(
                  link,
                  `<script>/* CrackerBot’s Cosmic JS Injection */\n${jsFile.content}\n</script>`
                );
              }
            }
          }
          const enhancedBlob = new Blob([enhancedHtml], { type: 'text/html' });
          const enhancedUrl = URL.createObjectURL(enhancedBlob);
          const htmlIndex = fileList.findIndex((f) => f.name === htmlFile.name);
          if (htmlIndex !== -1) {
            fileList[htmlIndex].url = enhancedUrl;
            fileList[htmlIndex].content = enhancedHtml;
            logMessage(`Enhanced ${htmlFile.name} with inline CSS/JS`);
          }
        }

        setFiles(fileList);
        setCssContent(Object.values(cssFiles).join('\n') || '/* No CSS files found—pure cosmic vibes! */');
        setError(null);

        const htmlIndex = fileList.findIndex(f => f.name.toLowerCase() === 'index.html');
        if (htmlIndex !== -1) setActiveTab(htmlIndex);

        logMessage(`Loaded ${fileList.length} files for ${fileName}`);
        setProgress(100);
        setIsLoading(false);

        return () => {
          fileList.forEach((f) => URL.revokeObjectURL(f.url));
        };
      } catch (e) {
        setError(`Preview failed for "${fileName}": ${e.message}—cosmic glitch detected! 💾`);
        setMessages((prev) => [
          ...prev,
          {
            from: 'System',
            text: `Preview failed for "${fileName}": ${e.message}—cosmic glitch detected! Retry or tweak it! 💾`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        logMessage(`Preview error: ${e.message}`);
        setIsLoading(false);
        setProgress(0);
      }
    };
    loadFiles();
  }, [fileContent, fileName, setMessages, logMessage]);

  useEffect(() => {
    /**
     * Listens for AI suggestion responses from bot_lead.
     */
    const handleAiSuggestion = (data) => {
      if (data.taskId === postTaskOptions?.taskId && data.fileName === files[activeTab]?.name) {
        setAiSuggestion(data.suggestion);
        logMessage(`Received AI suggestion for ${data.fileName}: ${data.suggestion.substring(0, 50)}...`);
      }
    };

    socket.on('ai_suggestion', handleAiSuggestion);
    return () => {
      socket.off('ai_suggestion', handleAiSuggestion);
    };
  }, [socket, postTaskOptions, files, activeTab]);

  /**
   * Downloads the edited files as a ZIP.
   */
  const handleDownload = async () => {
    setProgress(10);
    if (!fileContent && files.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'System',
          text: `No content to download for "${fileName}"—cosmic void detected!`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setProgress(0);
      return;
    }
    const newZip = new JSZip();
    files.forEach(({ name, content }, idx) => {
      newZip.file(name, content);
      setProgress(10 + Math.floor(((idx + 1) / files.length) * 80));
    });
    const updatedZip = await newZip.generateAsync({ type: 'base64' });
    const link = document.createElement('a');
    link.href = `data:application/zip;base64,${updatedZip}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logMessage(`Downloaded updated ZIP for ${fileName}`);
    setMessages((prev) => [
      ...prev,
      {
        from: 'System',
        text: `Downloaded updated "${fileName}"—your cosmic edits are beaming down! 📡`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  };

  /**
   * Saves the edited files to Redis and closes the popup.
   */
  const handleDone = async () => {
    setProgress(10);
    if (files.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'System',
          text: `No content to save for "${fileName}"—cosmic void detected!`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setProgress(0);
      return;
    }
    const newZip = new JSZip();
    files.forEach(({ name, content }, idx) => {
      newZip.file(name, content);
      setProgress(10 + Math.floor(((idx + 1) / files.length) * 80));
    });
    const reZippedContent = await newZip.generateAsync({ type: 'base64' });
    const taskId = postTaskOptions?.taskId || Date.now().toString();

    socket.emit('message', {
      text: 'store_project',
      type: 'command',
      commandFlag: true,
      target: 'bot_lead',
      taskId,
      frontendId: socket.id,
      user: userName,
      userId: socket.id,
      ip: window.location.hostname,
      taskName: postTaskOptions?.taskName || fileName.replace('.zip', ''),
      taskType: postTaskOptions?.taskType || 'unknown',
      taskFeatures: postTaskOptions?.taskFeatures || 'unknown',
      finalContent: reZippedContent,
    });

    setMessages((prev) => [
      ...prev,
      {
        from: 'System',
        user: userName,
        text: `"${fileName}" locked in the cosmic vault as project:${userName}:${taskId}! Fetch with /projects. 🏆`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString(),
        className: 'animate-supernova',
      },
    ]);

    logMessage(`Saved project:${userName}:${taskId} to Redis`);
    setProgress(100);
    setTimeout(() => {
      setProgress(0);
      onClose();
    }, 500);
  };

  /**
   * Restarts the task build process.
   */
  const handleRestart = () => {
    const taskId = postTaskOptions?.taskId;
    if (!taskId) return;
    socket.emit('message', {
      text: `/restart ${taskId}`,
      type: 'command',
      commandFlag: true,
      target: 'bot_lead',
      taskId,
      frontendId: socket.id,
      user: userName,
      userId: socket.id,
      ip: window.location.hostname,
    });
    setMessages((prev) => [
      ...prev,
      {
        from: 'System',
        text: `Restarting "${fileName}"—warping back to the cosmic forge! 🔄`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    onClose();
  };

  /**
   * Refines the project, prompting for new features.
   */
  const handleRefine = () => {
    const taskId = postTaskOptions?.taskId;
    if (!taskId) return;
    socket.emit('message', {
      text: 'Refine Project',
      type: 'task_response',
      taskId,
      frontendId: socket.id,
      user: userName,
      userId: socket.id,
      ip: window.location.hostname,
      commandFlag: true,
      target: 'bot_lead',
    });
    setMessages((prev) => [
      ...prev,
      {
        from: 'System',
        text: `Refining "${fileName}"—adding supernova flair to your cosmic creation! ✨`,
        type: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    onClose();
  };

  /**
   * Updates file content and requests AI suggestion from bot_lead.
   * @param {string} newContent - Updated content from AceEditor
   */
  const handleContentChange = (newContent) => {
    const updatedFiles = files.map((file, idx) =>
      idx === activeTab ? { ...file, content: newContent } : file
    );
    setFiles(updatedFiles);
    setCssContent(newContent);
    if (files[activeTab].ext === 'html') {
      updateLivePreview(updatedFiles, activeTab);
    }
    const prompt = `Yo CrackerBot, enhance this ${files[activeTab].ext} code for ${userName}: "${newContent.substring(0, 200)}...". Add MAXIMUM cosmic flair—neon animations, glowing effects, or epic logic twists! Return VALID code only with flair-filled comments!`;
    socket.emit('message', {
      text: prompt,
      type: 'command',
      commandFlag: true,
      target: 'bot_lead',
      taskId: postTaskOptions?.taskId,
      fileName: files[activeTab].name,
      frontendId: socket.id,
      user: userName,
      userId: socket.id,
      ip: window.location.hostname,
    });
    setAiSuggestion('CrackerBot’s AI is brewing cosmic enhancements—stand by! 🌠');
    logMessage(`Requested AI suggestion for ${files[activeTab].name}`);
  };

  /**
   * Applies the AI suggestion to the current file content.
   */
  const suggestChanges = () => {
    if (!aiSuggestion || aiSuggestion === 'CrackerBot’s AI is brewing cosmic enhancements—stand by! 🌠') return;
    const updatedFiles = files.map((file, idx) =>
      idx === activeTab ? { ...file, content: `${file.content}\n${aiSuggestion}` } : file
    );
    setFiles(updatedFiles);
    if (files[activeTab].ext === 'html') {
      updateLivePreview(updatedFiles, activeTab);
    }
    setAiSuggestion('');
    logMessage(`Applied AI suggestion to ${files[activeTab].name}`);
  };

  /**
   * Updates the live preview for HTML files with inline CSS/JS.
   * @param {Array} fileList - List of files
   * @param {number} tabIndex - Index of the active tab
   */
  const updateLivePreview = (fileList, tabIndex) => {
    const file = fileList[tabIndex];
    if (file.ext === 'html') {
      const cssFiles = fileList.filter(f => f.ext === 'css');
      const jsFiles = fileList.filter(f => f.ext === 'js');
      const cssContent = cssFiles.map(f => f.content).join('\n');
      const jsContent = jsFiles.map(f => f.content).join('\n');
      const previewContent = `
        <html>
          <head><style>${cssContent}</style></head>
          <body>${file.content}<script>${jsContent}</script></body>
        </html>`;
      const blob = new Blob([previewContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      fileList[tabIndex].url = url;
      setFiles([...fileList]);
    }
  };

  /**
   * Renders the content of the active file based on its type.
   * @param {Object} file - File object with name, ext, url, content
   * @returns {JSX.Element} Rendered content
   */
  const getContent = (file) => {
    const { ext, url, content } = file;
    logMessage(`Rendering content for ${file.name} (${ext}), URL: ${url}`);

    if (ext === 'html' && !isEditingHtml) {
      return (
        <iframe
          src={url}
          title={file.name}
          className="cosmic-iframe"
          sandbox="allow-scripts allow-same-origin"
          onError={(e) => logMessage(`Iframe error for ${file.name}: ${e.message}`)}
        />
      );
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return <img src={url} alt={file.name} className="cosmic-image" />;
    }
    if (ext === 'mp4') {
      return (
        <video controls className="cosmic-media">
          <source src={url} type="video/mp4" />
        </video>
      );
    }
    if (['mp3', 'wav'].includes(ext)) {
      return (
        <audio controls className="cosmic-media">
          <source src={url} type={file.mimeType} />
        </audio>
      );
    }
    if (ext === 'pdf') {
      return (
        <iframe
          src={`${url}#view=FitH`}
          title={file.name}
          className="cosmic-iframe"
        />
      );
    }
    if ([
      'js', 'ts', 'jsx', 'vue', 'md', 'txt', 'csv', 'json', 'xml', 'yaml', 'toml',
      'sh', 'ps1', 'sql', 'dockerfile', 'py', 'php', 'rb', 'java', 'cpp', 'go',
      'rs', 'kt', 'swift', 'cs', 'r', 'scala', 'dart', 'pl', 'lua', 'bat', 'css',
      'html' // Include HTML when editing
    ].includes(ext)) {
      return (
        <div className="editor-wrapper">
          <AceEditor
            mode={ext === 'html' ? 'html' : ext === 'css' ? 'css' : ext === 'js' || ext === 'jsx' ? 'javascript' : 'text'}
            theme="monokai"
            value={content}
            onChange={handleContentChange}
            name="code-editor"
            editorProps={{ $blockScrolling: true }}
            width="100%"
            height="300px"
            setOptions={{ useWorker: false }}
            className="animate-fade-in"
          />
          <div className="ai-suggestion-panel mt-2 p-2 w-full bg-gray-900 border border-[#ff00ff] rounded animate-supernova">
            <textarea
              value={aiSuggestion}
              readOnly
              placeholder="CrackerBot’s AI is brewing cosmic enhancements—stand by! 🌠"
              className="ai-suggestion w-full h-20 p-2 bg-transparent text-[#00ff9f] font-mono border-none resize-none"
            />
            {aiSuggestion && aiSuggestion !== 'CrackerBot’s AI is brewing cosmic enhancements—stand by! 🌠' && (
              <button
                onClick={suggestChanges}
                className="apply-suggestion mt-2 px-4 py-2 bg-[#ff007a] text-[#1a1a1a] rounded-full hover:bg-[#00ffcc] hover:shadow-[0_0_15px_#00ffcc] transition-all font-bold"
              >
                Apply Cosmic Suggestion ✨
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="non-previewable">
        {`"${file.name}" can’t be previewed here—check the README to run it locally! 🚀`}
      </div>
    );
  };

  /**
   * Renders a progress bar for ZIP operations.
   * @returns {JSX.Element|null} Progress bar or null if not active
   */
  const renderProgressBar = () => {
    if (progress === 0) return null;
    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    const gradient = `linear-gradient(to right, #ff00ff 0%, #00ffff 50%, #00ff9f ${clampedProgress}%, #1a1a1a ${clampedProgress}% 100%)`;

    return (
      <div className="progress-bar-container w-full max-w-md mt-2">
        <div
          className="progress-bar h-4 rounded-full shadow-[0_0_15px_#00ff9f] bg-gray-900 overflow-hidden relative"
          style={{ width: '100%', transition: 'all 0.5s ease-in-out' }}
        >
          <div
            className="progress-fill h-full absolute top-0 left-0 animate-pulse"
            style={{
              width: `${clampedProgress}%`,
              background: gradient,
              boxShadow: '0 0 20px rgba(0, 255, 159, 0.9)',
            }}
          />
        </div>
        <span className="text-sm mt-1 block text-center font-mono text-[#00ff9f] animate-glow">
          {clampedProgress}% - {clampedProgress === 100 ? 'Cosmic Action Complete! 🌟' : 'Processing Cosmic Command... 🚀'}
        </span>
      </div>
    );
  };

  if (!fileContent || (files.length === 0 && !error)) {
    return (
      <div className="cosmic-overlay">
        <div className="cosmic-portal" />
        <div className="preview-container">
          <div className="header">
            <h2 className="header-title">CrackerBot Preview - {fileName}</h2>
            <div className="header-buttons">
              <button onClick={handleDownload} className="download-button">
                Download ZIP
              </button>
              <button onClick={handleDone} className="done-button">
                Done
              </button>
              <button onClick={handleRestart} className="restart-button">
                Restart
              </button>
              <button onClick={handleRefine} className="refine-button">
                Refine Project
              </button>
              <button onClick={onClose} className="close-button">
                ✕
              </button>
            </div>
          </div>
          <div className="content-wrapper">
            <div className="main-content">
              {isLoading ? (
                <div className="cosmic-loader">
                  <div className="spinner"></div>
                  <p>Warping in cosmic preview...</p>
                </div>
              ) : (
                <p className="error-text">{error || 'No content to preview—cosmic void detected!'}</p>
              )}
              {renderProgressBar()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cosmic-overlay">
      <div className="cosmic-portal" />
      <div className="preview-container">
        <div className="header">
          <h2 className="header-title">CrackerBot Preview - {fileName}</h2>
          <div className="header-buttons">
            <button onClick={handleDownload} className="download-button">
              Download ZIP
            </button>
            <button onClick={handleDone} className="done-button">
              Done
            </button>
            <button onClick={handleRestart} className="restart-button">
              Restart
            </button>
            <button onClick={handleRefine} className="refine-button">
              Refine Project
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>
        <div className="content-wrapper">
          <div className="sidebar">
            {files.map((file, idx) => (
              <div
                key={file.name}
                onClick={() => setActiveTab(idx)}
                className={`tab ${idx === activeTab ? 'active' : ''}`}
              >
                {file.name}
              </div>
            ))}
          </div>
          <div className="main-content">
            {isLoading ? (
              <div className="cosmic-loader">
                <div className="spinner"></div>
                <p>Warping in cosmic preview...</p>
              </div>
            ) : error ? (
              <p className="error-text">{error}</p>
            ) : (
              <>
                <div className="content-area">
                  {files[activeTab] && getContent(files[activeTab])}
                </div>
                {files[activeTab]?.ext === 'html' && (
                  <div className="code-toggle">
                    <button
                      onClick={() => setIsEditingHtml(!isEditingHtml)}
                      className="toggle-button"
                    >
                      {isEditingHtml ? 'Show Preview' : 'Edit HTML'}
                    </button>
                  </div>
                )}
                {files[activeTab]?.ext === 'css' && (
                  <div className="code-toggle">
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="toggle-button"
                    >
                      {showCode ? 'Hide CSS' : 'Show CSS'}
                    </button>
                  </div>
                )}
                {renderProgressBar()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = `
  .cosmic-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.95), rgba(42, 42, 74, 0.95));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    backdrop-filter: blur(8px);
  }
  .cosmic-portal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, #ff00ff, #00ffff, transparent);
    animation: portal 1.2s ease-out forwards;
    z-index: 9999;
  }
  @keyframes portal {
    0% { opacity: 1; transform: scale(0); }
    50% { opacity: 1; transform: scale(1.5); }
    100% { opacity: 0; transform: scale(2); pointer-events: none; }
  }
  .preview-container {
    width: 95vw;
    height: 95vh;
    max-width: 95vw;
    display: flex;
    flex-direction: column;
    background: #0a0a23;
    border-radius: 12px;
    box-shadow: 0 0 25px #ff00ff, 0 0 50px #00ffcc;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    animation: fadeIn 0.6s ease-in;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-25px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem;
    border-bottom: 3px solid #ff00ff;
    background: linear-gradient(90deg, #0a0a23, #1a1a3d);
  }
  .header-title {
    font-size: 1.6rem;
    font-weight: bold;
    color: #00ff00;
    text-shadow: 0 0 6px #00ff00, 0 0 12px #00ff00;
  }
  .header-buttons {
    display: flex;
    gap: 0.75rem;
  }
  .download-button, .done-button, .restart-button, .refine-button {
    background: #ff007a;
    color: #1a1a1a;
    padding: 0.6rem 1.2rem;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: bold;
  }
  .download-button:hover, .done-button:hover, .restart-button:hover, .refine-button:hover {
    background: #00ffcc;
    box-shadow: 0 0 12px #00ffcc;
    transform: translateY(-3px);
  }
  .close-button {
    color: #00ffcc;
    font-size: 1.6rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .close-button:hover {
    color: #ff007a;
    text-shadow: 0 0 12px #ff007a;
    transform: scale(1.2);
  }
  .content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .sidebar {
    width: 22%;
    background: #0a0a23;
    padding: 1.2rem;
    padding-top: 2.5rem;
    border-right: 3px solid #ff00ff;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .tab {
    padding: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    background: #ff007a;
    color: #1a1a1a;
    font-weight: bold;
    transition: all 0.3s ease;
    text-align: center;
    box-shadow: 0 0 5px #ff007a;
  }
  .tab:hover {
    background: #00ffcc;
    box-shadow: 0 0 12px #00ffcc;
    transform: translateX(5px);
  }
  .tab.active {
    background: #00ffcc;
    color: #1a1a1a;
    box-shadow: 0 0 18px #00ffcc, inset 0 0 6px #ff007a;
    transform: scale(1.05);
  }
  .main-content {
    flex: 1;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #1a1a3d;
  }
  .content-area {
    flex: 1;
    overflow: auto;
    position: relative;
  }
  .cosmic-iframe {
    width: 100%;
    height: 100%;
    min-height: 400px;
    border: none;
    border-radius: 6px;
    box-shadow: 0 0 12px #ff00ff;
    background: #fff;
  }
  .cosmic-image {
    max-width: 100%;
    border-radius: 6px;
    box-shadow: 0 0 12px #00ffcc;
    transition: transform 0.3s ease;
  }
  .cosmic-image:hover {
    transform: scale(1.05);
  }
  .cosmic-media {
    width: 100%;
    border-radius: 6px;
    box-shadow: 0 0 12px #ff007a;
  }
  .code-toggle {
    margin-top: 0.75rem;
  }
  .toggle-button {
    background: #ff007a;
    color: #1a1a1a;
    padding: 0.6rem 1.2rem;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: bold;
  }
  .toggle-button:hover {
    background: #00ffcc;
    box-shadow: 0 0 12px #00ffcc;
    transform: translateY(-3px);
  }
  .non-previewable {
    text-align: center;
    padding: 1.5rem;
    color: #ff007a;
    text-shadow: 0 0 6px #ff007a;
    font-size: 1.2rem;
  }
  .error-text {
    color: #ff007a;
    text-shadow: 0 0 6px #ff007a;
    text-align: center;
    font-size: 1.3remellation-padding: 1.2rem;
  }
  .cosmic-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #ff00ff;
    border-top: 5px solid #00ffcc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .cosmic-loader p {
    margin-top: 1rem;
    color: #00ff00;
    text-shadow: 0 0 5px #00ff00;
    font-size: 1.2rem;
  }
  .ai-suggestion {
    resize: none;
    font-family: 'Courier New', monospace;
  }
  .ai-suggestion-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .progress-bar-container {
    width: 100%;
    max-width: 400px;
    margin-top: 0.5rem;
  }
  .progress-bar {
    height: 0.75rem;
    border-radius: 9999px;
    background: #1a1a1a;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  @keyframes supernova {
    0% { transform: scale(1); opacity: 1; box-shadow: 0 0 15px #ff00ff; }
    50% { transform: scale(1.2); opacity: 0.8; box-shadow: 0 0 30px #00ff9f; }
    100% { transform: scale(1); opacity: 1; box-shadow: 0 0 15px #ff00ff; }
  }
  .animate-supernova {
    animation: supernova 1.5s ease-in-out;
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default PreviewPopup;