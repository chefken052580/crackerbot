// ai_coders/bot_frontend/src/components/ChatMessage.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ChatMessage = ({ message, progress, taskResult, onPreview, onOptionClick, colorScheme }) => {
  const [progressValue, setProgressValue] = useState(0);
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    if (progress !== undefined) {
      setProgressValue(progress);
      const delayTimeout = setTimeout(() => {
        if (progress < 100 && !taskResult) setIsDelayed(true);
      }, 10000);
      return () => clearTimeout(delayTimeout);
    }
  }, [progress, taskResult]);

  const msg = typeof message === 'string' ? { text: message } : message;
  // Only prepend user name for text field messages (no options in original message)
  const displayText = msg.type === 'user' && !msg.options ? `${msg.user}: ${msg.text}` : msg.text;

  const renderProgressBar = () => {
    const barStyle = {
      width: `${progressValue}%`,
      background: `linear-gradient(to right, #00ff00, ${progressValue > 50 ? '#ffff00' : '#00ff00'}, ${progressValue > 75 ? '#ff0000' : '#ffff00'})`,
      transition: 'width 0.5s ease-in-out',
    };
    const text = isDelayed && progressValue < 100 ? 'Loading Project Download...' : `${progressValue}%`;
    const className = isDelayed ? 'progress-bar flashing' : 'progress-bar';

    return (
      <div className="progress-container">
        <div className={className} style={barStyle}></div>
        <span className="progress-text">{text}</span>
      </div>
    );
  };

  const renderTaskResult = () => {
    if (!taskResult && !msg.fileContent) return null;
    const { downloadLink } = taskResult || {};
    const hasContent = msg.fileContent || (taskResult && taskResult.content);
    return (
      <div className="task-result flex space-x-2">
        {hasContent && (
          <>
            <a
              href={downloadLink || `data:text/plain;base64,${msg.fileContent || taskResult.content}`}
              download={msg.fileName || 'download'}
              className={`${colorScheme.accent} hover:underline`}
            >
              Download
            </a>
            <button
              onClick={onPreview}
              className={`${colorScheme.button} ${colorScheme.buttonText} hover:scale-105 transition-transform`}
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
              } rounded-full shadow-md hover:scale-105 transition-transform duration-200`}
            >
              {text}
            </button>
          );
        })}
      </div>
    );
  };

  const messageClass = `${
    msg.type === 'user'
      ? `${colorScheme.user} no-animation`
      : msg.type === 'system'
      ? colorScheme.system
      : colorScheme.bot
  } p-2 mb-2 rounded`;

  return (
    <div className={`chat-message ${messageClass}`} style={msg.type === 'user' ? { animation: 'none' } : {}}>
      <p className="break-words">{displayText}</p>
      {progress !== undefined && renderProgressBar()}
      {(taskResult || msg.fileContent) && renderTaskResult()}
      {msg.options && renderOptions()}
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