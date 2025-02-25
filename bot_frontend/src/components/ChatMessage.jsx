import React from 'react';

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString();
};

const ChatMessage = ({ message }) => {
  const { user, text, type, details, tasks, projects } = message;

  const renderContent = () => {
    switch (type) {
      case 'command':
        return <div className="font-mono text-blue-400">{text}</div>;
      
      case 'error':
        return <div className="text-red-500">{text}</div>;
      
      case 'system':
        if (details) { // Health status
          return (
            <div>
              <div className="font-semibold mb-2">{text}</div>
              <div className="pl-4 text-sm space-y-1">
                <div className="text-green-400">Status: {details.status}</div>
                <div>Uptime: {Math.round(details.uptime)}s</div>
                <div>Memory Used: {Math.round(details.memory.heapUsed / 1024 / 1024)}MB</div>
                <div className="text-gray-500">Last Updated: {formatDate(details.timestamp)}</div>
              </div>
            </div>
          );
        }
        if (tasks && tasks.length > 0) { // Task list
          return (
            <div>
              <div className="font-semibold mb-2">{text}</div>
              <div className="pl-4 text-sm space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="bg-gray-700 p-2 rounded">
                    <div className="flex justify-between">
                      <span className="font-mono">Task {task.id}</span>
                      <span className={
                        task.status === 'running' ? 'text-green-400' :
                        task.status === 'stopped' ? 'text-red-400' :
                        task.status === 'in_progress' ? 'text-yellow-400' :
                        'text-blue-400'
                      }>{task.status}</span>
                    </div>
                    {task.details && (
                      <div className="text-gray-400 mt-1">
                        {Object.entries(task.details).map(([key, value]) => (
                          <div key={key} className="pl-2">
                            {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-gray-500 text-xs mt-1">
                      Created: {formatDate(task.timestamp)}
                      {task.stoppedAt && ` • Stopped: ${formatDate(task.stoppedAt)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        } else if (tasks && tasks.length === 0) {
          return (
            <div>
              <div className="font-semibold">{text}</div>
              <div className="text-gray-400 mt-1">No active tasks</div>
            </div>
          );
        }
        if (projects) { // Project list
          return (
            <div>
              <div className="font-semibold mb-2">{text}</div>
              <div className="pl-4 text-sm space-y-2">
                {projects.map((project, i) => (
                  <div key={i} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                    <div>
                      <span className="font-mono">{project.id}</span>
                      <div className="text-gray-400 text-xs">{project.type}</div>
                    </div>
                    <span className={project.status === 'running' ? 'text-green-400' : 'text-red-400'}>
                      {project.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return <div>{text}</div>;
      
      case 'update':
        return <div className="text-green-400">{text}</div>;
      
      default:
        return <div>{text}</div>;
    }
  };

  return (
    <div className={`mb-4 ${user === 'You' ? 'text-right' : 'text-left'}`}>
      <div className="font-bold text-sm text-gray-500 mb-1">{user}</div>
      <div className={`inline-block rounded-lg p-3 max-w-[80%] ${
        type === 'error' ? 'bg-red-900/20' :
        type === 'system' ? 'bg-gray-800' :
        type === 'update' ? 'bg-green-900/20' :
        'bg-gray-800'
      }`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default ChatMessage;