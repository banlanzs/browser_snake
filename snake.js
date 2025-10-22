'use strict';

var GRID_WIDTH = 40;
var SNAKE_CELL = 1;
var SNAKE_HEAD_CELL = 3; // 新增蛇头单元格类型
var FOOD_CELL = 2;
var UP = {x: 0, y: -1};
var DOWN = {x: 0, y: 1};
var LEFT = {x: -1, y: 0};
var RIGHT = {x: 1, y: 0};
var INITIAL_SNAKE_LENGTH = 4;
var BRAILLE_SPACE = '\u2800';

var grid;
var snake;
var currentDirection;
var moveQueue;
var hasMoved;
var gamePaused = false;
var urlRevealed = false;
var whitespaceReplacementChar;

// 快速移动和加速功能相关变量
var lastKeyDownTime = 0;
var keyDownTimer = null;
var isRightKeyDown = false;
var isLeftKeyDown = false;
var isUpKeyDown = false;
var isDownKeyDown = false;
var isAccelerating = false;
var accelerationFactor = 1; // 加速因子，1为正常速度，2为两倍速
var fastMoveTriggered = false; // 防止快速移动重复触发

function main() {
  detectBrowserUrlWhitespaceEscaping();
  cleanUrl();
  setupEventHandlers();
  drawMaxScore();
  drawScoreHistory(); // 添加这一行来显示历史得分
  initUrlRevealed();
  startGame();

  var lastFrameTime = Date.now();
  window.requestAnimationFrame(function frameHandler() {
    var now = Date.now();
    if (!gamePaused && now - lastFrameTime >= tickTime()) {
      updateWorld();
      drawWorld();
      lastFrameTime = now;
    }
    window.requestAnimationFrame(frameHandler);
  });
}

function detectBrowserUrlWhitespaceEscaping() {
  // Write two Braille whitespace characters to the hash because Firefox doesn't
  // escape single WS chars between words.
  history.replaceState(null, null, '#' + BRAILLE_SPACE + BRAILLE_SPACE)
  if (location.hash.indexOf(BRAILLE_SPACE) == -1) {
    console.warn('Browser is escaping whitespace characters on URL')
    var replacementData = pickWhitespaceReplacementChar();
    whitespaceReplacementChar = replacementData[0];
    $('#url-escaping-note').classList.remove('invisible');
    $('#replacement-char-description').textContent = replacementData[1];
  }
}

function cleanUrl() {
  // In order to have the most space for the game, shown on the URL hash,
  // remove all query string parameters and trailing / from the URL.
  history.replaceState(null, null, location.pathname.replace(/\b\/$/, ''));
}

function setupEventHandlers() {
  var directionsByKey = {
    // Arrows
    37: LEFT, 38: UP, 39: RIGHT, 40: DOWN,
    // WASD
    87: UP, 65: LEFT, 83: DOWN, 68: RIGHT,
    // hjkl
    75: UP, 72: LEFT, 74: DOWN, 76: RIGHT
  };

  document.onkeydown = function (event) {
    var key = event.keyCode;
    if (key in directionsByKey) {
      // 特殊处理方向键快速移动和加速
      if ((key === 39 || key === 68 || key === 76) && directionsByKey[key] === RIGHT) {
        handleDirectionKeyDown(RIGHT, 'right');
      } else if ((key === 37 || key === 65 || key === 72) && directionsByKey[key] === LEFT) {
        handleDirectionKeyDown(LEFT, 'left');
      } else if ((key === 38 || key === 87 || key === 75) && directionsByKey[key] === UP) {
        handleDirectionKeyDown(UP, 'up');
      } else if ((key === 40 || key === 83 || key === 74) && directionsByKey[key] === DOWN) {
        handleDirectionKeyDown(DOWN, 'down');
      } else {
        changeDirection(directionsByKey[key]);
      }
      event.preventDefault();
    }
  };

  document.onkeyup = function (event) {
    var key = event.keyCode;
    if (key === 39 || key === 68 || key === 76) {
      handleDirectionKeyUp('right');
    } else if (key === 37 || key === 65 || key === 72) {
      handleDirectionKeyUp('left');
    } else if (key === 38 || key === 87 || key === 75) {
      handleDirectionKeyUp('up');
    } else if (key === 40 || key === 83 || key === 74) {
      handleDirectionKeyUp('down');
    }
  };

  // Use touchstart instead of mousedown because these arrows are only shown on
  // touch devices, and also because there is a delay between touchstart and
  // mousedown on those devices, and the game should respond ASAP.
  $('#up').ontouchstart = function () { handleDirectionKeyDown(UP, 'up') };
  $('#down').ontouchstart = function () { handleDirectionKeyDown(DOWN, 'down') };
  $('#left').ontouchstart = function () { handleDirectionKeyDown(LEFT, 'left') };
  $('#right').ontouchstart = function () { handleDirectionKeyDown(RIGHT, 'right') };
  
  $('#up').ontouchend = function () { handleDirectionKeyUp('up') };
  $('#down').ontouchend = function () { handleDirectionKeyUp('down') };
  $('#left').ontouchend = function () { handleDirectionKeyUp('left') };
  $('#right').ontouchend = function () { handleDirectionKeyUp('right') };

  window.onblur = function pauseGame() {
    gamePaused = true;
    window.history.replaceState(null, null, location.hash + '[paused]');
  };

  window.onfocus = function unpauseGame() {
    gamePaused = false;
    drawWorld();
  };

  $('#reveal-url').onclick = function (e) {
    e.preventDefault();
    setUrlRevealed(!urlRevealed);
  };

  // 添加可视化网格切换按钮事件处理
  $('#toggle-visual-grid').onclick = function () {
    var visualGridContainer = $('#visual-grid-container');
    var button = $('#toggle-visual-grid');
    if (visualGridContainer.classList.contains('invisible')) {
      visualGridContainer.classList.remove('invisible');
      button.textContent = 'Hide Visual Grid';
    } else {
      visualGridContainer.classList.add('invisible');
      button.textContent = 'Show Visual Grid';
    }
  };

  // 添加暂停按钮事件处理
  $('#toggle-pause').onclick = function () {
    togglePause();
  };

  document.querySelectorAll('.expandable').forEach(function (expandable) {
    var expand = expandable.querySelector('.expand-btn');
    var collapse = expandable.querySelector('.collapse-btn');
    var content = expandable.querySelector('.expandable-content');
    expand.onclick = collapse.onclick = function () {
      expand.classList.remove('hidden');
      content.classList.remove('hidden');
      expandable.classList.toggle('expanded');
    };
    // Hide the expand button or the content when the animation ends so those
    // elements are not interactive anymore.
    // Surely there's a way to do this with CSS animations more directly.
    expandable.ontransitionend = function () {
      var expanded = expandable.classList.contains('expanded');
      expand.classList.toggle('hidden', expanded);
      content.classList.toggle('hidden', !expanded);
    };
  });
  
  // 添加历史得分容器的事件处理
  var scoreHistoryContainer = $('#score-history-container');
  if (scoreHistoryContainer) {
    var expand = scoreHistoryContainer.querySelector('.expand-btn');
    var collapse = scoreHistoryContainer.querySelector('.collapse-btn');
    var content = scoreHistoryContainer.querySelector('.expandable-content');
    
    if (expand && collapse && content) {
      expand.onclick = collapse.onclick = function () {
        expand.classList.remove('hidden');
        content.classList.remove('hidden');
        scoreHistoryContainer.classList.toggle('expanded');
      };
      
      scoreHistoryContainer.ontransitionend = function () {
        var expanded = scoreHistoryContainer.classList.contains('expanded');
        expand.classList.toggle('hidden', expanded);
        content.classList.toggle('hidden', !expanded);
      };
    }
  }
}

function initUrlRevealed() {
  setUrlRevealed(Boolean(localStorage.urlRevealed));
}

// Some browsers don't display the page URL, either partially (e.g. Safari) or
// entirely (e.g. mobile in-app web-views). To make the game playable in such
// cases, the player can choose to "reveal" the URL within the page body.
function setUrlRevealed(value) {
  urlRevealed = value;
  $('#url-container').classList.toggle('invisible', !urlRevealed);
  if (urlRevealed) {
    localStorage.urlRevealed = 'y';
  } else {
    delete localStorage.urlRevealed;
  }
}

function startGame() {
  grid = new Array(GRID_WIDTH * 4);
  snake = [];
  for (var x = 0; x < INITIAL_SNAKE_LENGTH; x++) {
    var y = 2;
    snake.unshift({x: x, y: y});
    setCellAt(x, y, SNAKE_CELL);
  }
  // 设置蛇头
  setCellAt(snake[0].x, snake[0].y, SNAKE_HEAD_CELL);
  currentDirection = RIGHT;
  moveQueue = [];
  hasMoved = false;
  dropFood();
  
  // 立即更新URL以反映新游戏开始
  immediateUpdateUrl('#|' + gridString() + '|[score:0]');
}

function updateWorld() {
  if (moveQueue.length) {
    currentDirection = moveQueue.pop();
  }

  var head = snake[0];
  var tail = snake[snake.length - 1];
  var newX = head.x + currentDirection.x;
  var newY = head.y + currentDirection.y;

  var outOfBounds = newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= 4;
  var collidesWithSelf = cellAt(newX, newY) === SNAKE_CELL
    && !(newX === tail.x && newY === tail.y);

  if (outOfBounds || collidesWithSelf) {
    endGame();
    startGame();
    return;
  }

  var eatsFood = cellAt(newX, newY) === FOOD_CELL;
  if (!eatsFood) {
    snake.pop();
    setCellAt(tail.x, tail.y, null);
  }

  // Advance head after tail so it can occupy the same cell on next tick.
  // 先清除旧的蛇头标记
  setCellAt(head.x, head.y, SNAKE_CELL);
  // 设置新的蛇头位置
  setCellAt(newX, newY, SNAKE_HEAD_CELL);
  snake.unshift({x: newX, y: newY});

  if (eatsFood) {
    dropFood();
  }
}

function endGame() {
  var score = currentScore();
  var maxScore = parseInt(localStorage.maxScore || 0);
  if (score > 0 && score > maxScore && hasMoved) {
    localStorage.maxScore = score;
    localStorage.maxScoreGrid = gridString();
    drawMaxScore();
    showMaxScore();
  }
  
  // 保存历史得分
  saveScoreToHistory(score);
  
  // 立即更新URL以反映游戏结束状态
  immediateUpdateUrl('#|' + gridString() + '|[score:' + score + ']');
}

// 保存得分到历史记录
function saveScoreToHistory(score) {
  // 获取现有的历史得分数组或创建一个空数组
  var scoreHistory = JSON.parse(localStorage.scoreHistory || '[]');
  
  // 添加新的得分记录（包含时间戳）
  scoreHistory.unshift({
    score: score,
    timestamp: new Date().toISOString()
  });
  
  // 只保留最近10条记录
  if (scoreHistory.length > 10) {
    scoreHistory = scoreHistory.slice(0, 10);
  }
  
  // 保存到localStorage
  localStorage.scoreHistory = JSON.stringify(scoreHistory);
  
  // 更新历史得分显示
  drawScoreHistory();
}

// 绘制历史得分
function drawScoreHistory() {
  var scoreHistory = JSON.parse(localStorage.scoreHistory || '[]');
  if (scoreHistory.length === 0) {
    return;
  }
  
  var scoreHistoryList = $('#score-history-list');
  scoreHistoryList.innerHTML = '';
  
  // 添加历史得分列表项
  scoreHistory.forEach(function(record, index) {
    var listItem = document.createElement('li');
    var scoreText = record.score == 1 ? '1 point' : record.score + ' points';
    var date = new Date(record.timestamp);
    var dateString = date.toLocaleString();
    
    listItem.textContent = (index === 0 ? '[Latest] ' : '') + scoreText + ' - ' + dateString;
    scoreHistoryList.appendChild(listItem);
  });
  
  // 显示历史得分容器
  $('#score-history-container').classList.remove('hidden');
}

function drawWorld() {
  var hash = '#|' + gridString() + '|[score:' + currentScore() + ']';

  // 更新可视化网格显示
  var visualGrid = '';
  for (var y = 0; y < 4; y++) {
    for (var x = 0; x < GRID_WIDTH; x++) {
      visualGrid += charAt(x, y);
    }
    if (y < 3) visualGrid += '\n';
  }
  $('#visual-grid').textContent = visualGrid;

  if (urlRevealed) {
    // Use the original game representation on the on-DOM view, as there are no
    // escaping issues there.
    $('#url').textContent = location.href.replace(/#.*$/, '') + hash + '\n' + visualGrid;
  }

  // Modern browsers don't escape whitespace characters on the address bar URL for
  // security reasons. In case this browser does that, replace the empty Braille
  // character with a non-whitespace (and hopefully non-intrusive) symbol.
  if (whitespaceReplacementChar) {
    hash = hash.replace(/\u2800/g, whitespaceReplacementChar);
  }

  // 使用防抖动机制来限制URL更新频率，避免产生过多的历史记录
  debouncedUpdateUrl(hash);
}

// 防抖动函数，限制URL更新频率
var urlUpdateTimeout;
function debouncedUpdateUrl(hash) {
  // 清除之前的定时器
  if (urlUpdateTimeout) {
    clearTimeout(urlUpdateTimeout);
  }
  
  // 设置新的定时器，延迟更新URL
  urlUpdateTimeout = setTimeout(function() {
    try {
      history.replaceState(null, null, hash);
    } catch (e) {
      console.warn('Failed to update URL with history.replaceState:', e);
      // 如果history.replaceState失败，则尝试使用location.hash
      // 但在设置前检查是否与当前hash相同，避免不必要的历史记录
      if (decodeURIComponent(location.hash) !== hash) {
        location.hash = hash;
      }
    }
  }, 50); // 50ms的延迟应该足够防止过于频繁的更新
}

// 立即更新URL的函数，用于游戏状态改变时（如游戏结束）
function immediateUpdateUrl(hash) {
  // 清除任何待处理的防抖动更新
  if (urlUpdateTimeout) {
    clearTimeout(urlUpdateTimeout);
    urlUpdateTimeout = null;
  }
  
  try {
    history.replaceState(null, null, hash);
  } catch (e) {
    console.warn('Failed to update URL with history.replaceState:', e);
    // 如果history.replaceState失败，则尝试使用location.hash
    // 但在设置前检查是否与当前hash相同，避免不必要的历史记录
    if (decodeURIComponent(location.hash) !== hash) {
      location.hash = hash;
    }
  }
}

function gridString() {
  var str = '';
  for (var x = 0; x < GRID_WIDTH; x += 2) {
    // Unicode Braille patterns are 256 code points going from 0x2800 to 0x28FF.
    // They follow a binary pattern where the bits are, from least significant
    // to most: ⠁⠂⠄⠈⠐⠠⡀⢀
    // So, for example, 147 (10010011) corresponds to ⢓
    var n = 0
      | bitAt(x, 0) << 0
      | bitAt(x, 1) << 1
      | bitAt(x, 2) << 2
      | bitAt(x + 1, 0) << 3
      | bitAt(x + 1, 1) << 4
      | bitAt(x + 1, 2) << 5
      | bitAt(x, 3) << 6
      | bitAt(x + 1, 3) << 7;
    str += String.fromCharCode(0x2800 + n);
  }
  return str;
}

// 获取指定位置的位值，用于Braille字符渲染
function bitAt(x, y) {
  var cell = cellAt(x, y);
  // 蛇身和蛇头都显示为点，食物也显示为点
  return cell ? 1 : 0;
}

// 获取指定位置的字符，用于在DOM中显示（带箭头的蛇头）
function charAt(x, y) {
  var cell = cellAt(x, y);
  if (cell === SNAKE_HEAD_CELL) {
    // 根据当前方向返回相应的箭头字符
    if (currentDirection === UP) return '↑';
    if (currentDirection === DOWN) return '↓';
    if (currentDirection === LEFT) return '←';
    if (currentDirection === RIGHT) return '→';
    return '●'; // 默认圆形
  }
  if (cell === SNAKE_CELL) {
    return '●'; // 蛇身用圆点表示
  }
  if (cell === FOOD_CELL) {
    return '●'; // 食物用圆点表示
  }
  return ' '; // 空白
}

// 重写tickTime函数以支持加速
function tickTime() {
  // Game speed increases as snake grows.
  var start = 125;
  var end = 75;
  var normalTime = start + snake.length * (end - start) / grid.length;
  // 应用加速因子
  return normalTime / accelerationFactor;
}

function currentScore() {
  return snake.length - INITIAL_SNAKE_LENGTH;
}

function cellAt(x, y) {
  return grid[x % GRID_WIDTH + y * GRID_WIDTH];
}

function setCellAt(x, y, cellType) {
  grid[x % GRID_WIDTH + y * GRID_WIDTH] = cellType;
}

function dropFood() {
  var emptyCells = grid.length - snake.length;
  if (emptyCells === 0) {
    return;
  }
  var dropCounter = Math.floor(Math.random() * emptyCells);
  for (var i = 0; i < grid.length; i++) {
    if (grid[i] === SNAKE_CELL) {
      continue;
    }
    if (dropCounter === 0) {
      grid[i] = FOOD_CELL;
      break;
    }
    dropCounter--;
  }
}

function changeDirection(newDir) {
  var lastDir = moveQueue[0] || currentDirection;
  var opposite = newDir.x + lastDir.x === 0 && newDir.y + lastDir.y === 0;
  if (!opposite) {
    // Process moves in a queue to prevent multiple direction changes per tick.
    moveQueue.unshift(newDir);
  }
  hasMoved = true;
}

// 处理方向键按下事件（快速移动和加速）
function handleDirectionKeyDown(direction, directionName) {
  var now = Date.now();
  
  // 设置对应方向键的状态
  if (directionName === 'right') isRightKeyDown = true;
  if (directionName === 'left') isLeftKeyDown = true;
  if (directionName === 'up') isUpKeyDown = true;
  if (directionName === 'down') isDownKeyDown = true;
  
  // 检查是否为快速点击（300ms内）
  if (now - lastKeyDownTime < 300 && !fastMoveTriggered) {
    // 快速点击，执行快速移动
    fastMoveTriggered = true;
    // 快速移动3格
    for (var i = 0; i < 3; i++) {
      changeDirection(direction);
    }
    // 重置快速移动触发标志
    setTimeout(function() {
      fastMoveTriggered = false;
    }, 300);
  } else if (now - lastKeyDownTime >= 300) {
    // 正常点击，开始计时检测长按
    fastMoveTriggered = false;
    changeDirection(direction);
    
    // 清除之前的计时器
    if (keyDownTimer) {
      clearTimeout(keyDownTimer);
    }
    
    // 设置长按检测计时器
    keyDownTimer = setTimeout(function() {
      // 检查是否仍有方向键被按下
      if (isRightKeyDown || isLeftKeyDown || isUpKeyDown || isDownKeyDown) {
        // 长按，启动加速模式
        isAccelerating = true;
        accelerationFactor = 2; // 两倍速
      }
    }, 500); // 500ms后检测为长按
  }
  
  lastKeyDownTime = now;
}

// 处理方向键释放事件
function handleDirectionKeyUp(directionName) {
  // 重置对应方向键的状态
  if (directionName === 'right') isRightKeyDown = false;
  if (directionName === 'left') isLeftKeyDown = false;
  if (directionName === 'up') isUpKeyDown = false;
  if (directionName === 'down') isDownKeyDown = false;
  
  if (keyDownTimer) {
    clearTimeout(keyDownTimer);
    keyDownTimer = null;
  }
  
  // 如果所有方向键都已释放，取消加速
  if (!isRightKeyDown && !isLeftKeyDown && !isUpKeyDown && !isDownKeyDown) {
    if (isAccelerating) {
      isAccelerating = false;
      accelerationFactor = 1; // 恢复正常速度
    }
  }
}

// 暂停/继续游戏
function togglePause() {
  gamePaused = !gamePaused;
  var pauseButton = $('#toggle-pause');
  
  if (gamePaused) {
    pauseButton.textContent = 'Resume';
    pauseButton.classList.add('paused');
    // 立即更新URL以反映暂停状态
    immediateUpdateUrl(location.hash + '[paused]');
  } else {
    pauseButton.textContent = 'Pause';
    pauseButton.classList.remove('paused');
    // 立即更新URL以移除暂停标记
    var hash = '#|' + gridString() + '|[score:' + currentScore() + ']';
    immediateUpdateUrl(hash);
  }
  
  // 更新可视化网格显示
  drawWorld();
}

function drawMaxScore() {
  var maxScore = localStorage.maxScore;
  if (maxScore == null) {
    return;
  }

  var maxScorePoints = maxScore == 1 ? '1 point' : maxScore + ' points'
  var maxScoreGrid = localStorage.maxScoreGrid;

  $('#max-score-points').textContent = maxScorePoints;
  $('#max-score-grid').textContent = maxScoreGrid;
  $('#max-score-container').classList.remove('hidden');

  $('#share').onclick = function (e) {
    e.preventDefault();
    shareScore(maxScorePoints, maxScoreGrid);
  };
}

// Expands the high score details if collapsed. Only done when beating the
// highest score, to grab the player's attention.
function showMaxScore() {
  if ($('#max-score-container.expanded')) return
  $('#max-score-container .expand-btn').click();
}

function shareScore(scorePoints, grid) {
  var message = '|' + grid + '| Got ' + scorePoints +
    ' playing this stupid snake game on the browser URL!';
  var url = $('link[rel=canonical]').href;
  if (navigator.share) {
    navigator.share({text: message, url: url});
  } else {
    navigator.clipboard.writeText(message + '\n' + url)
      .then(function () { showShareNote('copied to clipboard') })
      .catch(function () { showShareNote('clipboard write failed') })
  }
}

function showShareNote(message) {
  var note = $("#share-note");
  note.textContent = message;
  note.classList.remove("invisible");
  setTimeout(function () { note.classList.add("invisible") }, 1000);
}

// Super hacky function to pick a suitable character to replace the empty
// Braille character (u+2800) when the browser escapes whitespace on the URL.
// We want to pick a character that's close in width to the empty Braille symbol
// —so the game doesn't stutter horizontally—, and also pick something that's
// not too visually noisy. So we actually measure how wide and how "dark" some
// candidate characters are when rendered by the browser (using a canvas) and
// pick the first that passes both criteria.
function pickWhitespaceReplacementChar() {
  var candidates = [
    // U+0ADF is part of the Gujarati Unicode blocks, but it doesn't have an
    // associated glyph. For some reason, Chrome renders is as totally blank and
    // almost the same size as the Braille empty character, but it doesn't
    // escape it on the address bar URL, so this is the perfect replacement
    // character. This behavior of Chrome is probably a bug, and might be
    // changed at any time, and in other browsers like Firefox this character is
    // rendered with an ugly "undefined" glyph, so it'll get filtered out by the
    // width or the "blankness" check in either of those cases.
    ['૟', 'strange symbols'],
    // U+27CB Mathematical Rising Diagonal, not a great replacement for
    // whitespace, but is close to the correct size and blank enough.
    ['⟋', 'some weird slashes']
  ];

  var N = 5;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = '30px system-ui';
  var targetWidth = ctx.measureText(BRAILLE_SPACE.repeat(N)).width;

  for (var i = 0; i < candidates.length; i++) {
    var char = candidates[i][0];
    var str = char.repeat(N);
    var width = ctx.measureText(str).width;
    var similarWidth = Math.abs(targetWidth - width) / targetWidth <= 0.1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(str, 0, 30);
    var pixelData = ctx.getImageData(0, 0, width, 30).data;
    var totalPixels = pixelData.length / 4;
    var coloredPixels = 0;
    for (var j = 0; j < totalPixels; j++) {
      var alpha = pixelData[j * 4 + 3];
      if (alpha != 0) {
        coloredPixels++;
      }
    }
    var notTooDark = coloredPixels / totalPixels < 0.15;

    if (similarWidth && notTooDark) {
      return candidates[i];
    }
  }

  // Fallback to a safe U+2591 Light Shade.
  return ['░', 'some kind of "fog"'];
}

var $ = document.querySelector.bind(document);

main();
