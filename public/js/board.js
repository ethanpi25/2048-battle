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
    this.prevGrid = null;
    this.createGrid();
  }

  Board.prototype.createGrid = function () {
    var frag = document.createDocumentFragment();
    this.tiles = [];
    for (var r = 0; r < 4; r++) {
      this.tiles[r] = [];
      for (var c = 0; c < 4; c++) {
        var cell = document.createElement('div');
        cell.className = 'tile';
        frag.appendChild(cell);
        this.tiles[r][c] = cell;
      }
    }
    this.container.innerHTML = '';
    this.container.appendChild(frag);
  };

  Board.prototype.update = function (grid, merged, spawned) {
    var prev = this.prevGrid;

    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var value = grid[r][c];

        // Skip unchanged cells (no merged/spawned animation needed)
        if (prev && prev[r][c] === value) {
          // But still check if this cell needs merge/spawn animation
          var needsAnim = false;
          if (merged && merged.length) {
            for (var m = 0; m < merged.length; m++) {
              if (merged[m].r === r && merged[m].c === c) { needsAnim = true; break; }
            }
          }
          if (spawned && spawned.r === r && spawned.c === c) needsAnim = true;
          if (!needsAnim) continue;
        }

        var tile = this.tiles[r][c];
        tile.textContent = value || '';

        if (value) {
          tile.className = 'tile tile-filled' + (value >= 1024 ? ' tile-small-text' : '');
          tile.style.backgroundColor = TILE_COLORS[value] || '#3C3A32';
          tile.style.color = TILE_TEXT_COLORS[value] || '#F9F6F2';
        } else {
          tile.className = 'tile';
          tile.style.backgroundColor = '';
          tile.style.color = '';
        }
      }
    }

    if (merged && merged.length) {
      for (var i = 0; i < merged.length; i++) {
        this.tiles[merged[i].r][merged[i].c].classList.add('tile-merge');
      }
    }

    if (spawned) {
      this.tiles[spawned.r][spawned.c].classList.add('tile-new');
    }

    // Store current grid for diffing
    this.prevGrid = grid.map(function (row) { return row.slice(); });
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
    this.prevGrid = null;
    this.scoreEl.textContent = '0';
    this.createGrid();
  };

  return Board;
})();
