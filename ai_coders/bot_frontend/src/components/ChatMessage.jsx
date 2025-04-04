/* CrackerBot’s cosmic messenger—delivering supernova chats with flair and precision! 🌌
 * Enhanced by xAI for static AI responses, robust user name handling, and cosmic interactivity.
 * Version: v2025-04-03-11
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import PreviewPopup from './PreviewPopup';

class ChatMessage extends Component {
  state = {
    showPreview: false,
    taskProgress: null,
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error) {
    console.error(`[${new Date().toISOString()}] ⚠️ ChatMessage caught error: ${error.message}`);
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, info) {
    console.error(`[${new Date().toISOString()}] ⚠️ ChatMessage error boundary triggered: ${error.message}, Info: ${JSON.stringify(info)}`);
  }

  componentDidMount() {
    const { message, progress } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
    console.log(`[${new Date().toISOString()}] 🌠 ChatMessage mounted: ${JSON.stringify(msg)}`);
    if (msg.type === 'progressUpdate' && msg.taskId && msg.progress !== undefined) {
      this.setState({ taskProgress: msg.progress });
      console.log(`[${new Date().toISOString()}] 🌟 Initial progress set for task ${msg.taskId}: ${msg.progress}%`);
    } else if (progress !== undefined && msg.taskId) {
      this.setState({ taskProgress: progress });
    }
  }

  componentDidUpdate(prevProps) {
    const { message, progress } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
    if (prevProps.progress !== progress || prevProps.message.progress !== msg.progress) {
      if (msg.type === 'progressUpdate' && msg.taskId && msg.progress !== undefined) {
        this.setState({ taskProgress: msg.progress });
        console.log(`[${new Date().toISOString()}] 🌟 Progress updated for task ${msg.taskId}: ${msg.progress}%`);
      } else if (progress !== undefined && msg.taskId) {
        this.setState({ taskProgress: progress });
      }
    }
  }

  handlePreviewClick = () => {
    const { message, taskResult, setMessages } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
    const content = msg.finalContent || (taskResult && taskResult.finalContent);
    if (content) {
      this.setState({ showPreview: true });
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

  renderProgressBar = () => {
    const { message, progress } = this.props;
    const { taskProgress } = this.state;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
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

  renderTaskResult = () => {
    const { message, taskResult, colorScheme } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
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
            className={`${colorScheme.accent || 'text-[#00ff9f]'} px-5 py-2 rounded-full hover:underline hover:text-[#00ff9f] transition-all duration-300 font-semibold tracking-wider border-2 border-[#ff00ff] shadow-[0_0_15px_#ff00ff]`}
          >
            Download 🌠
          </a>
        )}
        {hasContent && (
          <button
            onClick={this.handlePreviewClick}
            className={`${colorScheme.button || 'bg-gradient-to-r from-[#ff00cc] to-[#3333ff]'} ${colorScheme.buttonText || 'text-white'} px-5 py-2 rounded-full hover:scale-110 hover:shadow-[0_0_20px_#00ff9f] transition-all duration-300 border-2 border-[#00ff9f] shadow-[0_0_15px_#00ff9f]`}
          >
            Preview 🚀
          </button>
        )}
      </div>
    );
  };

  renderOptions = () => {
    const { message, onOptionClick, colorScheme } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
    if (!msg.options || !Array.isArray(msg.options) || msg.options.length === 0 || msg.type === 'taskResult') {
      console.log(`[${new Date().toISOString()}] No cosmic options for message: ${msg.text}`);
      return null;
    }
    console.log(`[${new Date().toISOString()}] 🌌 Rendering cosmic options: ${JSON.stringify(msg.options)}`);
    try {
      return (
        <div className="options-container flex flex-wrap gap-3 mt-4">
          {msg.options.map((option, idx) => {
            const text = typeof option === 'string' ? option : option.text || 'Unknown';
            const key = `${msg.messageId || 'msg'}-${idx}-${text}`; // Unique key
            return (
              <button
                key={key}
                onClick={() => {
                  if (typeof onOptionClick === 'function') {
                    onOptionClick(text);
                  } else {
                    console.warn(`[${new Date().toISOString()}] onOptionClick is not defined for option: ${text}`);
                  }
                }}
                className={`${colorScheme.bubble || 'bg-gradient-to-r from-[#ff00cc] to-[#3333ff]'} px-4 py-2 text-base rounded-full shadow-lg hover:scale-105 hover:shadow-[0_0_15px_#00ff9f] transition-all duration-300 border-2 border-[#00ff9f]`}
              >
                {text}
              </button>
            );
          })}
        </div>
      );
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ Error rendering options: ${err.message}`);
      return <p className="text-red-500">Error rendering options: {err.message}</p>;
    }
  };

  renderProjects = () => {
    const { message, onOptionClick, colorScheme } = this.props;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
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
                  className={`${colorScheme.bubble || 'bg-gradient-to-r from-[#ff00cc] to-[#3333ff]'} px-4 py-2 text-base rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_15px_#ff00ff] transition-all duration-300 border-2 border-[#ff00ff]`}
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

  render() {
    const { message, taskResult, colorScheme, setMessages, socket } = this.props;
    const { showPreview, hasError, errorMessage } = this.state;
    const msg = typeof message === 'string' ? { text: message, user: 'Guest' } : { ...message, user: message.user || 'Guest' };
    const displayText = msg.type === 'task_response' ? `${msg.user}: ${msg.text}` : msg.text;

    if (hasError) {
      return (
        <div className="chat-message text-white bg-red-900 p-4 rounded-lg shadow-lg">
          <p>⚠️ Cosmic Transmission Error: {errorMessage}</p>
        </div>
      );
    }

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
        ? `${colorScheme.user || 'text-[#00ffcc]'} no-animation`
        : msg.type === 'system'
        ? colorScheme.system || 'text-[#ffcc00]'
        : msg.type === 'progressUpdate'
        ? `${colorScheme.bot || 'text-[#ff00cc]'} progress-message`
        : msg.type === 'taskResult' || msg.type === 'question'
        ? `${colorScheme.bot || 'text-[#00ff99]'} cosmic-result`
        : colorScheme.bot || 'text-[#ff00cc]'
    }`;

    console.log(`[${new Date().toISOString()}] 🌌 Rendering ChatMessage UI for "${msg.text}"`);

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
        {this.renderProgressBar()}
        {this.renderTaskResult()}
        {msg.options && !msg.projects && this.renderOptions()}
        {msg.projects && this.renderProjects()}
        {showPreview && (
          <PreviewPopup
            fileContent={msg.finalContent || taskResult?.finalContent}
            fileName={msg.fileName || taskResult?.fileName || `${msg.taskName || 'cosmic_download'}.zip`}
            onClose={() => this.setState({ showPreview: false })}
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
  }
}

ChatMessage.propTypes = {
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  taskResult: PropTypes.shape({
    downloadLink: PropTypes.string,
    finalContent: PropTypes.string,
    fileName: PropTypes.string,
  }),
  onOptionClick: PropTypes.func.isRequired,
  colorScheme: PropTypes.object,
  progress: PropTypes.number,
  setMessages: PropTypes.func,
  socket: PropTypes.object,
};

ChatMessage.defaultProps = {
  colorScheme: {
    accent: 'text-[#00ff9f]',
    bubble: 'bg-gradient-to-r from-[#ff00cc] to-[#3333ff]',
    button: 'bg-gradient-to-r from-[#ff00cc] to-[#3333ff]',
    buttonText: 'text-white',
    user: 'text-[#00ffcc]',
    bot: 'text-[#ff00cc]',
    system: 'text-[#ffcc00]',
  },
  setMessages: () => {},
  socket: null,
};

export default ChatMessage;