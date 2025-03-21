// bot_frontend/src/components/TaskSelector.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";

const techStacks = ["MEAN", "MERN", "LAMP", "JAMstack"];
const fileExtensions = [".js", ".html", ".css", ".py", ".java", ".cpp", ".exe", ".bat", ".php", ".zip"];

const TaskSelector = ({ onSelect, onCancel, colorScheme }) => {
  const [techStack, setTechStack] = useState("");
  const [fileExtension, setFileExtension] = useState(".js");

  return (
    <div className={`p-4 ${colorScheme.chatBg} border rounded absolute z-20`}>
      <h3 className={colorScheme.accent}>Select Tech Stack & Extension</h3>
      <select value={techStack} onChange={(e) => setTechStack(e.target.value)} className={`${colorScheme.button} p-2 mt-2 w-full`}>
        <option value="">None</option>
        {techStacks.map((stack) => <option key={stack} value={stack}>{stack}</option>)}
      </select>
      <select value={fileExtension} onChange={(e) => setFileExtension(e.target.value)} className={`${colorScheme.button} p-2 mt-2 w-full`}>
        {fileExtensions.map((ext) => <option key={ext} value={ext}>{ext}</option>)}
      </select>
      <div className="mt-2 flex justify-end">
        <button onClick={() => onSelect({ techStack, fileExtension })} className={`${colorScheme.bubble} p-2`}>Confirm</button>
        <button onClick={onCancel} className={`${colorScheme.bubble} p-2 ml-2`}>Cancel</button>
      </div>
    </div>
  );
};

TaskSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  colorScheme: PropTypes.object.isRequired,
};

export default TaskSelector;