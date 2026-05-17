var GameSocket = (function () {
  function GameSocket() {
    this.socket = null;
    this.handlers = {};
  }

  GameSocket.prototype.connect = function () {
    this.socket = io();
    this.setupListeners();
  };

  GameSocket.prototype.on = function (event, handler) {
    this.handlers[event] = handler;
  };

  GameSocket.prototype.setupListeners = function () {
    var self = this;

    this.socket.on('room-created', function (data) {
      if (self.handlers['room-created']) self.handlers['room-created'](data);
    });

    this.socket.on('game-start', function (data) {
      if (self.handlers['game-start']) self.handlers['game-start'](data);
    });

    this.socket.on('opponent-update', function (data) {
      if (self.handlers['opponent-update']) self.handlers['opponent-update'](data);
    });

    this.socket.on('game-over', function (data) {
      if (self.handlers['game-over']) self.handlers['game-over'](data);
    });

    this.socket.on('opponent-disconnected', function (data) {
      if (self.handlers['opponent-disconnected']) self.handlers['opponent-disconnected'](data);
    });

    this.socket.on('error', function (data) {
      if (self.handlers['error']) self.handlers['error'](data);
    });
  };

  GameSocket.prototype.createRoom = function () {
    this.socket.emit('create-room');
  };

  GameSocket.prototype.joinRoom = function (roomId) {
    this.socket.emit('join-room', { roomId: roomId });
  };

  GameSocket.prototype.sendState = function (state) {
    this.socket.emit('state-update', state);
  };

  GameSocket.prototype.sendGameOver = function (score) {
    this.socket.emit('game-over', { score: score });
  };

  GameSocket.prototype.disconnect = function () {
    if (this.socket) this.socket.disconnect();
  };

  return GameSocket;
})();
