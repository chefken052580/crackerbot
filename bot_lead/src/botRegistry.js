export async function processCommand(command, user, openai) {
  try {
    switch(command) {
      case '/list_bot_health':
        return "All bots are healthy.";
      case '/show_bot_tasks':
        return "Bot tasks: Task1, Task2.";
      case '/start_task':
        return `Task started by ${user}.`;
      case '/stop_bots':
        return "All bots stopped.";
      case '/list_projects':
        return "Projects: Project A, Project B.";
      default:
        if(command.startsWith('/')) {
          return "Unknown command: " + command;
        } else {
          // For OpenAI integration
          const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: command,
            max_tokens: 60
          });
          return completion.data.choices[0].text.trim();
        }
    }
  } catch (error) {
    console.error("Error in command processing:", error);
    throw error;
  }
}