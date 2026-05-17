var AIOpponent = (function () {
  var DIRECTIONS = ['up', 'down', 'left', 'right'];

  var INTERVALS = {
    easy:   { min: 720, max: 1080 },
    medium: { min: 480, max: 720 },
    hell:   { min: 300, max: 480 }
  };

  function AIOpponent(difficulty, onUpdate, onGameOver) {
    this.difficulty = difficulty;
    this.onUpdate = onUpdate;
    this.onGameOver = onGameOver;
    this.game = new Game2048();
    this.timer = null;
    this.running = false;
    this.searchDepth = 3;
  }

  AIOpponent.prototype.start = function () {
    var state = this.game.init();
    this.running = true;
    this.onUpdate({ grid: state.grid, score: state.score, merged: [], spawned: null });
    this.scheduleNextMove();
  };

  AIOpponent.prototype.stop = function () {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  AIOpponent.prototype.getScore = function () {
    return this.game.getScore();
  };

  AIOpponent.prototype.scheduleNextMove = function () {
    if (!this.running) return;
    var interval = INTERVALS[this.difficulty];
    var delay = interval.min + Math.random() * (interval.max - interval.min);
    var self = this;
    this.timer = setTimeout(function () { self.tick(); }, delay);
  };

  AIOpponent.prototype.tick = function () {
    if (!this.running) return;

    var direction = this.chooseDirection();
    if (!direction) {
      this.running = false;
      this.onGameOver({ score: this.game.getScore() });
      return;
    }

    var result = this.game.move(direction);
    if (result.moved) {
      this.onUpdate(result);
    }

    if (result.gameOver) {
      this.running = false;
      this.onGameOver({ score: this.game.getScore() });
      return;
    }

    this.scheduleNextMove();
  };

  AIOpponent.prototype.chooseDirection = function () {
    switch (this.difficulty) {
      case 'easy':   return this.strategyEasy();
      case 'medium': return this.strategyMedium();
      case 'hell':   return this.strategyHell();
      default:       return this.strategyEasy();
    }
  };

  // --- Easy: random valid move ---
  AIOpponent.prototype.strategyEasy = function () {
    var shuffled = DIRECTIONS.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var grid = this.game.grid;
    for (var k = 0; k < shuffled.length; k++) {
      var sim = simulateMove(grid, shuffled[k]);
      if (sim.moved) return shuffled[k];
    }
    return null;
  };

  // --- Medium: greedy 1-ply lookahead ---
  AIOpponent.prototype.strategyMedium = function () {
    var grid = this.game.grid;
    var bestDir = null;
    var bestScore = -1;
    var priority = ['down', 'left', 'right', 'up'];

    for (var i = 0; i < priority.length; i++) {
      var dir = priority[i];
      var sim = simulateMove(grid, dir);
      if (!sim.moved) continue;

      var empty = countEmpty(sim.grid);
      var score = sim.scoreGained + empty * 8;
      // corner bonus: max tile in a corner
      var max = getMaxTile(sim.grid);
      var corners = [sim.grid[0][0], sim.grid[0][3], sim.grid[3][0], sim.grid[3][3]];
      for (var c = 0; c < corners.length; c++) {
        if (corners[c] === max) { score += 30; break; }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    return bestDir;
  };

  // --- Hell: expectimax search ---
  AIOpponent.prototype.strategyHell = function () {
    var grid = this.game.grid;
    var t0 = performance.now();

    var bestDir = null;
    var bestVal = -Infinity;

    for (var i = 0; i < DIRECTIONS.length; i++) {
      var sim = simulateMove(grid, DIRECTIONS[i]);
      if (!sim.moved) continue;
      var val = expectimax(sim.grid, this.searchDepth - 1, false);
      if (val > bestVal) {
        bestVal = val;
        bestDir = DIRECTIONS[i];
      }
    }

    var elapsed = performance.now() - t0;
    if (elapsed > 200 && this.searchDepth > 3) {
      this.searchDepth = 3;
    }

    return bestDir;
  };

  // --- Expectimax ---
  function expectimax(grid, depth, isMax) {
    if (depth === 0) return evaluate(grid);

    if (isMax) {
      var maxVal = -Infinity;
      var anyMoved = false;
      for (var i = 0; i < DIRECTIONS.length; i++) {
        var sim = simulateMove(grid, DIRECTIONS[i]);
        if (!sim.moved) continue;
        anyMoved = true;
        var val = expectimax(sim.grid, depth - 1, false);
        if (val > maxVal) maxVal = val;
      }
      return anyMoved ? maxVal : evaluate(grid);
    } else {
      // chance node: random tile spawn
      var empties = [];
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++) {
          if (grid[r][c] === 0) empties.push({ r: r, c: c });
        }
      }
      if (empties.length === 0) return evaluate(grid);

      // sample max 4 cells for performance
      var sampled = empties;
      if (sampled.length > 4) {
        sampled = shuffle(empties).slice(0, 4);
      }

      var totalVal = 0;
      var weight = 1.0 / sampled.length;

      for (var j = 0; j < sampled.length; j++) {
        var cell = sampled[j];

        // spawn 2 (probability 0.9)
        grid[cell.r][cell.c] = 2;
        totalVal += 0.9 * weight * expectimax(grid, depth - 1, true);

        // spawn 4 (probability 0.1)
        grid[cell.r][cell.c] = 4;
        totalVal += 0.1 * weight * expectimax(grid, depth - 1, true);

        // restore
        grid[cell.r][cell.c] = 0;
      }
      return totalVal;
    }
  }

  // --- Evaluation heuristic ---
  function evaluate(grid) {
    var empty = countEmpty(grid);
    var maxTile = getMaxTile(grid);

    var emptyScore = Math.log2(empty + 1) * 2.7;
    var maxScore = Math.log2(maxTile) * 1.0;

    // corner bonus
    var cornerBonus = 0;
    var corners = [grid[0][0], grid[0][3], grid[3][0], grid[3][3]];
    for (var i = 0; i < corners.length; i++) {
      if (corners[i] === maxTile) { cornerBonus = 1.0; break; }
    }

    // monotonicity
    var mono = 0;
    for (var r = 0; r < 4; r++) {
      var incR = 0, decR = 0;
      var incC = 0, decC = 0;
      for (var c = 0; c < 3; c++) {
        var rv = grid[r][c], rv1 = grid[r][c + 1];
        if (rv > rv1) decR += rv - rv1; else incR += rv1 - rv;
        var cv = grid[c][r], cv1 = grid[c + 1][r];
        if (cv > cv1) decC += cv - cv1; else incC += cv1 - cv;
      }
      mono -= Math.min(incR, decR) + Math.min(incC, decC);
    }
    var monoScore = mono * 0.002;

    // smoothness
    var smooth = 0;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var v = grid[r][c];
        if (v === 0) continue;
        var lv = Math.log2(v);
        if (c < 3 && grid[r][c + 1] > 0) smooth -= Math.abs(lv - Math.log2(grid[r][c + 1]));
        if (r < 3 && grid[r + 1][c] > 0) smooth -= Math.abs(lv - Math.log2(grid[r + 1][c]));
      }
    }
    var smoothScore = smooth * 0.1;

    return emptyScore + maxScore + cornerBonus + monoScore + smoothScore;
  }

  // --- Grid simulation (no tile spawn) ---
  function simulateMove(grid, direction) {
    var newGrid = grid.map(function (row) { return row.slice(); });
    var moved = false;
    var scoreGained = 0;

    function slideAndMerge(line) {
      var filtered = line.filter(function (v) { return v !== 0; });
      var result = [];
      var gained = 0;
      for (var i = 0; i < filtered.length; i++) {
        if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
          var val = filtered[i] * 2;
          result.push(val);
          gained += val;
          i++;
        } else {
          result.push(filtered[i]);
        }
      }
      while (result.length < 4) result.push(0);
      return { tiles: result, gained: gained };
    }

    switch (direction) {
      case 'up':
        for (var c = 0; c < 4; c++) {
          var col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
          var res = slideAndMerge(col);
          scoreGained += res.gained;
          for (var r = 0; r < 4; r++) {
            if (newGrid[r][c] !== res.tiles[r]) moved = true;
            newGrid[r][c] = res.tiles[r];
          }
        }
        break;
      case 'down':
        for (var c = 0; c < 4; c++) {
          var col = [newGrid[3][c], newGrid[2][c], newGrid[1][c], newGrid[0][c]];
          var res = slideAndMerge(col);
          scoreGained += res.gained;
          var rev = res.tiles.slice().reverse();
          for (var r = 0; r < 4; r++) {
            if (newGrid[r][c] !== rev[r]) moved = true;
            newGrid[r][c] = rev[r];
          }
        }
        break;
      case 'left':
        for (var r = 0; r < 4; r++) {
          var row = newGrid[r].slice();
          var res = slideAndMerge(row);
          scoreGained += res.gained;
          for (var c = 0; c < 4; c++) {
            if (newGrid[r][c] !== res.tiles[c]) moved = true;
            newGrid[r][c] = res.tiles[c];
          }
        }
        break;
      case 'right':
        for (var r = 0; r < 4; r++) {
          var row = newGrid[r].slice().reverse();
          var res = slideAndMerge(row);
          scoreGained += res.gained;
          var rev = res.tiles.slice().reverse();
          for (var c = 0; c < 4; c++) {
            if (newGrid[r][c] !== rev[c]) moved = true;
            newGrid[r][c] = rev[c];
          }
        }
        break;
    }

    return { grid: newGrid, scoreGained: scoreGained, moved: moved };
  }

  // --- Utility helpers ---
  function countEmpty(grid) {
    var count = 0;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] === 0) count++;
      }
    }
    return count;
  }

  function getMaxTile(grid) {
    var max = 0;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (grid[r][c] > max) max = grid[r][c];
      }
    }
    return max;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  return AIOpponent;
})();
