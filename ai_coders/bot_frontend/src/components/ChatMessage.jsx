// ai_coders/bot_frontend/src/components/ChatMessage.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ChatMessage = ({ message, progress, taskResult, onPreview, onOptionClick, colorScheme }) => {
  const [progressState, setProgressState] = useState({ value: progress || 0, text: '', taskId: null });
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    console.log('ChatMessage: Received message:', JSON.stringify(message));
    if (message?.type === 'progressUpdate' || message?.type === 'progress') {
      setProgressState({
        value: message.progress || 0,
        text: message.text || '',
        taskId: message.taskId,
      });
      console.log('ChatMessage: Progress set to:', message.progress);
      const delayTimeout = setTimeout(() => {
        if (message.progress < 100 && !taskResult) setIsDelayed(true);
      }, 10000);
      return () => clearTimeout(delayTimeout);
    } else if (message?.type === 'download' && message.taskId) {
      setProgressState(prev => ({
        ...prev,
        text: message.text || 'Task complete—neon glory achieved! 🏆',
        taskId: message.taskId,
      }));
      console.log('ChatMessage: Updated text for download, taskId:', message.taskId);
    } else if (progress !== undefined) {
      setProgressState(prev => ({ ...prev, value: progress }));
    }
  }, [message, progress, taskResult]);

  const msg = typeof message === 'string' ? { text: message } : message;
  const displayText = msg.type === 'user' && !msg.options ? `${msg.user}: ${msg.text}` : msg.text;

  const renderProgressBar = () => {
    if (!progressState.taskId || progressState.value === 0 || (msg.type !== 'progressUpdate' && msg.type !== 'progress')) {
      console.log('ChatMessage: Skipping progress bar, taskId:', progressState.taskId, 'value:', progressState.value, 'type:', msg.type);
      return null;
    }

    console.log('ChatMessage: Rendering progress bar with value:', progressState.value);
    return (
      <div className="progress-container">
        <span className="progress-text">
          {progressState.text || (
            isDelayed && progressState.value < 100
              ? 'Cracker Bot’s powering through... ⚡️'
              : progressState.value < 20
              ? 'Ignition sequence started! 🚀'
              : progressState.value < 40
              ? 'Warming up the engines! 🔥'
              : progressState.value < 60
              ? 'Halfway to epicness! 🌌'
              : progressState.value < 80
              ? 'Cranking up the juice! 💪'
              : progressState.value < 100
              ? 'Final flair incoming! ✨'
              : 'Masterpiece unleashed! 🏆'
          )}
        </span>
        <div
          className="progress-bar"
          style={{ width: `${progressState.value}%` }}
        />
      </div>
    );
  };

  const renderTaskResult = () => {
    if (!taskResult && !msg.fileContent) return null;
    const { downloadLink } = taskResult || {};
    const hasContent = msg.fileContent || (taskResult && taskResult.content);
    return (
      <div className="task-result flex space-x-2 mt-2">
        {hasContent && (
          <>
            <a
              href={downloadLink || `data:text/plain;base64,${msg.fileContent || taskResult.content}`}
              download={msg.fileName || 'download'}
              className={`${colorScheme.accent} hover:underline hover:text-[#00ff9f] transition-colors duration-200 font-semibold`}
            >
              Download
            </a>
            <button
              onClick={onPreview}
              className={`${colorScheme.button} ${colorScheme.buttonText} hover:scale-105 hover:shadow-[0_0_10px_#00ff9f] transition-all duration-200 px-3 py-1 rounded-full`}
            >
              Preview
            </button>
          </>
        )}
      </div>
    );
  };

  const renderOptions = () => {
    if (!msg.options || msg.options.length === 0) return null;
    return (
      <div className="options-container flex flex-wrap gap-2 mt-2">
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
                isLarge ? 'px-4 py-2 text-lg font-semibold' : 'px-2 py-1 text-base'
              } rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_10px_#00ff9f] transition-all duration-200`}
            >
              {text}
            </button>
          );
        })}
      </div>
    );
  };

  const renderProjects = () => {
    if (!msg.projects || msg.projects.length === 0) return null;
    return (
      <div className="projects-container flex flex-col gap-2 mt-2">
        {msg.projects.map((project, idx) => (
          <div key={idx} className="project-item flex items-center gap-2">
            <span className="font-medium">{project.text}</span>
            <div className="options-container flex gap-2">
              {project.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => onOptionClick(opt, { projectData: project })}
                  className={`${colorScheme.bubble} px-2 py-1 text-base rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_10px_#00ff9f] transition-all duration-200`}
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

  const messageClass = `${
    msg.type === 'user' || msg.type === 'command'
      ? `${colorScheme.user} no-animation`
      : msg.type === 'system'
      ? colorScheme.system
      : colorScheme.bot
  }`;

  return (
    <div className={`chat-message ${messageClass}`} style={msg.type === 'user' || msg.type === 'command' ? { animation: 'none' } : {}} data-user={msg.user}>
      {(msg.type !== 'progressUpdate' && msg.type !== 'progress') && (
        <p className="break-words whitespace-pre-line">{displayText}</p>
      )}
      {renderProgressBar()}
      {(taskResult || msg.fileContent) && renderTaskResult()}
      {msg.options && !msg.projects && renderOptions()}
      {msg.projects && renderProjects()}
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  progress: PropTypes.number,
  taskResult: PropTypes.shape({
    downloadLink: PropTypes.string,
    content: PropTypes.string,
  }),
  onPreview: PropTypes.func,
  onOptionClick: PropTypes.func,
  colorScheme: PropTypes.object.isRequired,
};

export default ChatMessage;