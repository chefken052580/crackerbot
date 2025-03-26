import PropTypes from "prop-types";

const ChatMessage = ({ message, taskResult, onPreview, onOptionClick, colorScheme, progress }) => {
  const msg = typeof message === "string" ? { text: message } : message;
  const displayText = msg.type === "user" && !msg.options ? `${msg.user}: ${msg.text}` : msg.text;

  const renderProgressBar = () => {
    // Use progress prop from ChatRoom if available, fallback to msg.progress
    const progressValue = progress !== undefined ? progress : msg.progress;
    if (msg.type !== "progressUpdate" || progressValue === undefined) return null;

    const clampedProgress = Math.min(Math.max(progressValue, 0), 100);
    const gradient = `linear-gradient(to right, 
      #ff0000 ${clampedProgress < 33 ? clampedProgress * 3 : 0}%, 
      #ffff00 ${clampedProgress < 66 ? clampedProgress * 1.5 : 33}%, 
      #00ff00 ${clampedProgress}%)`;

    return (
      <div className="progress-bar-container mt-2 w-full max-w-md">
        <div
          className="progress-bar h-3 rounded-full shadow-[0_0_10px_#00ff9f] bg-gray-800 overflow-hidden relative"
          style={{
            width: "100%",
            transition: "all 0.5s ease-in-out",
          }}
        >
          <div
            className="progress-fill h-full absolute top-0 left-0 animate-pulse"
            style={{
              width: `${clampedProgress}%`,
              background: gradient,
              boxShadow: "0 0 15px rgba(0, 255, 159, 0.8)",
            }}
          />
        </div>
        <span className="text-sm mt-1 block text-center font-mono text-[#00ff9f]">{clampedProgress}%</span>
      </div>
    );
  };

  const renderTaskResult = () => {
    const hasContent = msg.content || (taskResult && taskResult.content);
    const downloadLink = msg.downloadLink || (taskResult && taskResult.downloadLink);
    const fileName = msg.fileName || (taskResult && taskResult.fileName) || "download";

    if (!hasContent) return null;

    return (
      <div className="task-result flex space-x-4 mt-3">
        <a
          href={downloadLink || `data:application/octet-stream;base64,${msg.content || taskResult.content}`}
          download={fileName}
          className={`${colorScheme.accent} hover:underline hover:text-[#00ff9f] transition-all duration-300 font-semibold tracking-wide`}
        >
          Download 🚀
        </a>
        <button
          onClick={onPreview}
          className={`${colorScheme.button} ${colorScheme.buttonText} px-4 py-1 rounded-full hover:scale-110 hover:shadow-[0_0_15px_#ff00ff] transition-all duration-300 border border-[#ff00ff] glow-effect`}
        >
          Preview 🌌
        </button>
      </div>
    );
  };

  const renderOptions = () => {
    if (!msg.options || msg.options.length === 0) return null;
    return (
      <div className="options-container flex flex-wrap gap-3 mt-3">
        {msg.options.map((option, idx) => {
          const isObject = typeof option === "object" && option.text && option.style;
          const text = isObject ? option.text : option;
          const style = isObject ? option.style : "normal";
          const isLarge = style === "large";
          return (
            <button
              key={idx}
              onClick={() => onOptionClick(text)}
              className={`${colorScheme.bubble} ${
                isLarge ? "px-5 py-2 text-lg font-bold" : "px-3 py-1 text-base"
              } rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_12px_#00ff9f] transition-all duration-200`}
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
      <div className="projects-container flex flex-col gap-3 mt-3">
        {msg.projects.map((project, idx) => (
          <div key={idx} className="project-item flex items-center gap-3 bg-gray-800 p-2 rounded-md shadow-sm">
            <span className="font-medium text-[#00ff9f]">
              {project.text}{" "}
              {project.status === "completed" ? "✅" : project.status === "failed" ? "❌" : "⏳"}
            </span>
            <div className="options-container flex gap-2">
              {project.options.map((opt, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => onOptionClick(opt, { projectData: project })}
                  className={`${colorScheme.bubble} px-3 py-1 text-base rounded-full shadow-md hover:scale-105 hover:shadow-[0_0_12px_#ff00ff] transition-all duration-200`}
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
    msg.type === "user" || msg.type === "command"
      ? `${colorScheme.user} no-animation`
      : msg.type === "system"
      ? colorScheme.system
      : msg.type === "progressUpdate"
      ? `${colorScheme.bot} progress-message`
      : colorScheme.bot
  }`;

  return (
    <div
      className={`chat-message ${messageClass} p-3 rounded-lg shadow-md`}
      style={msg.type === "user" || msg.type === "command" ? { animation: "none" } : {}}
      data-user={msg.user}
    >
      <p className="break-words whitespace-pre-line text-base font-mono">{displayText}</p>
      {renderProgressBar()}
      {renderTaskResult()}
      {msg.options && !msg.projects && renderOptions()}
      {msg.projects && renderProjects()}
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  taskResult: PropTypes.shape({
    downloadLink: PropTypes.string,
    content: PropTypes.string,
  }),
  onPreview: PropTypes.func,
  onOptionClick: PropTypes.func,
  colorScheme: PropTypes.object.isRequired,
  progress: PropTypes.number, // Added progress prop type
};

export default ChatMessage;