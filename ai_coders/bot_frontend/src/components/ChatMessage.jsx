// ai_coders/bot_frontend/src/components/ChatMessage.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ChatMessage = ({ message, progress, taskResult, onPreview, onOptionClick, colorScheme }) => {
  const [progressState, setProgressState] = useState({ value: progress || 0, text: '', taskId: null });
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    if (message?.type === 'progressUpdate' || message?.type === 'progress') {
      setProgressState({
        value: message.progress || 0,
        text: message.text || '',
        taskId: message.taskId,
      });
      const delayTimeout = setTimeout(() => {
        if (message.progress < 100 && !taskResult) setIsDelayed(true);
      }, 10000);
      return () => clearTimeout(delayTimeout);
    } else if (progress !== undefined) {
      setProgressState(prev => ({ ...prev, value: progress }));
    }
  }, [message, progress, taskResult]);

  const msg = typeof message === 'string' ? { text: message } : message;
  const displayText = msg.type === 'user' && !msg.options ? `${msg.user}: ${msg.text}` : msg.text;

  const renderProgressBar = () => {
    if (!msg.taskId || progressState.value === 0) return null;
  
    const progressClass = progressState.value < 25 ? 'progress-start' :
                          progressState.value < 75 ? 'progress-middle' : 'progress-end';
  
    const barStyle = {
      width: `${progressState.value}%`,
    };
  
    const progressText = progressState.text || (
      isDelayed && progressState.value < 100
        ? 'Loading Project Download... ⚡️'
        : progressState.value < 25
        ? 'Revving up! 🚀'
        : progressState.value < 50
        ? 'Gaining steam! 💨'
        : progressState.value < 75
        ? 'Halfway there! 🔥'
        : progressState.value < 100
        ? 'Nailing it! 🎯'
        : 'Done—epic win! 🏆'
    );
  
    const className = `progress-bar ${progressClass} ${isDelayed ? 'neon-pulse animate-bounce' : ''}`;
  
    return (
      <div className="progress-container mt-2">
        <p className="text-sm text-center mb-1 text-white">{progressText}</p>
        <div className="w-full bg-gray-900 rounded-full h-6 overflow-hidden">
          <div className={className} style={barStyle}></div>
        </div>
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
              className={`${colorScheme.accent} hover:underline hover:text-neon-green transition-colors duration-200 font-semibold`}
            >
              Download
            </a>
            <button
              onClick={onPreview}
              className={`${colorScheme.button} ${colorScheme.buttonText} hover:scale-105 hover:shadow-neon transition-all duration-200 px-3 py-1 rounded-full`}
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
              } rounded-full shadow-md hover:scale-105 hover:shadow-neon transition-all duration-200`}
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
                  onClick={() => onOptionClick(opt, { action: opt, taskId: project.taskId, content: project.content, fileName: project.fileName })}
                  className={`${colorScheme.bubble} px-2 py-1 text-base rounded-full shadow-md hover:scale-105 hover:shadow-neon transition-all duration-200`}
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
    msg.type === 'user'
      ? `${colorScheme.user} no-animation`
      : msg.type === 'system'
      ? colorScheme.system
      : colorScheme.bot
  } p-2 mb-2 rounded shadow-sm`;

  return (
    <div className={`chat-message ${messageClass}`} style={msg.type === 'user' ? { animation: 'none' } : {}}>
      {(msg.type !== 'progressUpdate' && msg.type !== 'progress') && <p className="break-words">{displayText}</p>}
      {(progressState.value > 0 || msg.type === 'progressUpdate' || msg.type === 'progress') && renderProgressBar()}
      {(taskResult || msg.fileContent) && renderTaskResult()}
      {msg.options && renderOptions()}
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