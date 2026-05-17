const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(id) ? generateRoomId() : id;
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const roomId = generateRoomId();
    rooms.set(roomId, { players: [socket.id], states: {} });
    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit('room-created', { roomId });
  });

  socket.on('join-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.players.length >= 2) return socket.emit('error', { message: 'Room is full' });

    room.players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    io.to(roomId).emit('game-start', { roomId, players: room.players });
  });

  socket.on('state-update', (state) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.states[socket.id] = state;
    socket.to(socket.roomId).emit('opponent-update', state);
  });

  socket.on('game-over', ({ score }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.states[socket.id] = { ...room.states[socket.id], score, done: true };

    const allDone = room.players.every((p) => room.states[p]?.done);
    if (allDone) {
      const scores = room.players.map((p) => ({ id: p, score: room.states[p].score }));
      const winner = scores[0].score >= scores[1].score ? scores[0].id : scores[1].id;
      io.to(socket.roomId).emit('game-over', { winner, scores });
    }
  });

  socket.on('play-again', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.states = {};
    io.to(socket.roomId).emit('game-start', { roomId: socket.roomId, players: room.players });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p !== socket.id);
    if (room.players.length === 0) {
      rooms.delete(socket.roomId);
    } else {
      io.to(socket.roomId).emit('opponent-disconnected');
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
