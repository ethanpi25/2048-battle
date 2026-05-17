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

  // Game timer state (2 minutes countdown)
  var GAME_DURATION = 2 * 60; // 2 minutes in seconds
  var gameTimerInterval = null;
  var gameSecondsLeft = 0;

  // Player wuxia name
  var myWuxiaName = '侠客';

  // Difficulty label map
  var difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hell: '地狱'
  };

  // Cached DOM references
  var dom = {};

  function cacheDom() {
    dom.viewLobby = document.getElementById('view-lobby');
    dom.viewGame = document.getElementById('view-game');
    dom.viewResults = document.getElementById('view-results');
    dom.viewLeaderboard = document.getElementById('view-leaderboard');
    dom.gameTimer = document.getElementById('game-timer');
    dom.soundBtn = document.getElementById('btn-sound-toggle');
    dom.lobbyStatus = document.getElementById('lobby-status');
    dom.roomCodeDisplay = document.getElementById('room-code-display');
    dom.roomCodeValue = document.getElementById('room-code-value');
    dom.btnCopyCode = document.getElementById('btn-copy-code');
    dom.countdownOverlay = document.getElementById('countdown-overlay');
    dom.countdownText = document.getElementById('countdown-text');
    dom.myName = document.getElementById('my-name');
    dom.opponentName = document.getElementById('opponent-name');
    dom.resultTitle = document.getElementById('result-title');
    dom.resultMessage = document.getElementById('result-message');
    dom.resultMyScore = document.getElementById('result-my-score');
    dom.resultOpponentScore = document.getElementById('result-opponent-score');
    dom.resultOpponentLabel = document.getElementById('result-opponent-label');
    dom.inputRoomCode = document.getElementById('input-room-code');
    dom.lbList = document.getElementById('lb-list');
    dom.lbDate = document.getElementById('lb-date');
  }

  function init() {
    cacheDom();

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
    dom.viewLobby.classList.remove('active');
    dom.viewGame.classList.remove('active');
    dom.viewResults.classList.remove('active');
    dom.viewLeaderboard.classList.remove('active');
    document.getElementById('view-' + view).classList.add('active');
    currentView = view;

    // Show/hide game timer and sound button based on view
    if (view === 'game') {
      dom.gameTimer.style.display = '';
      dom.soundBtn.style.display = '';
    } else {
      dom.gameTimer.style.display = 'none';
      dom.soundBtn.style.display = 'none';
    }

    // BGM on game and leaderboard views
    if (view === 'game' || view === 'leaderboard') {
      SoundManager.startBGM();
    } else {
      SoundManager.stopBGM();
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
    dom.roomCodeDisplay.classList.add('hidden');
    dom.lobbyStatus.textContent = '';
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
    dom.gameTimer.classList.remove('warning');
  }

  function updateTimerDisplay() {
    var mins = Math.floor(gameSecondsLeft / 60);
    var secs = gameSecondsLeft % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    dom.gameTimer.textContent = timeStr;

    // Warning state when less than 30 seconds
    if (gameSecondsLeft <= 30 && gameSecondsLeft > 0) {
      dom.gameTimer.classList.add('warning');
    } else {
      dom.gameTimer.classList.remove('warning');
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
      socket.reportScore(playerScore);
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
    dom.lobbyStatus.textContent = '等待对手加入... ' + timeStr;
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

    // Leaderboard button
    document.getElementById('btn-leaderboard').addEventListener('click', function () {
      showLeaderboard();
    });

    // Leaderboard back button
    document.getElementById('btn-lb-back').addEventListener('click', function () {
      showView('lobby');
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
      dom.lobbyStatus.textContent = '创建房间中...';
    });

    document.getElementById('btn-join').addEventListener('click', function () {
      var code = dom.inputRoomCode.value.trim().toUpperCase();
      if (!code) return;
      gameMode = 'room';
      socket.joinRoom(code);
      dom.lobbyStatus.textContent = '加入房间中...';
    });

    // Copy room code
    document.getElementById('btn-copy-code').addEventListener('click', function () {
      var code = dom.roomCodeValue.textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () {
          dom.btnCopyCode.textContent = '\u2713';
          setTimeout(function () {
            dom.btnCopyCode.innerHTML = '&#128203;';
          }, 1500);
        });
      }
    });

    // Sound toggle
    document.getElementById('btn-sound-toggle').addEventListener('click', function () {
      var isMuted = SoundManager.toggleMute();
      if (isMuted) {
        dom.soundBtn.textContent = '🔇';
        dom.soundBtn.classList.add('muted');
      } else {
        dom.soundBtn.textContent = '🔊';
        dom.soundBtn.classList.remove('muted');
        if (currentView === 'game' || currentView === 'leaderboard') {
          SoundManager.startBGM();
        }
      }
    });

    // Results buttons
    document.getElementById('btn-play-again').addEventListener('click', function () {
      if (gameMode === 'ai') {
        startAIGame();
      } else {
        showView('lobby');
        showLobbySection('lobby-room-section');
        dom.lobbyStatus.textContent = '';
        dom.roomCodeDisplay.classList.add('hidden');
      }
    });

    document.getElementById('btn-back-lobby').addEventListener('click', function () {
      stopAI();
      stopGameTimer();
      gameActive = false;
      showView('lobby');
      showLobbySection('mode-select');
      dom.lobbyStatus.textContent = '';
      dom.roomCodeDisplay.classList.add('hidden');
    });
  }

  function bindSocket() {
    socket.on('your-name', function (data) {
      myWuxiaName = data.name;
      dom.myName.textContent = myWuxiaName;
    });

    socket.on('room-created', function (data) {
      dom.roomCodeDisplay.classList.remove('hidden');
      dom.roomCodeValue.textContent = data.roomId;
      // Start waiting countdown
      var waitTime = data.waitTime || 60000;
      startWaitCountdown(waitTime);
    });

    socket.on('game-start', function () {
      clearWaitCountdown();
      dom.opponentName.textContent = '对手';
      dom.resultOpponentLabel.textContent = '对手';
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
      dom.countdownOverlay.classList.remove('hidden');
      dom.countdownText.textContent = '对手重连中...';
    });

    socket.on('opponent-reconnected', function () {
      dom.countdownOverlay.classList.add('hidden');
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
      dom.opponentName.textContent = '对手';
      dom.resultOpponentLabel.textContent = '对手';

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
      dom.lobbyStatus.textContent = data.message || '房间已过期';
      dom.roomCodeDisplay.classList.add('hidden');
    });

    socket.on('error', function (data) {
      clearWaitCountdown();
      dom.lobbyStatus.textContent = data.message || '发生错误';
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
    dom.opponentName.textContent = label;
    dom.resultOpponentLabel.textContent = label;

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
    socket.reportScore(playerScore);
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
    dom.countdownOverlay.classList.remove('hidden');

    var counts = ['3', '2', '1', '开始!'];
    var i = 0;

    function showNext() {
      if (i >= counts.length) {
        dom.countdownOverlay.classList.add('hidden');
        callback();
        return;
      }
      dom.countdownText.textContent = counts[i];
      dom.countdownText.classList.remove('countdown-animate');
      void dom.countdownText.offsetWidth;
      dom.countdownText.classList.add('countdown-animate');
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

    var gameArea = dom.viewGame;

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
    if (data.winner === 'you' || data.winner === 'draw') {
      dom.resultTitle.textContent = data.winner === 'draw' ? '平局！' : '你赢了！';
      dom.resultTitle.className = data.winner === 'draw' ? 'result-draw' : 'result-win';
    } else {
      dom.resultTitle.textContent = '你输了';
      dom.resultTitle.className = 'result-lose';
    }

    dom.resultMessage.textContent = data.reason || '';
    dom.resultMyScore.textContent = game ? game.getScore() : 0;
    dom.resultOpponentScore.textContent = data.opponentScore || 0;

    showView('results');
  }

  // --- Leaderboard ---
  function showLeaderboard() {
    showView('leaderboard');
    dom.lbList.innerHTML = '<p class="lb-loading">加载中...</p>';
    dom.lbDate.textContent = '';

    fetch('/api/leaderboard')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        dom.lbDate.textContent = data.date || '';
        renderLeaderboard(data.scores || []);
      })
      .catch(function () {
        dom.lbList.innerHTML = '<p class="lb-empty">加载失败，请稍后重试</p>';
      });
  }

  function renderLeaderboard(scores) {
    if (scores.length === 0) {
      dom.lbList.innerHTML = '<p class="lb-empty">今日暂无记录，快去对战吧！</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < scores.length; i++) {
      var rankClass = 'lb-rank';
      if (i < 3) rankClass += ' lb-rank-' + (i + 1);
      html += '<div class="lb-row">';
      html += '<div class="' + rankClass + '">' + (i + 1) + '</div>';
      html += '<div class="lb-name">' + escapeHtml(scores[i].name) + '</div>';
      html += '<div class="lb-score">' + scores[i].score + '</div>';
      html += '</div>';
    }
    dom.lbList.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', App.init);
