const { Server: SocketIO } = require('socket.io');

let io = null;

/** Creates the Socket.IO server on the given HTTP server (same CORS settings as before). */
function initSocket(server) {
  io = new SocketIO(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
  });
  return io;
}

/** Returns the initialised Socket.IO instance (used by services that emit events). */
function getIO() {
  if (!io) throw new Error('Socket.IO has not been initialised');
  return io;
}

module.exports = { initSocket, getIO };
