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
  - External (via ngrok): `wss://websocket-visually-sterling-spider.ngrok-free.app`
- **Status**: Successfully running and accepting connections from `bot_backend` and `bot_lead`.

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
- **Connection**: Connects to WebSocket server via `wss://websocket-visually-sterling-spider.ngrok-free.app`
- **Current Status**: Still having issues resolving a connection issue with the WebSocket server and addressing Content Security Policy (CSP) issues that is causing a blank screen. Recent updates include moving `index.html` to the project root for Vite compatibility and modifying `vite.config.js` to output `build/index.html` directly.

### Lead Bot (`bot_lead`)
- **Role**: Task orchestration, state management, content generation.
- **Location**: `ai_coders/bot_lead/`
- **Key Files**:
  - `taskManager.js`: Core task and message handling
  - `redisClient.js`: Redis client and message storage
  - `contentUtils.js`: Media and content generation utilities
  - `stateManager.js`: Manages global state (e.g., `lastGeneratedTask`), task delegation via WebSocket/HTTP, and task status updates; includes WebSocket client functionality after merging `wsClient.js` (March 10, 2025)
  - `aiHelper.js`: AI response and content generation
  - `commandHandler.js`: Command processing
  - `logger.js`: Logging utilities
  - `config.js`: Configuration
- **Redis Usage**: Primary state store (tasks, users, last generated tasks)
- **Connection**: Connected to WebSocket at `wss://websocket-visually-sterling-spider.ngrok-free.app`
- **Status**: Successfully connected to Redis and WebSocket server, managing tasks and state effectively.

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
- **Status**: Actively handles task building and execution, running on port 5000.

---

## Architecture
- **Communication**: WebSocket (Socket.IO) connects all bots via the WebSocket server for real-time interaction.
- **State**: Redis (`redis://redis:6379`) persists tasks, user data, and history, managed by the lead bot with backend bot access.
- **AI**: OpenAI powers responses and content generation via `aiHelper.js`.
- **Docker**: Services deployed via `docker-compose.yml` (`redis`, `websocket_server`, `bot_lead`, `bot_frontend`, `bot_backend`, `ngrok`).

---

## Directory Structure
- **`ai_coders/websocket_server/`**: WebSocket Server
  - `server.js`: WebSocket server logic
  - `Dockerfile`: Server container setup

- **`ai_coders/bot_lead/`**: Lead Bot
  - `taskManager.js`: Task orchestration
  - `redisClient.js`: Redis client setup
  - `contentUtils.js`: Content generation utilities
  - `stateManager.js`: Global state management, task delegation, and task status updates
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
- **Frontend Bot → WebSocket Server**: Sends user messages via `ChatRoom.jsx` to `wss://websocket-visually-sterling-spider.ngrok-free.app`.
- **WebSocket Server → Lead Bot**: Relays messages to `bot_lead` via `ws://websocket_server:5002`.
- **Lead Bot → Backend Bot**: Delegates tasks to `bot_backend` for building and execution via `delegateTask` in `stateManager.js`.
- **Backend Bot → Redis**: Accesses task data and stores results.
- **Backend Bot → Frontend Bot**: Sends task outputs via `botSocket`.
- **Lead Bot → Redis**: Manages task states and user data via `stateManager.js`.

---

## Deployment
- **Run**: `cd /mnt/d/crackerbot && docker-compose up --build`
- **Redis**: `redis://redis:6379` (shared across bots, confirmed running)
- **WebSocket**: Dual endpoints (5002 internal, ngrok external at `wss://websocket-visually-sterling-spider.ngrok-free.app`)
- **Ngrok**: Simplified to a single tunnel for `bot_frontend:80` (external URL: `https://visually-sterling-spider.ngrok-free.app`)

---

## Accomplishments and Recent Changes
- **Architecture and Setup**:
  - Established a clear architecture with well-defined roles for each bot.
  - Organized the project with a modular directory structure for each component.

- **Communication and State Management**:
  - Integrated WebSocket (Socket.IO) for real-time communication.
  - Set up Redis for persistent state management across bots.

- **AI Integration**:
  - Incorporated OpenAI for intelligent content generation and responses.

- **Dockerization**:
  - Containerized all services using Docker and `docker-compose.yml`.
  - Integrated Ngrok for external access to the frontend and WebSocket server.

- **Frontend Development**:
  - Developed the frontend using React with components for chat functionality.
  - Integrated Redux for state management.

- **Task Management and Delegation**:
  - Implemented task orchestration in the lead bot.
  - Moved task building and execution to the backend bot for better separation of concerns.

- **Logging and Configuration**:
  - Added logging utilities for improved debugging.
  - Created configuration files for managing settings.

- **Refactoring and Modularization**:
  - Modularized `taskManager.js` for better maintainability (March 03, 2025).
  - Merged `wsClient.js` into `stateManager.js` to consolidate functionality (March 10, 2025).

- **Troubleshooting and Debugging**:
  - Still seeing Content Security Policy (CSP) issues to ensure the frontend renders correctly.
  - Still having a WebSocket connection issues for the frontend bot, still not connecting to websocket_server docker container.

- **Ngrok Integration**:
  - Simplified Ngrok to use a single tunnel for the frontend bot.

- **Dependency Management**:
  - Managed dependencies using `package.json` for each bot, including Node.js, Redis, OpenAI, Socket.IO, React, FFmpeg, and ImageMagick.

- **Testing and Verification**:
  - Provided instructions for testing Redis connectivity, WebSocket stability, and task delegation.

- **Documentation**:
  - Maintained and updated `PROJECT_OVERVIEW.md` to reflect the current state of the project.

---

## Last Updated
- **Date**: March 12, 2025
- **By**: [The Crackster]

---

## GitHub Links
- **Root**: [Crackerbot](https://github.com/chefken052580/crackerbot/tree/main)
- **Project**: [Crackerbot/ai_coders/](https://github.com/chefken052580/crackerbot/tree/main/ai_coders)