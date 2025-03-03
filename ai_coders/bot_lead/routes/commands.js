const express = require('express'); 
const router = express.Router();

router.post('/', (req, res) => {
  const { command, user, text, type } = req.body;
  let responseText = "";

  switch (type) {
    case 'command':
      switch (command) {
        case "/list_bot_health":
          responseText = "All bots are healthy and operational.";
          break;
        case "/start_task":
          responseText = "What task would you like to start?";
          break;
        case "/show_bot_tasks":
          responseText = "Here are the current tasks for each bot: ...";
          break;
        case "/stop_bots":
          responseText = "All bots have been stopped.";
          break;
        case "/list_projects":
          responseText = "Current projects: Project A, Project B, Project C.";
          break;
        default:
          responseText = `Unknown command: ${command}`;
      }
      break;
    case 'general_message':
      if (text && text.toLowerCase().includes('project')) {
        responseText = "Delegating project-related tasks...";
      } else if (text && text.toLowerCase().includes('task')) {
        responseText = "Handling task request...";
      } else {
        responseText = "Received general message: " + text;
      }
      break;
    default:
      responseText = "Received an unrecognized message type.";
  }

  res.json({ type: "response", user: "bot_lead", text: responseText });
});

module.exports = router;
