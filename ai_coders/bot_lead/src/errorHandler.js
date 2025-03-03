export function handleError(error, location = "Unknown") {
    console.error(`Error in ${location}:`, error.message || error);
    return { response: `Error in ${location}: ${error.message || error}`, type: "error" };
}
