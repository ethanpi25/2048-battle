const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const compression = require('compression');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Gzip compression for all text-based responses
app.use(compression({ level: 6, threshold: 256 }));

// Static files with aggressive cache headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: function (res, filePath) {
    if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

const WUXIA_NAMES = [
  '乔峰', '段誉', '虚竹', '令狐冲', '张无忌',
  '杨过', '郭靖', '黄蓉', '小龙女', '韦小宝',
  '岳不群', '任我行', '东方不败', '风清扬', '独孤求败',
  '萧远山', '慕容复', '黄药师', '欧阳锋', '洪七公',
  '周伯通', '一灯大师', '张三丰', '灭绝师太', '谢逊',
  '殷素素', '赵敏', '周芷若', '阿紫', '王语嫣',
  '李莫愁', '梅超风', '林平之', '余沧海', '左冷禅',
  '莫大先生', '田伯光', '不戒和尚', '桃谷六仙', '向问天',
  '任盈盈', '蓝凤凰', '仪琳', '定逸师太', '方证大师',
  '冲虚道长', '天山童姥', '李秋水', '丁春秋', '游坦之',
  '萧峰', '鸠摩智', '包不同', '王重阳', '林朝英',
  '陆小凤', '西门吹雪', '花满楼', '楚留香', '胡铁花'
];

function getWuxiaName(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % WUXIA_NAMES.length;
  return WUXIA_NAMES[index];
}

const rooms = new Map();
// Maps IP -> { roomId, playerIndex, disconnectedAt }
const disconnectedPlayers = new Map();

// Daily leaderboard: { date: 'YYYY-MM-DD', scores: [{ name, score, ip, timestamp }] }
const leaderboard = { date: '', scores: [] };

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function resetLeaderboardIfNewDay() {
  const today = getTodayStr();
  if (leaderboard.date !== today) {
    leaderboard.date = today;
    leaderboard.scores = [];
  }
}

function recordScore(ip, score) {
  resetLeaderboardIfNewDay();
  const name = getWuxiaName(ip);
  leaderboard.scores.push({ name, score, ip, timestamp: Date.now() });
}

function getTopScores(limit) {
  resetLeaderboardIfNewDay();
  const best = {};
  for (const entry of leaderboard.scores) {
    if (!best[entry.ip] || entry.score > best[entry.ip].score) {
      best[entry.ip] = entry;
    }
  }
  return Object.values(best)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || 20)
    .map(({ name, score }) => ({ name, score }));
}

app.get('/api/leaderboard', (req, res) => {
  res.json({ date: leaderboard.date || getTodayStr(), scores: getTopScores(20) });
});

const WAIT_TIMEOUT = 60000; // 1 minute waiting for opponent
const RECONNECT_GRACE = 60000; // 1 minute grace period for reconnection

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(id) ? generateRoomId() : id;
}

function getClientIp(socket) {
  return socket.handshake.headers['x-forwarded-for']
    ? socket.handshake.headers['x-forwarded-for'].split(',')[0].trim()
    : socket.handshake.address;
}

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);
  socket.clientIp = clientIp;

  const wuxiaName = getWuxiaName(clientIp);
  socket.wuxiaName = wuxiaName;
  socket.emit('your-name', { name: wuxiaName });

  // Check for reconnection opportunity
  socket.on('check-reconnect', () => {
    const entry = disconnectedPlayers.get(clientIp);
    if (!entry) return socket.emit('reconnect-status', { canReconnect: false });

    const room = rooms.get(entry.roomId);
    if (!room || !room.started) {
      disconnectedPlayers.delete(clientIp);
      return socket.emit('reconnect-status', { canReconnect: false });
    }

    socket.emit('reconnect-status', {
      canReconnect: true,
      roomId: entry.roomId
    });
  });

  socket.on('do-reconnect', () => {
    const entry = disconnectedPlayers.get(clientIp);
    if (!entry) return socket.emit('error', { message: 'No session to reconnect' });

    const room = rooms.get(entry.roomId);
    if (!room || !room.started) {
      disconnectedPlayers.delete(clientIp);
      return socket.emit('error', { message: 'Room no longer exists' });
    }

    // Clear reconnect timeout
    if (entry.timeout) clearTimeout(entry.timeout);
    disconnectedPlayers.delete(clientIp);

    // Replace old socket ID with new one
    room.players[entry.playerIndex] = socket.id;
    room.playerIps[entry.playerIndex] = clientIp;

    // Migrate state from old socket ID to new
    if (room.states[entry.oldSocketId]) {
      room.states[socket.id] = room.states[entry.oldSocketId];
      delete room.states[entry.oldSocketId];
    }

    socket.join(entry.roomId);
    socket.roomId = entry.roomId;

    // Get opponent's latest state
    const opponentIndex = entry.playerIndex === 0 ? 1 : 0;
    const opponentSocketId = room.players[opponentIndex];
    const opponentState = room.states[opponentSocketId] || null;
    const myState = room.states[socket.id] || null;

    socket.emit('reconnected', {
      roomId: entry.roomId,
      myState: myState,
      opponentState: opponentState
    });

    // Notify opponent that player reconnected
    socket.to(entry.roomId).emit('opponent-reconnected');
  });

  socket.on('create-room', () => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      players: [socket.id],
      playerIps: [clientIp],
      states: {},
      started: false,
      waitTimer: null
    });
    socket.join(roomId);
    socket.roomId = roomId;

    // Start 60s waiting timer
    const room = rooms.get(roomId);
    room.waitTimer = setTimeout(() => {
      const r = rooms.get(roomId);
      if (r && !r.started) {
        io.to(roomId).emit('room-expired', { message: 'No opponent joined in time' });
        rooms.delete(roomId);
      }
    }, WAIT_TIMEOUT);

    socket.emit('room-created', { roomId, waitTime: WAIT_TIMEOUT });
  });

  socket.on('join-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.players.length >= 2) return socket.emit('error', { message: 'Room is full' });

    // Cancel waiting timer
    if (room.waitTimer) {
      clearTimeout(room.waitTimer);
      room.waitTimer = null;
    }

    room.players.push(socket.id);
    room.playerIps.push(clientIp);
    room.started = true;
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
    // Record score to leaderboard
    recordScore(socket.clientIp, score);
    room.states[socket.id] = { ...room.states[socket.id], score, done: true };

    const allDone = room.players.every((p) => room.states[p]?.done);
    if (allDone) {
      const scores = room.players.map((p) => ({ id: p, score: room.states[p].score }));
      let winner;
      if (scores[0].score === scores[1].score) {
        winner = 'draw';
      } else {
        winner = scores[0].score > scores[1].score ? scores[0].id : scores[1].id;
      }
      io.to(socket.roomId).emit('game-over', { winner, scores });
    }
  });

  socket.on('play-again', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.states = {};
    io.to(socket.roomId).emit('game-start', { roomId: socket.roomId, players: room.players });
  });

  // Record AI mode score to leaderboard
  socket.on('report-score', ({ score }) => {
    if (typeof score === 'number' && score > 0) {
      recordScore(socket.clientIp, score);
    }
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const playerIndex = room.players.indexOf(socket.id);
    if (playerIndex === -1) return;

    // If game is in progress (started and 2 players), allow reconnection
    if (room.started && room.players.length === 2) {
      // Mark as disconnected, allow grace period for reconnection
      const entry = {
        roomId: socket.roomId,
        playerIndex: playerIndex,
        oldSocketId: socket.id,
        disconnectedAt: Date.now(),
        timeout: null
      };

      entry.timeout = setTimeout(() => {
        // Grace period expired - finalize disconnect
        disconnectedPlayers.delete(clientIp);
        const r = rooms.get(entry.roomId);
        if (r) {
          r.players = r.players.filter((p) => p !== entry.oldSocketId);
          if (r.players.length === 0) {
            rooms.delete(entry.roomId);
          } else {
            io.to(entry.roomId).emit('opponent-disconnected');
          }
        }
      }, RECONNECT_GRACE);

      disconnectedPlayers.set(clientIp, entry);

      // Notify opponent of temporary disconnect
      socket.to(socket.roomId).emit('opponent-temp-disconnect');
    } else {
      // Game not started or only 1 player - clean up immediately
      room.players = room.players.filter((p) => p !== socket.id);
      if (room.waitTimer) {
        clearTimeout(room.waitTimer);
        room.waitTimer = null;
      }
      if (room.players.length === 0) {
        rooms.delete(socket.roomId);
      } else {
        io.to(socket.roomId).emit('opponent-disconnected');
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
