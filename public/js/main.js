var App = (function () {
  var socket;
  var game;
  var myBoard;
  var opponentBoard;
  var currentView = 'lobby';
  var gameActive = false;
  var touchStartX = 0;
  var touchStartY = 0;

  // AI mode state
  var gameMode = null;    // 'room' | 'ai'
  var aiDifficulty = null;
  var aiOpponent = null;
  var playerDone = false;
  var aiDone = false;
  var aiScore = 0;

  // Waiting timer state
  var waitInterval = null;
  var waitSecondsLeft = 0;

  // Game timer state (5 minutes countdown)
  var GAME_DURATION = 5 * 60; // 5 minutes in seconds
  var gameTimerInterval = null;
  var gameSecondsLeft = 0;

  // Difficulty label map
  var difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hell: '地狱'
  };

  function init() {
    socket = new GameSocket();
    socket.connect();

    myBoard = new Board('my-grid', 'my-score');
    opponentBoard = new Board('opponent-grid', 'opponent-score');

    SoundManager.init();

    bindUI();
    bindSocket();
    bindInput();
    showView('lobby');

    // Check if we can reconnect to an existing game
    socket.checkReconnect();
  }

  function showView(view) {
    document.getElementById('view-lobby').classList.remove('active');
    document.getElementById('view-game').classList.remove('active');
    document.getElementById('view-results').classList.remove('active');
    document.getElementById('view-' + view).classList.add('active');
    currentView = view;

    // Show/hide game timer and sound button based on view
    var timerEl = document.getElementById('game-timer');
    var soundBtn = document.getElementById('btn-sound-toggle');
    if (view === 'game') {
      timerEl.style.display = '';
      soundBtn.style.display = '';
    } else {
      timerEl.style.display = 'none';
      soundBtn.style.display = 'none';
    }
  }

  function showLobbySection(sectionId) {
    var sections = ['mode-select', 'lobby-ai-section', 'lobby-room-section'];
    for (var i = 0; i < sections.length; i++) {
      var el = document.getElementById(sections[i]);
      if (sections[i] === sectionId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
    // hide room code and status when switching sections
    document.getElementById('room-code-display').classList.add('hidden');
    document.getElementById('lobby-status').textContent = '';
  }

  // --- Game Timer ---
  function startGameTimer() {
    stopGameTimer();
    gameSecondsLeft = GAME_DURATION;
    updateTimerDisplay();
    gameTimerInterval = setInterval(function () {
      gameSecondsLeft--;
      if (gameSecondsLeft <= 0) {
        gameSecondsLeft = 0;
        updateTimerDisplay();
        onTimerExpired();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function stopGameTimer() {
    if (gameTimerInterval) {
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
    }
    var timerEl = document.getElementById('game-timer');
    timerEl.classList.remove('warning');
  }

  function updateTimerDisplay() {
    var mins = Math.floor(gameSecondsLeft / 60);
    var secs = gameSecondsLeft % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    var timerEl = document.getElementById('game-timer');
    timerEl.textContent = timeStr;

    // Warning state when less than 30 seconds
    if (gameSecondsLeft <= 30 && gameSecondsLeft > 0) {
      timerEl.classList.add('warning');
    } else {
      timerEl.classList.remove('warning');
    }
  }

  function onTimerExpired() {
    stopGameTimer();
    gameActive = false;

    if (gameMode === 'ai') {
      // Get AI score before stopping it
      var opScore = aiOpponent ? aiOpponent.getScore() : aiScore;
      stopAI();
      var playerScore = game.getScore();
      var winner;
      if (playerScore > opScore) {
        winner = 'you';
      } else if (playerScore < opScore) {
        winner = 'lose';
      } else {
        winner = 'draw';
      }
      SoundManager.playGameOver();
      showResults({ winner: winner, opponentScore: opScore, reason: '时间到' });
    } else if (gameMode === 'room') {
      socket.sendGameOver(game.getScore());
    }
  }

  // --- Wait countdown ---
  function startWaitCountdown(totalMs) {
    clearWaitCountdown();
    waitSecondsLeft = Math.ceil(totalMs / 1000);
    updateWaitDisplay();
    waitInterval = setInterval(function () {
      waitSecondsLeft--;
      if (waitSecondsLeft <= 0) {
        clearWaitCountdown();
      } else {
        updateWaitDisplay();
      }
    }, 1000);
  }

  function updateWaitDisplay() {
    var mins = Math.floor(waitSecondsLeft / 60);
    var secs = waitSecondsLeft % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    document.getElementById('lobby-status').textContent = '等待对手加入... ' + timeStr;
  }

  function clearWaitCountdown() {
    if (waitInterval) {
      clearInterval(waitInterval);
      waitInterval = null;
    }
  }

  function bindUI() {
    // Mode selection
    document.getElementById('btn-ai-mode').addEventListener('click', function () {
      showLobbySection('lobby-ai-section');
    });

    document.getElementById('btn-room-mode').addEventListener('click', function () {
      showLobbySection('lobby-room-section');
    });

    // Back buttons
    document.getElementById('btn-ai-back').addEventListener('click', function () {
      showLobbySection('mode-select');
    });

    document.getElementById('btn-room-back').addEventListener('click', function () {
      clearWaitCountdown();
      showLobbySection('mode-select');
    });

    // Difficulty buttons
    document.getElementById('btn-diff-easy').addEventListener('click', function () {
      gameMode = 'ai';
      aiDifficulty = 'easy';
      startAIGame();
    });

    document.getElementById('btn-diff-medium').addEventListener('click', function () {
      gameMode = 'ai';
      aiDifficulty = 'medium';
      startAIGame();
    });

    document.getElementById('btn-diff-hell').addEventListener('click', function () {
      gameMode = 'ai';
      aiDifficulty = 'hell';
      startAIGame();
    });

    // Room buttons
    document.getElementById('btn-create').addEventListener('click', function () {
      gameMode = 'room';
      socket.createRoom();
      document.getElementById('lobby-status').textContent = '创建房间中...';
    });

    document.getElementById('btn-join').addEventListener('click', function () {
      var code = document.getElementById('input-room-code').value.trim().toUpperCase();
      if (!code) return;
      gameMode = 'room';
      socket.joinRoom(code);
      document.getElementById('lobby-status').textContent = '加入房间中...';
    });

    // Copy room code
    document.getElementById('btn-copy-code').addEventListener('click', function () {
      var code = document.getElementById('room-code-value').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () {
          document.getElementById('btn-copy-code').textContent = '\u2713';
          setTimeout(function () {
            document.getElementById('btn-copy-code').innerHTML = '&#128203;';
          }, 1500);
        });
      }
    });

    // Sound toggle
    document.getElementById('btn-sound-toggle').addEventListener('click', function () {
      var isMuted = SoundManager.toggleMute();
      var btn = document.getElementById('btn-sound-toggle');
      if (isMuted) {
        btn.textContent = '🔇';
        btn.classList.add('muted');
      } else {
        btn.textContent = '🔊';
        btn.classList.remove('muted');
      }
    });

    // Results buttons
    document.getElementById('btn-play-again').addEventListener('click', function () {
      if (gameMode === 'ai') {
        startAIGame();
      } else {
        showView('lobby');
        showLobbySection('lobby-room-section');
        document.getElementById('lobby-status').textContent = '';
        document.getElementById('room-code-display').classList.add('hidden');
      }
    });

    document.getElementById('btn-back-lobby').addEventListener('click', function () {
      stopAI();
      stopGameTimer();
      gameActive = false;
      showView('lobby');
      showLobbySection('mode-select');
      document.getElementById('lobby-status').textContent = '';
      document.getElementById('room-code-display').classList.add('hidden');
    });
  }

  function bindSocket() {
    socket.on('room-created', function (data) {
      document.getElementById('room-code-display').classList.remove('hidden');
      document.getElementById('room-code-value').textContent = data.roomId;
      // Start waiting countdown
      var waitTime = data.waitTime || 60000;
      startWaitCountdown(waitTime);
    });

    socket.on('game-start', function () {
      clearWaitCountdown();
      document.getElementById('opponent-name').textContent = '对手';
      document.getElementById('result-opponent-label').textContent = '对手';
      startRoomGame();
    });

    socket.on('opponent-update', function (data) {
      opponentBoard.update(data.grid);
      opponentBoard.updateScore(data.score);
    });

    socket.on('game-over', function (data) {
      gameActive = false;
      stopGameTimer();
      // translate winner socket ID to 'you' / 'lose'
      var myId = socket.getId();
      var opponentScore = 0;
      if (data.scores) {
        for (var i = 0; i < data.scores.length; i++) {
          if (data.scores[i].id !== myId) {
            opponentScore = data.scores[i].score;
          }
        }
      }
      if (data.winner === myId) {
        data.winner = 'you';
      } else if (data.winner !== 'draw') {
        data.winner = 'lose';
      }
      data.opponentScore = opponentScore;
      SoundManager.playGameOver();
      showResults(data);
    });

    socket.on('opponent-disconnected', function () {
      gameActive = false;
      stopGameTimer();
      showResults({ winner: 'you', reason: '对手已断开连接' });
    });

    socket.on('opponent-temp-disconnect', function () {
      // Show a notification that opponent disconnected temporarily
      var overlay = document.getElementById('countdown-overlay');
      var text = document.getElementById('countdown-text');
      overlay.classList.remove('hidden');
      text.textContent = '对手重连中...';
    });

    socket.on('opponent-reconnected', function () {
      // Hide the overlay
      var overlay = document.getElementById('countdown-overlay');
      overlay.classList.add('hidden');
    });

    socket.on('reconnect-status', function (data) {
      if (data.canReconnect) {
        // Auto-reconnect to existing game
        gameMode = 'room';
        socket.doReconnect();
      }
    });

    socket.on('reconnected', function (data) {
      // Restore game state after reconnection
      game = new Game2048();
      myBoard.reset();
      opponentBoard.reset();

      showView('game');
      document.getElementById('opponent-name').textContent = '对手';
      document.getElementById('result-opponent-label').textContent = '对手';

      // Restore my state
      if (data.myState && data.myState.grid) {
        game.restoreState(data.myState);
        myBoard.update(data.myState.grid);
        myBoard.updateScore(data.myState.score);
      } else {
        var state = game.init();
        myBoard.update(state.grid);
        myBoard.updateScore(state.score);
        socket.sendState(state);
      }

      // Restore opponent state
      if (data.opponentState && data.opponentState.grid) {
        opponentBoard.update(data.opponentState.grid);
        opponentBoard.updateScore(data.opponentState.score);
      }

      gameActive = true;
      startGameTimer();
    });

    socket.on('room-expired', function (data) {
      clearWaitCountdown();
      document.getElementById('lobby-status').textContent = data.message || '房间已过期';
      document.getElementById('room-code-display').classList.add('hidden');
    });

    socket.on('error', function (data) {
      clearWaitCountdown();
      document.getElementById('lobby-status').textContent = data.message || '发生错误';
    });
  }

  // --- Room game (existing flow) ---
  function startRoomGame() {
    game = new Game2048();
    myBoard.reset();
    opponentBoard.reset();
    SoundManager.resetMilestone();

    showView('game');
    runCountdown(function () {
      var state = game.init();
      myBoard.update(state.grid);
      myBoard.updateScore(state.score);
      gameActive = true;
      socket.sendState(state);
      startGameTimer();
    });
  }

  // --- AI game (new flow) ---
  function startAIGame() {
    stopAI();
    stopGameTimer();
    game = new Game2048();
    myBoard.reset();
    opponentBoard.reset();
    playerDone = false;
    aiDone = false;
    aiScore = 0;
    SoundManager.resetMilestone();

    var label = 'AI (' + difficultyLabels[aiDifficulty] + ')';
    document.getElementById('opponent-name').textContent = label;
    document.getElementById('result-opponent-label').textContent = label;

    showView('game');
    runCountdown(function () {
      var state = game.init();
      myBoard.update(state.grid);
      myBoard.updateScore(state.score);
      gameActive = true;

      aiOpponent = new AIOpponent(aiDifficulty, onAIUpdate, onAIGameOver);
      aiOpponent.start();
      startGameTimer();
    });
  }

  function onAIUpdate(result) {
    opponentBoard.update(result.grid, result.merged, result.spawned);
    opponentBoard.updateScore(result.score);
  }

  function onAIGameOver(data) {
    aiDone = true;
    aiScore = data.score;
    checkAIGameEnd();
  }

  function checkAIGameEnd() {
    if (!playerDone || !aiDone) return;
    stopAI();
    stopGameTimer();
    gameActive = false;

    var playerScore = game.getScore();
    var winner;
    if (playerScore > aiScore) {
      winner = 'you';
    } else if (playerScore < aiScore) {
      winner = 'lose';
    } else {
      winner = 'draw';
    }

    SoundManager.playGameOver();
    showResults({ winner: winner, opponentScore: aiScore });
  }

  function stopAI() {
    if (aiOpponent) {
      aiOpponent.stop();
      aiOpponent = null;
    }
  }

  // --- Shared ---
  function runCountdown(callback) {
    var overlay = document.getElementById('countdown-overlay');
    var text = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');

    var counts = ['3', '2', '1', '开始!'];
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
      SoundManager.playCountdown();
      i++;
      setTimeout(showNext, 800);
    }

    showNext();
  }

  function handleMove(direction) {
    if (!gameActive) return;

    var result = game.move(direction);
    if (!result.moved) return;

    // Play sound effects
    if (result.merged && result.merged.length > 0) {
      SoundManager.playMerge();
    } else {
      SoundManager.playMove();
    }

    myBoard.update(result.grid, result.merged, result.spawned);
    myBoard.updateScore(result.score);

    // Check score milestone for voice effect
    SoundManager.checkMilestone(result.score);

    if (gameMode === 'room') {
      socket.sendState({ grid: result.grid, score: result.score });
      if (result.gameOver) {
        gameActive = false;
        stopGameTimer();
        socket.sendGameOver(result.score);
      }
    } else if (gameMode === 'ai') {
      if (result.gameOver) {
        gameActive = false;
        playerDone = true;
        checkAIGameEnd();
      }
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

  }

  function showResults(data) {
    var resultTitle = document.getElementById('result-title');
    var resultMessage = document.getElementById('result-message');
    var resultMyScore = document.getElementById('result-my-score');
    var resultOpponentScore = document.getElementById('result-opponent-score');

    if (data.winner === 'you' || data.winner === 'draw') {
      resultTitle.textContent = data.winner === 'draw' ? '平局！' : '你赢了！';
      resultTitle.className = data.winner === 'draw' ? 'result-draw' : 'result-win';
    } else {
      resultTitle.textContent = '你输了';
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
