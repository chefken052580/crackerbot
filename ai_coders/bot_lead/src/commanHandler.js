export function handleCommand(botSocket, command, user) {
    console.log('Processing command:', command);

    switch (command) {
        case '/check_bot_health':
            return { response: "All bots are healthy and operational!", type: "success" };

        case '/list_projects':
            return { response: "Active projects: Project A, Project B, Project C.", type: "success" };

        case '/start_task':
            return { response: "What task would you like to start?", type: "question" };

        case '/stop_bots':
            return { response: "Stopping all bots is not implemented yet!", type: "error" };

        default:
            return { response: `Unknown command: ${command}`, type: "error" };
    }
}
