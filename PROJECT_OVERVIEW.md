CrackerBot Project Overview

Project Purpose
CrackerBot is a collaborative system of software engineering bots designed for real-time task management and content generation. It comprises a WebSocket server, frontend bot, lead bot, and backend bot, working together to assist users in creating software artifacts (e.g., code, media, databases) via a chat interface. The system uses Redis for state persistence, WebSocket for communication, and AI for intelligent content generation.
Bot Collective
WebSocket Server (websocket_server)
Role: Central communication hub, relaying messages between bots.

Location: ai_coders/websocket_server/src

Key Files:
server.js: WebSocket server logic

Connection:
Internal: ws://websocket_server:5002

External (via ngrok): wss://<ngrok-url>

Frontend Bot (bot_frontend)
Role: User interface bot, displaying chat and task results.

Location: ai_coders/bot_frontend/

Key Files:
src/components/ChatRoom.jsx: React chat UI, the primary interface for user interaction

src/components/ChatMessage.jsx: Renders individual messages within the chat

src/index.jsx: React entry point with Redux and App component setup

src/App.jsx: Renders ChatRoom as the main application view

src/redux/store.js: Configures the Redux store for state management

src/redux/exampleSlice.js: Example Redux slice for managing chat-related state

Connection: Connects to WebSocket server via wss://<ngrok-url>

Lead Bot (bot_lead)
Role: Task orchestration, state management, content generation.

Location: ai_coders/bot_lead/

Key Files:
taskManager.js: Core task and message handling

redisClient.js: Redis client and message storage

contentUtils.js: Media and content generation utilities

stateManager.js: Manages global state (e.g., lastGeneratedTask), task delegation via WebSocket/HTTP, and task status updates

aiHelper.js: AI response and content generation

commandHandler.js: Command processing

logger.js: Logging utilities

config.js: Configuration

Redis Usage: Primary state store (tasks, users, last generated tasks)

Backend Bot (bot_backend)
Role: Task building, execution, and future database creation/maintenance.

Location: ai_coders/bot_backend/

Key Files:
src/taskBuilder.js: Task building logic (moved from bot_lead)

src/taskExecution.js: Task execution logic (moved from bot_lead)

src/logger.js: Logging utilities for backend bot

Dockerfile: Container setup

package.json: Dependencies

Connection: Integrates via WebSocket (botSocket) and Redis

Status: Actively handles task building and execution

Architecture
Communication: WebSocket (Socket.IO) connects all bots via the WebSocket server.

State: Redis (redis://redis:6379) persists tasks, user data, and history, managed by the lead bot with backend bot access.

AI: OpenAI powers responses and content generation via aiHelper.js.

Docker: Services deployed via docker-compose.yml (redis, websocket_server, bot_lead, bot_frontend, bot_backend).

Directory Structure
ai_coders/websocket_server/: WebSocket Server
server.js: WebSocket server logic

Dockerfile: Server container setup

ai_coders/bot_lead/: Lead Bot
taskManager.js: Task orchestration

redisClient.js: Redis client setup

contentUtils.js: Content generation utilities

stateManager.js: Global state management, task delegation (via WebSocket/HTTP), and task status updates

aiHelper.js: AI integration

commandHandler.js: Command handling

logger.js: Logging utilities

config.js: Configuration

Dockerfile: Lead bot container setup

package.json: Dependencies

ai_coders/bot_frontend/: Frontend Bot
index.html: Project root for Vite build compatibility

src/components/ChatRoom.jsx: React chat UI

src/components/ChatMessage.jsx: Message rendering

src/index.jsx: React entry point with Redux and App component

src/App.jsx: Renders ChatRoom

src/redux/store.js: Redux store configuration

src/redux/exampleSlice.js: Example Redux slice

build/: Vite build output (generated)
index.html: Bundled entry point

assets/: Compiled JS and CSS

public/: Static assets (e.g., favicon.ico, logos)

ai_coders/bot_backend/: Backend Bot
src/taskBuilder.js: Task building logic

src/taskExecution.js: Task execution logic

src/logger.js: Logging utilities

Dockerfile: Backend bot container setup

package.json: Dependencies

/ (Root):
docker-compose.yml: Service definitions

PROJECT_OVERVIEW.md: This file

Key Interactions
Frontend Bot → WebSocket Server: Sends user messages via ChatRoom.jsx to wss://<ngrok-url>.

WebSocket Server → Lead Bot: Relays messages to bot_lead via ws://websocket_server:5002.

Lead Bot → Backend Bot: Delegates tasks to bot_backend for building and execution via delegateTask in stateManager.js.

Backend Bot → Redis: Accesses task data and stores results.

Backend Bot → Frontend Bot: Sends task outputs via botSocket.

Lead Bot → Redis: Manages task states and user data via stateManager.js.

Deployment
Run: cd /mnt/d/crackerbot && docker-compose up --build

Redis: redis://redis:6379 (shared across bots)

WebSocket: Dual endpoints (5002 internal, ngrok external)

Notes
Refactor: taskManager.js modularized on March 03, 2025.

Recent Changes:
taskBuilder.js and taskExecution.js moved to bot_backend/src/.

New logger.js added to bot_backend/src/.

index.html moved to bot_frontend/ root for Vite compatibility.

vite.config.js updated to output build/index.html directly.

Ngrok simplified to a single tunnel for bot_frontend:80.

wsClient.js merged into stateManager.js, which now handles WebSocket client functionality, task delegation, and state management (March 10, 2025).

Dependencies: Node.js, Redis, OpenAI, Socket.IO, React, FFmpeg, ImageMagick.

Testing: Verify Redis connectivity, WebSocket stability, and task delegation to bot_backend.

Last Updated
Date: March 10, 2025

By: [The Crackster]

GitHub Links
Root: Crackerbot

Project: Crackerbot/ai_coders/





PROJECT_OVERVIEW.md FILE:

---

# CrackerBot Project Overview

## Project Purpose
CrackerBot is a collaborative system of software engineering bots designed for real-time task management and content generation. It comprises a WebSocket server, frontend bot, lead bot, and backend bot, working together to assist users in creating software artifacts (e.g., code, media, databases) via a chat interface. The system uses Redis for state persistence, WebSocket for communication, and AI for intelligent content generation.

---

## Bot Collective

### WebSocket Server (`websocket_server`)
- **Role**: Central communication hub, relaying messages between bots.
- **Location**: `ai_coders/websocket_server/src`
- **Key Files**:
  - `server.js`: WebSocket server logic
- **Connection**:
  - Internal: `ws://websocket_server:5002`
  - External (via ngrok): `wss://<ngrok-url>`

### Frontend Bot (`bot_frontend`)
- **Role**: User interface bot, displaying chat and task results.
- **Location**: `ai_coders/bot_frontend/`
- **Key Files**:
  - `src/components/ChatRoom.jsx`: React chat UI, the primary interface for user interaction
  - `src/components/ChatMessage.jsx`: Renders individual messages within the chat
  - `src/index.jsx`: React entry point with Redux and `App` component setup
  - `src/App.jsx`: Renders `ChatRoom` as the main application view
  - `src/redux/store.js`: Configures the Redux store for state management
  - `src/redux/exampleSlice.js`: Example Redux slice for managing chat-related state
- **Connection**: Connects to WebSocket server via `wss://<ngrok-url>`

### Lead Bot (`bot_lead`)
- **Role**: Task orchestration, state management, content generation.
- **Location**: `ai_coders/bot_lead/`
- **Key Files**:
  - `taskManager.js`: Core task and message handling
  - `redisClient.js`: Redis client and message storage
  - `contentUtils.js`: Media and content generation utilities
  - `stateManager.js`: Manages global state (e.g., `lastGeneratedTask`), task delegation via WebSocket/HTTP, and task status updates
  - `aiHelper.js`: AI response and content generation
  - `commandHandler.js`: Command processing
  - `logger.js`: Logging utilities
  - `config.js`: Configuration
- **Redis Usage**: Primary state store (tasks, users, last generated tasks)

### Backend Bot (`bot_backend`)
- **Role**: Task building, execution, and future database creation/maintenance.
- **Location**: `ai_coders/bot_backend/`
- **Key Files**:
  - `src/taskBuilder.js`: Task building logic (moved from `bot_lead`)
  - `src/taskExecution.js`: Task execution logic (moved from `bot_lead`)
  - `src/logger.js`: Logging utilities for backend bot
  - `Dockerfile`: Container setup
  - `package.json`: Dependencies
- **Connection**: Integrates via WebSocket (`botSocket`) and Redis
- **Status**: Actively handles task building and execution

---

## Architecture
- **Communication**: WebSocket (Socket.IO) connects all bots via the WebSocket server.
- **State**: Redis (`redis://redis:6379`) persists tasks, user data, and history, managed by the lead bot with backend bot access.
- **AI**: OpenAI powers responses and content generation via `aiHelper.js`.
- **Docker**: Services deployed via `docker-compose.yml` (`redis`, `websocket_server`, `bot_lead`, `bot_frontend`, `bot_backend`).

---

## Directory Structure
- **`ai_coders/websocket_server/`**: WebSocket Server
  - `server.js`: WebSocket server logic
  - `Dockerfile`: Server container setup

- **`ai_coders/bot_lead/`**: Lead Bot
  - `taskManager.js`: Task orchestration
  - `redisClient.js`: Redis client setup
  - `contentUtils.js`: Content generation utilities
  - `stateManager.js`: Global state management, task delegation (via WebSocket/HTTP), and task status updates
  - `aiHelper.js`: AI integration
  - `commandHandler.js`: Command handling
  - `logger.js`: Logging utilities
  - `config.js`: Configuration
  - `Dockerfile`: Lead bot container setup
  - `package.json`: Dependencies

- **`ai_coders/bot_frontend/`**: Frontend Bot
  - `index.html`: Project root for Vite build compatibility
  - `src/components/ChatRoom.jsx`: React chat UI
  - `src/components/ChatMessage.jsx`: Message rendering
  - `src/index.jsx`: React entry point with Redux and `App` component
  - `src/App.jsx`: Renders `ChatRoom`
  - `src/redux/store.js`: Redux store configuration
  - `src/redux/exampleSlice.js`: Example Redux slice
  - `build/`: Vite build output (generated)
    - `index.html`: Bundled entry point
    - `assets/`: Compiled JS and CSS
  - `public/`: Static assets (e.g., `favicon.ico`, logos)

- **`ai_coders/bot_backend/`**: Backend Bot
  - `src/taskBuilder.js`: Task building logic
  - `src/taskExecution.js`: Task execution logic
  - `src/logger.js`: Logging utilities
  - `Dockerfile`: Backend bot container setup
  - `package.json`: Dependencies

- **`/` (Root)**:
  - `docker-compose.yml`: Service definitions
  - `PROJECT_OVERVIEW.md`: This file

---

## Key Interactions
- **Frontend Bot → WebSocket Server**: Sends user messages via `ChatRoom.jsx` to `wss://<ngrok-url>`.
- **WebSocket Server → Lead Bot**: Relays messages to `bot_lead` via `ws://websocket_server:5002`.
- **Lead Bot → Backend Bot**: Delegates tasks to `bot_backend` for building and execution via `delegateTask` in `stateManager.js`.
- **Backend Bot → Redis**: Accesses task data and stores results.
- **Backend Bot → Frontend Bot**: Sends task outputs via `botSocket`.
- **Lead Bot → Redis**: Manages task states and user data via `stateManager.js`.

---

## Deployment
- **Run**: `cd /mnt/d/crackerbot && docker-compose up --build`
- **Redis**: `redis://redis:6379` (shared across bots)
- **WebSocket**: Dual endpoints (5002 internal, ngrok external)

---

## Notes
- **Refactor**: `taskManager.js` modularized on March 03, 2025.
- **Recent Changes**:
  - `taskBuilder.js` and `taskExecution.js` moved to `bot_backend/src/`.
  - New `logger.js` added to `bot_backend/src/`.
  - `index.html` moved to `bot_frontend/` root for Vite compatibility.
  - `vite.config.js` updated to output `build/index.html` directly.
  - Ngrok simplified to a single tunnel for `bot_frontend:80`.
  - `wsClient.js` merged into `stateManager.js`, which now handles WebSocket client functionality, task delegation, and state management (March 10, 2025).
- **Dependencies**: Node.js, Redis, OpenAI, Socket.IO, React, FFmpeg, ImageMagick.
- **Testing**: Verify Redis connectivity, WebSocket stability, and task delegation to `bot_backend`.

---

## Last Updated
- **Date**: March 10, 2025
- **By**: [The Crackster]

---

## GitHub Links
- **Root**: [Crackerbot](https://github.com/chefken052580/crackerbot/tree/main)
- **Project**: [Crackerbot/ai_coders/](https://github.com/chefken052580/crackerbot/tree/main/ai_coders)