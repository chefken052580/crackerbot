export async function processCommand(command, user, openai) {
  try {
    switch(command) {
      case '/list_bot_health':
        return "All bots are healthy and operational.";
      case '/show_bot_tasks':
        return "Active bot tasks: Task1, Task2, Task3.";
      case '/start_task':
        return `New task started by ${user}. Awaiting details...`;
      case '/stop_bots':
        return "Stopping all bots. Shutdown sequence initiated.";
      case '/list_projects':
        return "Active projects: Project A, Project B, Project C.";
      case '/restart_bot':
        return "Restarting bot services... Please wait.";
      default:
        if(command.startsWith('/')) {
          return "Unknown command: " + command;
        } else {
          // OpenAI integration for generic input
          const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: command,
            max_tokens: 100
          });
          return completion.data.choices[0].text.trim();
        }
    }
  } catch (error) {
    console.error("Error in command processing:", error);
    return "An error occurred while processing your command.";
  }
}
