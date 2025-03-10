import io from 'socket.io-client';

export const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_URL || `ws://${process.env.SERVER_HOST || 'websocket_server'}:${process.env.WEBSOCKET_PORT || 5002}`;
export const BACKEND_URL = process.env.BACKEND_URL || "http://bot_backend:5000";

export const botSocket = io(WEBSOCKET_SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket'],
  path: '/socket.io',
});