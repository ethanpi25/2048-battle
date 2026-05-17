var App = (function () {
  var socket;
  var game;
  var myBoard;
  var opponentBoard;
  var currentView = 'lobby';
  var gameActive = false;
  var touchStartX = 0;
  var touchStartY = 0;

  function init() {
    socket = new GameSocket();
    socket.connect();

    myBoard = new Board('my-grid', 'my-score');
    opponentBoard = new Board('opponent-grid', 'opponent-score');

    bindUI();
    bindSocket();
    bindInput();
    showView('lobby');
  }

  function showView(view) {
    document.getElementById('view-lobby').classList.remove('active');
    document.getElementById('view-game').classList.remove('active');
    document.getElementById('view-results').classList.remove('active');
    document.getElementById('view-' + view).classList.add('active');
    currentView = view;
  }

  function bindUI() {
    document.getElementById('btn-create').addEventListener('click', function () {
      socket.createRoom();
      document.getElementById('lobby-status').textContent = 'Creating room...';
    });

    document.getElementById('btn-join').addEventListener('click', function () {
      var code = document.getElementById('input-room-code').value.trim().toUpperCase();
      if (!code) return;
      socket.joinRoom(code);
      document.getElementById('lobby-status').textContent = 'Joining room...';
    });

    document.getElementById('btn-play-again').addEventListener('click', function () {
      showView('lobby');
      document.getElementById('lobby-status').textContent = '';
      document.getElementById('room-code-display').classList.add('hidden');
    });

    document.getElementById('btn-back-lobby').addEventListener('click', function () {
      showView('lobby');
      document.getElementById('lobby-status').textContent = '';
      document.getElementById('room-code-display').classList.add('hidden');
    });
  }

  function bindSocket() {
    socket.on('room-created', function (data) {
      document.getElementById('lobby-status').textContent = 'Waiting for opponent...';
      document.getElementById('room-code-display').classList.remove('hidden');
      document.getElementById('room-code-value').textContent = data.roomId;
    });

    socket.on('game-start', function (data) {
      startGame();
    });

    socket.on('opponent-update', function (data) {
      opponentBoard.update(data.grid);
      opponentBoard.updateScore(data.score);
    });

    socket.on('game-over', function (data) {
      gameActive = false;
      showResults(data);
    });

    socket.on('opponent-disconnected', function () {
      gameActive = false;
      showResults({ winner: 'you', reason: 'Opponent disconnected' });
    });

    socket.on('error', function (data) {
      document.getElementById('lobby-status').textContent = data.message || 'An error occurred';
    });
  }

  function startGame() {
    game = new Game2048();
    myBoard.reset();
    opponentBoard.reset();

    showView('game');
    runCountdown(function () {
      var state = game.init();
      myBoard.update(state.grid);
      myBoard.updateScore(state.score);
      gameActive = true;
      socket.sendState(state);
    });
  }

  function runCountdown(callback) {
    var overlay = document.getElementById('countdown-overlay');
    var text = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');

    var counts = ['3', '2', '1', 'GO!'];
    var i = 0;

    function showNext() {
      if (i >= counts.length) {
        overlay.classList.add('hidden');
        callback();
        return;
      }
      text.textContent = counts[i];
      text.classList.remove('countdown-animate');
      void text.offsetWidth;
      text.classList.add('countdown-animate');
      i++;
      setTimeout(showNext, 800);
    }

    showNext();
  }

  function handleMove(direction) {
    if (!gameActive) return;

    var result = game.move(direction);
    if (!result.moved) return;

    myBoard.update(result.grid, result.merged, result.spawned);
    myBoard.updateScore(result.score);
    socket.sendState({ grid: result.grid, score: result.score });

    if (result.gameOver) {
      gameActive = false;
      socket.sendGameOver(result.score);
    }
  }

  function bindInput() {
    document.addEventListener('keydown', function (e) {
      if (currentView !== 'game' || !gameActive) return;

      var direction = null;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': direction = 'up'; break;
        case 'ArrowDown': case 's': case 'S': direction = 'down'; break;
        case 'ArrowLeft': case 'a': case 'A': direction = 'left'; break;
        case 'ArrowRight': case 'd': case 'D': direction = 'right'; break;
      }

      if (direction) {
        e.preventDefault();
        handleMove(direction);
      }
    });

    var gameArea = document.getElementById('view-game');

    gameArea.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gameArea.addEventListener('touchmove', function (e) {
      if (!touchStartX || !touchStartY) return;
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        e.preventDefault();
      }
    }, { passive: false });

    gameArea.addEventListener('touchend', function (e) {
      if (!gameActive) return;

      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 30) return;

      var direction;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }

      e.preventDefault();
      handleMove(direction);
    }, { passive: false });

    var dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = this.getAttribute('data-dir');
        handleMove(dir);
        if (navigator.vibrate) navigator.vibrate(10);
      });
    });
  }

  function showResults(data) {
    var resultTitle = document.getElementById('result-title');
    var resultMessage = document.getElementById('result-message');
    var resultMyScore = document.getElementById('result-my-score');
    var resultOpponentScore = document.getElementById('result-opponent-score');

    if (data.winner === 'you' || data.winner === 'draw') {
      resultTitle.textContent = data.winner === 'draw' ? "It's a Draw!" : 'You Win!';
      resultTitle.className = data.winner === 'draw' ? 'result-draw' : 'result-win';
    } else {
      resultTitle.textContent = 'You Lose';
      resultTitle.className = 'result-lose';
    }

    resultMessage.textContent = data.reason || '';
    resultMyScore.textContent = game ? game.getScore() : 0;
    resultOpponentScore.textContent = data.opponentScore || 0;

    showView('results');
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', App.init);
