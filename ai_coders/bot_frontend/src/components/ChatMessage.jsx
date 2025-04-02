/* CrackerBot’s cosmic messenger—delivering supernova chats with flair and precision! 🌌
 * Enhanced by xAI for static AI responses, robust user name handling, and cosmic interactivity.
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import PreviewPopup from './PreviewPopup';

/**
 * Renders a single chat message with progress, task results, options, and projects.
 * @param {Object|string} message - Message data or text string
 * @param {Object} message.id - Unique message identifier
 * @param {string} message.from - Sender name
 * @param {string} [message.user] - User name (defaults to "Guest" if undefined)
 * @param {string} message.text - Message content
 * @param {string} message.type - Message type (e.g., 'user', 'bot', 'taskResult')
 * @param {string} [message.taskId] - Task identifier
 * @param {string[]} [message.options] - User response options
 * @param {string} [message.finalContent] - Final task content
 * @param {string} [message.downloadLink] - Download URL
 * @param {string} [message.taskName] - Project name
 * @param {string} [message.taskType] - Project type
 * @param {string} [message.taskFeatures] - Project features
 * @param {Object[]} [message.projects] - List of completed projects
 * @param {number} [message.progress] - Progress percentage
 * @param {Object} [message.bubbleStyle] - Custom bubble styling (static only)
 * @param {Object} [taskResult] - Optional task result data with content and links
 * @param {Function} onOptionClick - Callback for handling option clicks
 * @param {Object} colorScheme - Color scheme object for styling
 * @param {number} [progress] - Progress percentage from parent component
 * @param {Function} setMessages - Function to update the message list
 * @param {Object} socket - WebSocket instance for communication
 * @returns {JSX.Element} The rendered chat message component
 */
const ChatMessage = ({ message, taskResult, onOptionClick, colorScheme, progress, setMessages, socket }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [taskProgress, setTaskProgress] = useState(null);
  const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
  const displayText = msg.type === 'task_response' ? `${msg.user}: ${msg.text}` : msg.text;

  console.log(`[${new Date().toISOString()}] 🌠 Rendering cosmic message: ${JSON.stringify(msg)}`);

  useEffect(() => {
    if (msg.type === 'progressUpdate' && msg.taskId && msg.progress !== undefined) {
      setTaskProgress(msg.progress);
      console.log(`[${new Date().toISOString()}] 🌟 Progress updated for task ${msg.taskId}: ${msg.progress}%`);
    } else if (progress !== undefined && msg.taskId) {
      setTaskProgress(progress);
    }
  }, [msg, progress]);

  /**
   * Renders a cosmic progress bar with supernova flair, persisting post-build.
   * @returns {JSX.Element|null} Progress bar component or null if not applicable
   * @private
   */
  const renderProgressBar = () => {
    const hasProgress = taskProgress !== null;
    const progressValue = taskProgress !== null ? taskProgress : msg.progress || progress;

    if (!hasProgress || progressValue === undefined) {
      console.log(`[${new Date().toISOString()}] Skipping progress bar—no cosmic construction for ${msg.taskId || 'unknown'}`);
      return null;
    }

    const clampedProgress = Math.min(Math.max(progressValue, 0), 100);
    const isComplete = clampedProgress === 100;
    const gradient = isComplete
      ? 'linear-gradient(to right, #00ff9f, #ff00ff, #00ffff)'
      : `linear-gradient(to right, #ff00ff 0%, #00ffff 50%, #00ff9f ${clampedProgress}%, #333333 ${clampedProgress}% 100%)`;

    return (
      <div className="progress-bar-container mt-2 w-full max-w-md">
        <div
          className="progress-bar h-4 rounded-full shadow-[0_0_15px_#00ff9f] bg-gray-900 overflow-hidden relative"
          style={{ width: '100%', transition: 'all 0.7s ease-in-out' }}
        >
          <div
            className={`progress-fill h-full absolute top-0 left-0 ${isComplete ? 'animate-glow' : 'animate-pulse'}`}
            style={{
              width: `${clampedProgress}%`,
              background: gradient,
              boxShadow: '0 0 20px rgba(0, 255, 159, 0.9)',
            }}
          />
        </div>
        <span className="text-sm mt-1 block text-center font-mono text-[#00ff9f]">
          {clampedProgress}% - {isComplete ? 'Cosmic Build Complete! 🌟' : 'Warping Through Hyperspace! 🚀'}
        </span>
      </div>
    );
  };

  /**
   * Handles preview button click, opening the PreviewPopup if content exists.
   * @private
   */
  const handlePreviewClick = () => {
    const content = msg.finalContent || (taskResult && taskResult.finalContent);
    if (content) {
      setShowPreview(true);
      console.log(`[${new Date().toISOString()}] 🌌 Hyperspace preview activated for "${msg.taskName || 'unknown'}": ${content.substring(0, 50)}...`);
    } else {
      console.warn(`[${new Date().toISOString()}] No cosmic payload for preview: ${JSON.stringify(msg)}`);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          from: 'CrackerBot Prime',
          user: msg.user,
          text: `No cosmic content to preview for "${msg.taskName || 'this task'}"—retry or refine it, space traveler! ⚠️`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
          bubbleStyle: { background: 'linear-gradient(135deg, #ff3333, #660000)', color: '#fff' },
        },
      ]);
    }
  };

  /**
   * Renders task result buttons (Download/Preview) with cosmic styling.
   * @returns {JSX.Element|null} Task result UI or null if not a taskResult
   * @private
   */
  const renderTaskResult = () => {
    const hasContent = msg.finalContent || (taskResult && taskResult.finalContent);
    const downloadLink = msg.downloadLink || (taskResult && taskResult.downloadLink);
    const fileName = msg.fileName || (taskResult && taskResult.fileName) || `${msg.taskName || 'cosmic_download'}.zip`;

    console.log(`[${new Date().toISOString()}] 🌟 Rendering task result - hasContent: ${!!hasContent}, downloadLink: ${downloadLink}, fileName: ${fileName}`);

    if (msg.type !== 'taskResult') return null;

    if (!hasContent && !downloadLink) {
      console.warn(`[${new Date().toISOString()}] No cosmic payload or download link for task: ${msg.taskId || 'unknown'}`);
      return <p className="text-[#ff00ff] font-mono">No content to unleash—check the cosmos logs! ⚠️</p>;
    }

    return (
      <div className="task-result flex space-x-4 mt-4">
        {downloadLink && (
          <a
            href={downloadLink}
            download={fileName}
            className={`${colorScheme.accent} px-5 py-2 rounded-full hover:underline hover:text-[#00ff9f] transition-all duration-300 font-semibold tracking-wider border-2 border-[#ff00ff] shadow-[0_0_15px_#ff00ff]`}
          >
            Download 🌠
          </a>
        )}
        {hasContent && (
          <button
            onClick={handlePreviewClick}
            className={`${colorScheme.button} ${colorScheme.buttonText} px-5 py-2 rounded-full hover:scale-110 hover:shadow-[0_0_20px_#00ff9f] transition-all duration-300 border-2 border-[#00ff9f] shadow-[0_0_15px_#00ff9f]`}
          >
            Preview 🚀
          </button>
        )}
      </div>
    );
  };

  /**
   * Renders clickable options with cosmic flair.
   * @returns {JSX.Element|null} Options UI or null if none
   * @private
   */
  const renderOptions = () => {
    if (!msg.options || msg.options.length === 0 || msg.type === 'taskResult') {
      console.log(`[${new Date().toISOString()}] No cosmic options for message: ${msg.text}`);
      return null;
    }
    console.log(`[${new Date().toISOString()}] 🌌 Rendering cosmic options: ${JSON.stringify(msg.options)}`);
    return (
      <div className="options-container flex flex-wrap gap-3 mt-4">
        {msg.options.map((option, idx) => {
          const isObject = typeof option === 'object' && option.text && option.style;
          const text = isObject ? option.text : option;
          const style = isObject ? option.style : 'normal';
          const isLarge = style === 'large';
          return (
            <button
              key={idx}
              onClick={() => onOptionClick(text)}
              className={`${colorScheme.bubble} ${
                isLarge ? 'px-6 py-3 text-lg font-bold' : 'px-4 py-2 text-base'
              } rounded-full shadow-lg hover:scale-105 hover:shadow-[0_0_15px_#00ff9f] transition-all duration-300 border-2 border-[#00ff9f]`}
            >
              {text}
            </button>
          );
        })}
      </div>
    );
  };

  /**
   * Renders a list of completed projects with options.
   * @returns {JSX.Element|null} Projects UI or null if none
   * @private
   */
  const renderProjects = () => {
    if (!msg.projects || msg.projects.length === 0) return null;
    console.log(`[${new Date().toISOString()}] 🌟 Rendering cosmic project list: ${JSON.stringify(msg.projects)}`);
    return (
      <div className="projects-container flex flex-col gap-4 mt-4">
        {msg.projects.map((project, idx) => (
          <div
            key={idx}
            className="project-item flex items-center justify-between bg-gray-900 p-3 rounded-lg shadow-md border border-[#ff00ff]"
          >
            <span className="font-medium text-[#00ff9f] flex-1">
              {project.text} {project.status === 'completed' ? '✅' : project.status === 'failed' ? '❌' : '⏳'}
            </span>
            <div className="options-container flex gap-3">
              {project.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => onOptionClick(opt, { projectData: project })}
                  className={`${colorScheme.bubble} px-4 py-2 text-base rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_15px_#ff00ff] transition-all duration-300 border-2 border-[#ff00ff]`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Apply bubbleStyle from message or default based on type (static for text)
  const bubbleStyle = msg.bubbleStyle && Object.keys(msg.bubbleStyle).length > 0
    ? { background: msg.bubbleStyle.background, color: msg.bubbleStyle.color }
    : {
        background: msg.type === 'task_response'
          ? 'linear-gradient(135deg, #00ffcc, #00ccff)'
          : msg.type === 'system'
          ? 'linear-gradient(135deg, #ffcc00, #ff6600)'
          : msg.type === 'progressUpdate'
          ? 'linear-gradient(135deg, #ff0066, #ffcc00)'
          : msg.type === 'taskResult' || msg.type === 'question'
          ? 'linear-gradient(135deg, #00ff99, #0066ff)'
          : 'linear-gradient(135deg, #ff00cc, #3333ff)',
        color: msg.type === 'task_response' ? '#000' : '#fff',
      };

  const messageClass = `${
    msg.type === 'task_response'
      ? `${colorScheme.user} no-animation`
      : msg.type === 'system'
      ? colorScheme.system
      : msg.type === 'progressUpdate'
      ? `${colorScheme.bot} progress-message`
      : msg.type === 'taskResult' || msg.type === 'question'
      ? `${colorScheme.bot} cosmic-result`
      : colorScheme.bot
  }`;

  return (
    <div
      className={`chat-message ${messageClass} p-4 rounded-lg shadow-lg`}
      style={{
        background: bubbleStyle.background,
        color: bubbleStyle.color,
        border: '2px solid #00ff9f',
        boxShadow: '0 0 15px rgba(0, 255, 159, 0.5)',
      }}
      data-user={msg.user}
    >
      <p className="break-words whitespace-pre-line text-base font-mono no-animation">{displayText}</p>
      {taskProgress !== null && renderProgressBar()}
      {renderTaskResult()}
      {msg.options && !msg.projects && renderOptions()}
      {msg.projects && renderProjects()}
      {showPreview && (
        <PreviewPopup
          fileContent={msg.finalContent || taskResult?.finalContent}
          fileName={msg.fileName || taskResult?.fileName || `${msg.taskName || 'cosmic_download'}.zip`}
          onClose={() => setShowPreview(false)}
          socket={socket}
          postTaskOptions={{
            taskId: msg.taskId,
            taskName: msg.taskName,
            taskType: msg.taskType,
            taskFeatures: msg.taskFeatures,
          }}
          setMessages={setMessages}
        />
      )}
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  taskResult: PropTypes.shape({
    downloadLink: PropTypes.string,
    finalContent: PropTypes.string,
    fileName: PropTypes.string,
  }),
  onOptionClick: PropTypes.func.isRequired,
  colorScheme: PropTypes.object.isRequired,
  progress: PropTypes.number,
  setMessages: PropTypes.func.isRequired,
  socket: PropTypes.object.isRequired,
};

export default ChatMessage;