var GameSocket = (function () {
  function GameSocket() {
    this.socket = null;
    this.handlers = {};
    // Throttle state updates to max ~20fps (50ms)
    this._stateThrottleTimer = null;
    this._pendingState = null;
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

    this.socket.on('your-name', function (data) {
      if (self.handlers['your-name']) self.handlers['your-name'](data);
    });

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

    this.socket.on('opponent-temp-disconnect', function (data) {
      if (self.handlers['opponent-temp-disconnect']) self.handlers['opponent-temp-disconnect'](data);
    });

    this.socket.on('opponent-reconnected', function (data) {
      if (self.handlers['opponent-reconnected']) self.handlers['opponent-reconnected'](data);
    });

    this.socket.on('reconnect-status', function (data) {
      if (self.handlers['reconnect-status']) self.handlers['reconnect-status'](data);
    });

    this.socket.on('reconnected', function (data) {
      if (self.handlers['reconnected']) self.handlers['reconnected'](data);
    });

    this.socket.on('room-expired', function (data) {
      if (self.handlers['room-expired']) self.handlers['room-expired'](data);
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
    var self = this;
    this._pendingState = state;
    if (this._stateThrottleTimer) return;
    this._stateThrottleTimer = setTimeout(function () {
      self._stateThrottleTimer = null;
      if (self._pendingState) {
        self.socket.emit('state-update', self._pendingState);
        self._pendingState = null;
      }
    }, 50);
  };

  GameSocket.prototype.sendGameOver = function (score) {
    this.socket.emit('game-over', { score: score });
  };

  GameSocket.prototype.reportScore = function (score) {
    this.socket.emit('report-score', { score: score });
  };

  GameSocket.prototype.checkReconnect = function () {
    this.socket.emit('check-reconnect');
  };

  GameSocket.prototype.doReconnect = function () {
    this.socket.emit('do-reconnect');
  };

  GameSocket.prototype.getId = function () {
    return this.socket ? this.socket.id : null;
  };

  GameSocket.prototype.disconnect = function () {
    if (this.socket) this.socket.disconnect();
  };

  return GameSocket;
})();
