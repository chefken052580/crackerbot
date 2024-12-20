#!/bin/bash

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok could not be found, please ensure it's installed."
    exit 1
fi

# Define path to ngrok configuration file
NGROK_CONFIG_FILE="/usr/src/app/ngrok.yml"

# Clean up old tunnels
echo "Cleaning up old tunnels..."
ngrok config clean

# Start ngrok with configuration file
echo "Starting ngrok with configuration file..."
ngrok start --config $NGROK_CONFIG_FILE --all

# Keep the container running
echo "Ngrok setup complete. Keeping container running..."
tail -f /dev/null

echo "Reading ngrok config from: $(ls -l /etc/ngrok.yml)"