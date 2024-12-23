import asyncio
import websockets
import json

BOT_NAME = "bot_backend"
WEBSOCKET_SERVER_URL = "ws://websocket_server:5002"

async def handle_websocket():
    async with websockets.connect(WEBSOCKET_SERVER_URL) as ws:
        # Register the bot
        await ws.send(json.dumps({"type": "register", "name": BOT_NAME, "role": "backend"}))
        print(f"{BOT_NAME} connected and registered.")

        while True:
            try:
                message = await ws.recv()
                data = json.loads(message)
                print(f"Received message: {data}")

                if data["type"] == "command":
                    await handle_command(ws, data)

            except websockets.exceptions.ConnectionClosed:
                print("WebSocket connection closed. Reconnecting...")
                break
            except Exception as e:
                print(f"Error: {e}")

async def handle_command(ws, command_data):
    command = command_data.get("command")
    user = command_data.get("user")

    if command == "/list_bot_health":
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": f"{BOT_NAME} is healthy and operational.",
        }
        await ws.send(json.dumps(response))
    elif command == "/start_task":
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": "Starting task... What is the task?",
        }
        await ws.send(json.dumps(response))
    else:
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": f"Unknown command: {command}",
        }
        await ws.send(json.dumps(response))

if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(handle_websocket())
