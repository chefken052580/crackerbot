// bot_frontend/src/components/ChatMessage.jsx
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
    return (
      <div className="task-result">
        {downloadLink && <a href={downloadLink} download className={colorScheme.accent}>Download</a>}
        {msg.fileContent && (
          <button onClick={onPreview} className={`${colorScheme.button} ${colorScheme.buttonText} ml-2`}>Preview</button>
        )}
      </div>
    );
  };

  const renderOptions = () => {
    if (!msg.options || msg.options.length === 0) return null;
    return (
      <div className="options-container">
        {msg.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onOptionClick(option)}
            className={`${colorScheme.bubble} m-1 px-2 py-1 rounded`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  const messageClass = `${msg.type === 'user' ? colorScheme.user : msg.type === 'system' ? colorScheme.system : colorScheme.bot} p-2 mb-2 rounded`;

  return (
    <div className={`chat-message ${messageClass}`}>
      <p>{msg.text}</p>
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
  }),
  onPreview: PropTypes.func,
  onOptionClick: PropTypes.func,
  colorScheme: PropTypes.object.isRequired,
};

export default ChatMessage;