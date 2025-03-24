// ai_coders/bot_frontend/src/components/ChatMessage.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ChatMessage = ({ message, progress, taskResult, onPreview, onOptionClick, colorScheme }) => {
  const [progressValue, setProgressValue] = useState(progress || 0);
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
  const displayText = msg.type === 'user' && !msg.options ? `${msg.user}: ${msg.text}` : msg.text;

  const renderProgressBar = () => {
    // Define neon colors for the gradient
    const neonRed = '#ff1744';    // Start (0%)
    const neonYellow = '#ffea00'; // Middle (50%)
    const neonGreen = '#00e676';  // End (100%)

    // Dynamic gradient based on progress
    const gradientStops = [
      `${neonRed} 0%`,
      progressValue >= 50 ? `${neonYellow} ${progressValue}%` : `${neonRed} ${progressValue}%`,
      progressValue >= 75 ? `${neonGreen} 100%` : `${neonYellow} 100%`,
    ].join(', ');

    const barStyle = {
      width: `${progressValue}%`,
      background: `linear-gradient(to right, ${gradientStops})`,
      transition: 'width 0.5s ease-in-out, box-shadow 0.3s ease-in-out', // Smooth transitions
      boxShadow: `0 0 15px ${progressValue >= 75 ? neonGreen : progressValue >= 50 ? neonYellow : neonRed}, 0 0 5px ${progressValue >= 75 ? neonGreen : progressValue >= 50 ? neonYellow : neonRed} inset`, // Neon glow
      borderRadius: '4px', // Slight rounding for flair
    };

    // Dynamic progress text with flair
    const progressText = isDelayed && progressValue < 100
      ? 'Loading Project Download... ⚡️'
      : progressValue < 25
      ? 'Revving up! 🚀'
      : progressValue < 50
      ? 'Gaining steam! 💨'
      : progressValue < 75
      ? 'Halfway there! 🔥'
      : progressValue < 100
      ? 'Nailing it! 🎯'
      : 'Done—epic win! 🏆';

    const className = isDelayed ? 'progress-bar neon-pulse animate-bounce' : 'progress-bar';

    return (
      <div className="progress-container mt-2 relative">
        <div className={className} style={barStyle}></div>
        <span className="progress-text absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-black font-semibold drop-shadow-md">
          {progressText}
        </span>
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
      <p className="break-words">{displayText}</p>
      {progress !== undefined && renderProgressBar()}
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