var Board = (function () {
  var TILE_COLORS = {
    2: '#EEE4DA',
    4: '#EDE0C8',
    8: '#F2B179',
    16: '#F59563',
    32: '#F67C5F',
    64: '#F65E3B',
    128: '#EDCF72',
    256: '#EDCC61',
    512: '#EDC850',
    1024: '#EDC53F',
    2048: '#EDC22E'
  };

  var TILE_TEXT_COLORS = {
    2: '#776E65',
    4: '#776E65',
    8: '#F9F6F2',
    16: '#F9F6F2',
    32: '#F9F6F2',
    64: '#F9F6F2',
    128: '#F9F6F2',
    256: '#F9F6F2',
    512: '#F9F6F2',
    1024: '#F9F6F2',
    2048: '#F9F6F2'
  };

  function Board(containerId, scoreId) {
    this.container = document.getElementById(containerId);
    this.scoreEl = document.getElementById(scoreId);
    this.tiles = [];
    this.currentScore = 0;
    this.createGrid();
  }

  Board.prototype.createGrid = function () {
    this.container.innerHTML = '';
    this.tiles = [];
    for (var r = 0; r < 4; r++) {
      this.tiles[r] = [];
      for (var c = 0; c < 4; c++) {
        var cell = document.createElement('div');
        cell.className = 'tile';
        cell.dataset.row = r;
        cell.dataset.col = c;
        this.container.appendChild(cell);
        this.tiles[r][c] = cell;
      }
    }
  };

  Board.prototype.update = function (grid, merged, spawned) {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var tile = this.tiles[r][c];
        var value = grid[r][c];

        tile.textContent = value || '';
        tile.className = 'tile';

        if (value) {
          tile.classList.add('tile-filled');
          tile.style.backgroundColor = TILE_COLORS[value] || '#3C3A32';
          tile.style.color = TILE_TEXT_COLORS[value] || '#F9F6F2';
          if (value >= 1024) {
            tile.classList.add('tile-small-text');
          }
        } else {
          tile.style.backgroundColor = '';
          tile.style.color = '';
        }
      }
    }

    if (merged && merged.length) {
      for (var i = 0; i < merged.length; i++) {
        var m = merged[i];
        this.tiles[m.r][m.c].classList.add('tile-merge');
      }
    }

    if (spawned) {
      this.tiles[spawned.r][spawned.c].classList.add('tile-new');
    }
  };

  Board.prototype.updateScore = function (score) {
    var diff = score - this.currentScore;
    this.currentScore = score;
    this.scoreEl.textContent = score;

    if (diff > 0) {
      this.showScoreAdd(diff);
    }
  };

  Board.prototype.showScoreAdd = function (amount) {
    var floater = document.createElement('div');
    floater.className = 'score-add';
    floater.textContent = '+' + amount;
    this.scoreEl.parentElement.appendChild(floater);
    setTimeout(function () { floater.remove(); }, 600);
  };

  Board.prototype.reset = function () {
    this.currentScore = 0;
    this.scoreEl.textContent = '0';
    this.createGrid();
  };

  return Board;
})();
