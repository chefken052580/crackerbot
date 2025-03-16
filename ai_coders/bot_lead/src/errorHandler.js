export function handleError(error, location = "Unknown") {
    const errorMessage = error.message || String(error);
    const stackTrace = error.stack || "No stack trace available";
    console.error(`Error in ${location}: ${errorMessage}\nStack: ${stackTrace}`);
    return { 
      response: `Error in ${location}: ${errorMessage}`, 
      type: "error",
      details: stackTrace // Optional: Include stack for frontend debugging
    };
  }