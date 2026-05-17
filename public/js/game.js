var Game2048 = (function () {
  function Game2048() {
    this.grid = [];
    this.score = 0;
    this.moved = false;
  }

  Game2048.prototype.init = function () {
    this.grid = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    this.score = 0;
    this.spawnTile();
    this.spawnTile();
    return this.getState();
  };

  Game2048.prototype.spawnTile = function () {
    var empty = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (this.grid[r][c] === 0) empty.push({ r: r, c: c });
      }
    }
    if (empty.length === 0) return;
    var cell = empty[Math.floor(Math.random() * empty.length)];
    this.grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    return cell;
  };

  Game2048.prototype.move = function (direction) {
    this.moved = false;
    var merged = [];

    switch (direction) {
      case 'up':
        for (var c = 0; c < 4; c++) {
          var col = [this.grid[0][c], this.grid[1][c], this.grid[2][c], this.grid[3][c]];
          var result = this.slideAndMerge(col);
          for (var r = 0; r < 4; r++) {
            if (this.grid[r][c] !== result.tiles[r]) this.moved = true;
            this.grid[r][c] = result.tiles[r];
          }
          merged = merged.concat(result.merged.map(function (i) { return { r: i, c: c }; }));
        }
        break;
      case 'down':
        for (var c = 0; c < 4; c++) {
          var col = [this.grid[3][c], this.grid[2][c], this.grid[1][c], this.grid[0][c]];
          var result = this.slideAndMerge(col);
          var reversed = result.tiles.slice().reverse();
          for (var r = 0; r < 4; r++) {
            if (this.grid[r][c] !== reversed[r]) this.moved = true;
            this.grid[r][c] = reversed[r];
          }
          merged = merged.concat(result.merged.map(function (i) { return { r: 3 - i, c: c }; }));
        }
        break;
      case 'left':
        for (var r = 0; r < 4; r++) {
          var row = this.grid[r].slice();
          var result = this.slideAndMerge(row);
          for (var c = 0; c < 4; c++) {
            if (this.grid[r][c] !== result.tiles[c]) this.moved = true;
            this.grid[r][c] = result.tiles[c];
          }
          merged = merged.concat(result.merged.map(function (i) { return { r: r, c: i }; }));
        }
        break;
      case 'right':
        for (var r = 0; r < 4; r++) {
          var row = this.grid[r].slice().reverse();
          var result = this.slideAndMerge(row);
          var reversed = result.tiles.slice().reverse();
          for (var c = 0; c < 4; c++) {
            if (this.grid[r][c] !== reversed[c]) this.moved = true;
            this.grid[r][c] = reversed[c];
          }
          merged = merged.concat(result.merged.map(function (i) { return { r: r, c: 3 - i }; }));
        }
        break;
    }

    var spawned = null;
    if (this.moved) {
      spawned = this.spawnTile();
    }

    return {
      moved: this.moved,
      grid: this.grid.map(function (row) { return row.slice(); }),
      score: this.score,
      merged: merged,
      spawned: spawned,
      gameOver: this.isGameOver()
    };
  };

  Game2048.prototype.slideAndMerge = function (line) {
    var filtered = line.filter(function (v) { return v !== 0; });
    var merged = [];
    var result = [];

    for (var i = 0; i < filtered.length; i++) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        var val = filtered[i] * 2;
        result.push(val);
        this.score += val;
        merged.push(result.length - 1);
        i++;
      } else {
        result.push(filtered[i]);
      }
    }

    while (result.length < 4) result.push(0);
    return { tiles: result, merged: merged };
  };

  Game2048.prototype.canMove = function () {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (this.grid[r][c] === 0) return true;
        if (c < 3 && this.grid[r][c] === this.grid[r][c + 1]) return true;
        if (r < 3 && this.grid[r][c] === this.grid[r + 1][c]) return true;
      }
    }
    return false;
  };

  Game2048.prototype.isGameOver = function () {
    return !this.canMove();
  };

  Game2048.prototype.getScore = function () {
    return this.score;
  };

  Game2048.prototype.getState = function () {
    return {
      grid: this.grid.map(function (row) { return row.slice(); }),
      score: this.score,
      gameOver: this.isGameOver()
    };
  };

  Game2048.prototype.restoreState = function (state) {
    if (state.grid) {
      this.grid = state.grid.map(function (row) { return row.slice(); });
    }
    if (typeof state.score === 'number') {
      this.score = state.score;
    }
  };

  return Game2048;
})();
