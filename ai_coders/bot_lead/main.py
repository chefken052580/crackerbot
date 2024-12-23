import sys
import os
import asyncio
import websockets
import json
from dotenv import load_dotenv
from openai import OpenAI
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get API key from environment, raise error if not found
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment")

openai = OpenAI(api_key=openai_api_key)

# Use environment variables for WebSocket URL and model
WEBSOCKET_SERVER_URL = os.getenv("WEBSOCKET_SERVER_URL", "ws://websocket_server:5002")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4")
BOT_NAME = "bot_lead"

async def handle_websocket():
    while True:
        try:
            async with websockets.connect(WEBSOCKET_SERVER_URL) as ws:
                # Register the bot
                await ws.send(json.dumps({"type": "register", "name": BOT_NAME, "role": "lead"}))
                logger.info(f"{BOT_NAME} connected and registered.")

                while True:
                    try:
                        message = await ws.recv()
                        data = json.loads(message)
                        logger.info(f"Received message: {data}")

                        if data["type"] == "command":
                            await handle_command(ws, data)

                    except websockets.exceptions.ConnectionClosed:
                        logger.warning("WebSocket connection closed. Reconnecting...")
                        break
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")

        except Exception as e:
            logger.error(f"WebSocket connection error: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)


async def handle_command(ws, command_data):
    command = command_data.get("command")
    user = command_data.get("user")

    if command == "/list_bot_health":
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": "All bots are healthy and operational.",
        }
        await ws.send(json.dumps(response))
    elif command == "/start_task":
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": "What task would you like to start?",
        }
        await ws.send(json.dumps(response))
    else:
        response_text = await ask_openai(f"The admin asked: {command}")
        response = {
            "type": "response",
            "user": BOT_NAME,
            "text": response_text,
        }
        await ws.send(json.dumps(response))


async def ask_openai(prompt, retries=3):
    for attempt in range(retries):
        try:
            response = await openai.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are the lead bot."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=150,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if attempt == retries - 1:
                logger.error(f"OpenAI Error after {retries} attempts: {e}")
                return "I couldn't process that request."
            await asyncio.sleep(2 ** attempt)  # Exponential backoff


if __name__ == "__main__":
    asyncio.run(handle_websocket())