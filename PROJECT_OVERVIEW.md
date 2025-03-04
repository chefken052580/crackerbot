# CrackerBot Project Overview

## Project Purpose
CrackerBot is a collaborative system of software engineering bots designed for real-time task management and content generation. It comprises a **WebSocket server**, **frontend bot**, **backend bot**, **lead bot**, and **bot_backend**, working together to assist users in creating software artifacts (code, media, databases) via a chat interface. The system uses Redis for state persistence, WebSocket for communication, and AI for content generation.

## Bot Collective
1. **WebSocket Server (`websocket_server`)**
   - **Role:** Central communication hub, relaying messages between bots.
   - **Location:** `ai_coders/websocket_server/`
   - **Key File:** `server.js` (originally a monolith, partially refactored)
   - **Connection:** `ws://websocket_server:5002` (internal), `wss://<ngrok-url>` (external via ngrok)

2. **Frontend Bot (`bot_frontend`)**
   - **Role:** User interface bot, displaying chat and task results.
   - **Location:** `ai_coders/bot_frontend/`
   - **Key File:** `src/components/ChatRoom.jsx` (React UI)
   - **Connection:** Connects to WebSocket server via `wss://<ngrok-url>`

3. **Backend Bot (`bot_lead` - partial overlap with lead bot)**
   - **Role:** Message relay and initial user greeting, supports lead bot.
   - **Location:** `ai_coders/bot_lead/`
   - **Key File:** `wsClient.js` (WebSocket client)
   - **Connection:** Connects to WebSocket server at `ws://websocket_server:5002`
   - **Redis Usage:** Checks user names via `redisClient`

4. **Lead Bot (`bot_lead`)**
   - **Role:** Task orchestration, state management, content generation.
   - **Location:** `ai_coders/bot_lead/`
   - **Key Files:**
     - `taskManager.js`: Core task and message handling
     - `redisClient.js`: Redis client and message storage
     - `contentUtils.js`: Media and content generation utilities
     - `taskBuilder.js`: Task building and editing
     - `stateManager.js`: Global state (e.g., `lastGeneratedTask`)
     - `aiHelper.js`: AI response and content generation
     - `commandHandler.js`: Command processing
   - **Redis Usage:** Primary state store (tasks, users, last generated tasks)

5. **Bot Backend (`bot_backend`)**
   - **Role:** Future database creation/maintenance and full-stack backend functions.
   - **Location:** `ai_coders/bot_backend/`
   - **Key Files:** `Dockerfile`, `package.json` (in development)
   - **Connection:** Will integrate via WebSocket (`botSocket`) and Redis
   - **Status:** Early stage, to be expanded for database tasks

## Architecture
- **Communication:** WebSocket (Socket.IO) connects all bots via the WebSocket server.
- **State:** Redis (`redis://redis:6379`) persists tasks, user data, and history, primarily managed by the lead bot, with backend bot access.
- **AI:** OpenAI powers responses and content generation via `aiHelper.js`.
- **Docker:** Services deployed via `docker-compose.yml` (redis, websocket_server, bot_lead, bot_frontend, bot_backend).

## Directory Structure
- **`ai_coders/websocket_server/`**: WebSocket Server
  - `server.js`: WebSocket server logic
  - `Dockerfile`: Server container setup
- **`ai_coders/bot_lead/`**: Lead Bot (includes backend bot logic)
  - `taskManager.js`: Core task orchestration
  - `redisClient.js`: Redis client setup
  - `contentUtils.js`: Content generation utilities
  - `taskBuilder.js`: Task building/editing
  - `stateManager.js`: Global state management
  - `aiHelper.js`: AI integration
  - `commandHandler.js`: Command handling
  - `wsClient.js`: WebSocket client for backend/lead bot and botSocket
  - `logger.js`: Logging utilities
  - `config.js`: Configuration
  - `Dockerfile`: Lead bot container setup
- **`ai_coders/bot_frontend/`**: Frontend Bot
  - `src/components/ChatRoom.jsx`: React chat UI
  - `src/components/ChatMessage.jsx`: Message rendering
- **`ai_coders/bot_backend/`**: Bot Backend
  - `Dockerfile`: Backend bot container setup
  - `package.json`: Dependencies (in development)
- **`/`**: Root
  - `docker-compose.yml`: Service definitions
  - `PROJECT_OVERVIEW.md`: This file

## Key Interactions
- **Frontend Bot → WebSocket Server:** Sends user messages via `ChatRoom.jsx` to `wss://<ngrok-url>`.
- **WebSocket Server → Lead Bot:** Relays messages to `bot_lead` via `ws://websocket_server:5002`.
- **Lead Bot → Redis:** Stores task state, user data in `redisClient.js`.
- **Lead Bot → Frontend Bot:** Sends responses (e.g., task progress, files) via `botSocket`.
- **Backend Bot:** Supports lead bot with initial greetings via `wsClient.js`.
- **Bot Backend:** Future role in database tasks, delegated by lead bot via `delegateTask`.

## Deployment
- **Run:** `cd /mnt/d/crackerbot && docker-compose up --build`
- **Redis:** `redis://redis:6379` (shared across bots)
- **WebSocket:** Dual endpoints (`5002` internal, ngrok external)

## Notes
- **Refactor:** `taskManager.js` split into modules on March 03, 2025 for maintainability.
- **Bot Backend:** In development, will handle database creation/maintenance for full-stack tasks.
- **Dependencies:** Node.js, Redis, OpenAI, Socket.IO, React, FFmpeg, ImageMagick (see `package.json`).
- **Testing:** Verify Redis connectivity, WebSocket stability, task flow, and bot_backend integration readiness.

## Last Updated
- **Date:** March 03, 2025
- **By:** [The Crackster]

## Github 
- **(ROOT)/Crackerbot:** https://github.com/chefken052580/crackerbot/tree/main
- **(PROJECT)/Crackerbot/ai_coders/:** https://github.com/chefken052580/crackerbot/tree/main/ai_coders