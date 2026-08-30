import { createInitialBoard, getValidMovesForSquare, isLegalMove, makeMove, isKingInCheck, isCheckmate, hasKing, getLegalMovesForColor } from './chess.mjs';

const boardElement = document.getElementById('board');
const gameModeSelect = document.getElementById('game-mode');
const restartBtn = document.getElementById('restart-btn');
const soundBtn = document.getElementById('sound-btn');
const whiteTimerEl = document.getElementById('white-timer');
const blackTimerEl = document.getElementById('black-timer');
const onlineControls = document.getElementById('online-controls');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const socket = window.io ? window.io() : (typeof io === 'function' ? io() : null);

const board = createInitialBoard();
let selectedRow = null;
let selectedCol = null;
let currentTurn = 'w';
let legalMoves = [];
let whiteCaptured = [];
let blackCaptured = [];
let gameMode = 'pvc';
let computerColor = 'b';
let isComputerThinking = false;
let onlineRoomId = null;
let onlineSide = null;
let pendingOnlineAction = null;
let gameMessage = '';
let gameOver = false;
let soundEnabled = true;
let whiteTime = 300;
let blackTime = 300;
let timerInterval = null;
let timerStarted = false;
let serverTimerStarted = false;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimers() {
  if (whiteTimerEl) whiteTimerEl.textContent = formatTime(whiteTime);
  if (blackTimerEl) blackTimerEl.textContent = formatTime(blackTime);
}

function stopLocalTimer() {
  timerStarted = false;
  clearInterval(timerInterval);
  timerInterval = null;
}

function startTimer() {
  if (timerStarted) return;

  timerStarted = true;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (gameOver) return;

    if (currentTurn === 'w') {
      whiteTime = Math.max(0, whiteTime - 1);
      if (whiteTime <= 0) {
        gameOver = true;
        gameMessage = 'Time up! Black wins.';
        updateStatus();
        clearInterval(timerInterval);
      }
    } else {
      blackTime = Math.max(0, blackTime - 1);
      if (blackTime <= 0) {
        gameOver = true;
        gameMessage = 'Time up! White wins.';
        updateStatus();
        clearInterval(timerInterval);
      }
    }

    updateTimers();
  }, 1000);
}

function playMoveSound() {
  if (!soundEnabled) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const audioContext = new AudioCtx();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 420;
  gainNode.gain.value = 0.04;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.08);
}

function renderCapturedPieces() {
  const whiteCapturedEl = document.getElementById('white-captured');
  const blackCapturedEl = document.getElementById('black-captured');

  if (whiteCapturedEl) {
    whiteCapturedEl.textContent = whiteCaptured.map(getPieceSymbol).join(' ');
  }

  if (blackCapturedEl) {
    blackCapturedEl.textContent = blackCaptured.map(getPieceSymbol).join(' ');
  }
}

function getPieceSymbol(piece) {
  const symbols = {
    wP: '♙',
    wR: '♖',
    wN: '♘',
    wB: '♗',
    wQ: '♕',
    wK: '♔',
    bP: '♟',
    bR: '♜',
    bN: '♞',
    bB: '♝',
    bQ: '♛',
    bK: '♚',
  };

  return symbols[piece] || '';
}

function getPieceValue(piece) {
  if (!piece) return 0;
  const values = {
    P: 10,
    N: 30,
    B: 30,
    R: 50,
    Q: 90,
    K: 900,
  };
  return values[piece[1]] || 0;
}

function getMoveScore(move) {
  let score = 0;

  if (move.captured) {
    score += getPieceValue(move.captured) * 2;
  }

  const centerRow = 3.5;
  const centerCol = 3.5;
  const distanceFromCenter = Math.abs(move.toRow - centerRow) + Math.abs(move.toCol - centerCol);
  score += Math.max(0, 8 - distanceFromCenter);

  if (move.piece[1] === 'P' && ((move.piece[0] === 'w' && move.toRow === 0) || (move.piece[0] === 'b' && move.toRow === 7))) {
    score += 50;
  }

  return score;
}

function getLegalMoveForSquare(row, col) {
  return legalMoves.find((move) => move.toRow === row && move.toCol === col) || null;
}

function boardsAreEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  for (let row = 0; row < a.length; row += 1) {
    if (a[row].length !== b[row].length) return false;
    for (let col = 0; col < a[row].length; col += 1) {
      if (a[row][col] !== b[row][col]) return false;
    }
  }

  return true;
}

function applyMove(move) {
  if (gameOver) return;

  const capturedPiece = board[move.toRow][move.toCol];
  const nextBoard = makeMove(board, move);

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      board[i][j] = nextBoard[i][j];
    }
  }

  if (capturedPiece) {
    if (move.piece[0] === 'w') {
      blackCaptured.push(capturedPiece);
    } else {
      whiteCaptured.push(capturedPiece);
    }
  }

  currentTurn = currentTurn === 'w' ? 'b' : 'w';
  selectedRow = null;
  selectedCol = null;
  legalMoves = [];
  playMoveSound();
  updateTurnBadge();
  updateGameMessage();
  renderCapturedPieces();
  createBoard();
  updateTimers();

  if (!timerStarted) {
    startTimer();
  }

  if (gameOver) return;

  if (gameMode === 'pvc' && currentTurn === computerColor) {
    setTimeout(makeComputerMove, 500);
  }
}

function chooseComputerMove() {
  const computerMoves = getLegalMovesForColor(board, computerColor).map((move) => ({
    ...move,
    score: getMoveScore(move),
  }));

  if (computerMoves.length === 0) {
    return null;
  }

  computerMoves.sort((a, b) => b.score - a.score);
  const bestScore = computerMoves[0].score;
  const bestMoves = computerMoves.filter((move) => move.score === bestScore);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function makeComputerMove() {
  if (gameOver || gameMode !== 'pvc' || currentTurn !== computerColor || isComputerThinking) {
    return;
  }

  if (isCheckmate(board, currentTurn)) {
    updateGameMessage();
    return;
  }

  isComputerThinking = true;

  setTimeout(() => {
    const move = chooseComputerMove();
    if (!move) {
      isComputerThinking = false;
      updateGameMessage();
      return;
    }

    applyMove(move);
    isComputerThinking = false;
  }, 350);
}

function createBoard() {
  boardElement.innerHTML = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.classList.add('square');
      square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');

      if (selectedRow === row && selectedCol === col) {
        square.classList.add('selected');
      }

      const piece = board[row][col];
      if (piece === 'wK' && isKingInCheck(board, 'w')) {
        square.classList.add('king-in-check');
      }

      if (piece === 'bK' && isKingInCheck(board, 'b')) {
        square.classList.add('king-in-check');
      }

      const moveTarget = getLegalMoveForSquare(row, col);
      if (moveTarget) {
        square.classList.add(board[row][col] ? 'capture-target' : 'legal-move');
      }

      if (piece) {
        square.textContent = getPieceSymbol(piece);
        square.classList.add(piece[0] === 'w' ? 'white-piece' : 'black-piece');
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }
}

function handleSquareClick(row, col) {
  if (gameOver) return;

  if (gameMode === 'pvc' && currentTurn === computerColor) {
    return;
  }

  if (gameMode === 'online') {
    if (!socket || !onlineRoomId || !onlineSide) {
      return;
    }

    const clickedPiece = board[row][col];

    if (selectedRow === null || selectedCol === null) {
      if (!clickedPiece || clickedPiece[0] !== onlineSide) {
        return;
      }

      selectedRow = row;
      selectedCol = col;
      legalMoves = getValidMovesForSquare(board, row, col);
      createBoard();
      return;
    }

    const move = {
      fromRow: selectedRow,
      fromCol: selectedCol,
      toRow: row,
      toCol: col,
      piece: board[selectedRow][selectedCol],
      captured: board[row][col],
    };

    if (isLegalMove(board, move, onlineSide)) {
      const fromRowIndex = selectedRow;
      const fromColIndex = selectedCol;
      selectedRow = null;
      selectedCol = null;
      legalMoves = [];
      createBoard();
      socket.emit('move', {
        roomId: onlineRoomId,
        fromRow: fromRowIndex,
        fromCol: fromColIndex,
        toRow: row,
        toCol: col,
      });
      return;
    }

    if (clickedPiece && clickedPiece[0] === onlineSide) {
      selectedRow = row;
      selectedCol = col;
      legalMoves = getValidMovesForSquare(board, row, col);
      createBoard();
      return;
    }

    selectedRow = null;
    selectedCol = null;
    legalMoves = [];
    createBoard();
    return;
  }

  const clickedPiece = board[row][col];

  if (selectedRow === null || selectedCol === null) {
    if (!clickedPiece || clickedPiece[0] !== currentTurn) {
      return;
    }

    selectedRow = row;
    selectedCol = col;
    legalMoves = getValidMovesForSquare(board, row, col);
    createBoard();
    return;
  }

  const move = {
    fromRow: selectedRow,
    fromCol: selectedCol,
    toRow: row,
    toCol: col,
    piece: board[selectedRow][selectedCol],
    captured: board[row][col],
  };

  if (isLegalMove(board, move, currentTurn)) {
    applyMove(move);
    return;
  }

  if (clickedPiece && clickedPiece[0] === currentTurn) {
    selectedRow = row;
    selectedCol = col;
    legalMoves = getValidMovesForSquare(board, row, col);
    createBoard();
    return;
  }

  selectedRow = null;
  selectedCol = null;
  legalMoves = [];
  createBoard();
}

const boardStatus = document.getElementById('board-status');
const sideWarning = document.getElementById('side-warning');
const currentTurnBadge = document.getElementById('current-turn-badge');

function updateTurnBadge() {
  if (!currentTurnBadge) return;

  currentTurnBadge.textContent = currentTurn === 'w' ? 'White to move' : 'Black to move';
  currentTurnBadge.classList.toggle('black-turn', currentTurn === 'b');
  currentTurnBadge.classList.toggle('white-turn', currentTurn === 'w');
}

function updateStatus() {
  updateTurnBadge();

  if (boardStatus) {
    boardStatus.textContent = gameMessage;
    boardStatus.classList.remove('warning', 'danger');

    if (gameMessage.includes('Checkmate') || gameMessage.includes('wins')) {
      boardStatus.classList.add('danger');
    } else if (gameMessage.includes('check')) {
      boardStatus.classList.add('warning');
    }
  }

  if (sideWarning) {
    sideWarning.classList.remove('warning', 'danger');

    if (gameMessage.includes('Checkmate') || gameMessage.includes('wins')) {
      sideWarning.textContent = 'CHECKMATE';
      sideWarning.classList.add('danger');
    } else if (gameMessage.includes('check')) {
      sideWarning.textContent = gameMode === 'pvc' && currentTurn === 'w' ? 'Computer checked you!' : 'King is in check';
      sideWarning.classList.add('warning');
    } else {
      sideWarning.textContent = 'Safe position';
    }
  }
}

function updateGameMessage() {
  if (!hasKing(board, 'w')) {
    gameMessage = 'White king has been eliminated. Black wins!';
    gameOver = true;
    updateStatus();
    return;
  }

  if (!hasKing(board, 'b')) {
    gameMessage = 'Black king has been eliminated. White wins!';
    gameOver = true;
    updateStatus();
    return;
  }

  if (isCheckmate(board, 'w')) {
    gameMessage = 'Checkmate! Black wins.';
    gameOver = true;
    updateStatus();
    return;
  }

  if (isCheckmate(board, 'b')) {
    gameMessage = 'Checkmate! White wins.';
    gameOver = true;
    updateStatus();
    return;
  }

  gameOver = false;

  if (isKingInCheck(board, 'w')) {
    gameMessage = 'White is in check!';
  } else if (isKingInCheck(board, 'b')) {
    gameMessage = 'Black is in check!';
  } else {
    gameMessage = 'Game is ongoing.';
  }

  updateStatus();
}

function resetGame() {
  selectedRow = null;
  selectedCol = null;
  legalMoves = [];
  currentTurn = 'w';
  whiteCaptured = [];
  blackCaptured = [];
  isComputerThinking = false;
  gameMessage = 'Game is ongoing.';
  gameOver = false;
  whiteTime = 300;
  blackTime = 300;
  timerStarted = false;
  updateTimers();
  clearInterval(timerInterval);
  board.splice(0, board.length, ...createInitialBoard());
  renderCapturedPieces();
  updateTurnBadge();
  updateStatus();
  createBoard();

  if (gameMode === 'pvc' && currentTurn === computerColor) {
    makeComputerMove();
  }
}

function updateOnlineControls() {
  if (!onlineControls) return;

  const isOnlineMode = gameMode === 'online';
  onlineControls.classList.toggle('hidden', !isOnlineMode);

  if (!isOnlineMode) {
    onlineRoomId = null;
    onlineSide = null;
  }
}

function applyOnlineRoomState(roomState) {
  if (!roomState) return;

  const nextBoard = roomState.board.map((row) => [...row]);
  const boardChanged = !boardsAreEqual(board, nextBoard);

  onlineRoomId = roomState.roomId;
  onlineSide = roomState.side || onlineSide;
  currentTurn = roomState.currentTurn;
  gameMessage = roomState.status || 'Game is ongoing.';
  gameOver = Boolean(roomState.gameOver);
  whiteTime = typeof roomState.whiteTime === 'number' ? roomState.whiteTime : whiteTime;
  blackTime = typeof roomState.blackTime === 'number' ? roomState.blackTime : blackTime;
  serverTimerStarted = Boolean(roomState.timerStarted);

  if (gameMode === 'online') {
    stopLocalTimer();
  }

  board.splice(0, board.length, ...nextBoard);
  whiteCaptured = Array.isArray(roomState.whiteCaptured) ? roomState.whiteCaptured : [];
  blackCaptured = Array.isArray(roomState.blackCaptured) ? roomState.blackCaptured : [];

  if (boardChanged) {
    selectedRow = null;
    selectedCol = null;
    legalMoves = [];
  }

  renderCapturedPieces();
  updateStatus();
  updateTimers();
  createBoard();
}

if (gameModeSelect) {
  gameModeSelect.addEventListener('change', (event) => {
    gameMode = event.target.value;
    if (gameMode === 'online') {
      stopLocalTimer();
      computerColor = null;
      if (socket && socket.connected) {
        if (onlineRoomId) {
          socket.emit('leave-room', { roomId: onlineRoomId });
        }
      }
    } else if (gameMode === 'pvp') {
      stopLocalTimer();
      computerColor = null;
    } else {
      stopLocalTimer();
      computerColor = 'b';
    }

    updateOnlineControls();
    resetGame();
  });
}

if (createRoomBtn) {
  createRoomBtn.addEventListener('click', () => {
    if (!socket) {
      boardStatus.textContent = 'Online mode needs a server.';
      return;
    }

    if (!socket.connected) {
      pendingOnlineAction = 'create';
      boardStatus.textContent = 'Connecting to server...';
      socket.connect();
      return;
    }

    stopLocalTimer();
    gameMode = 'online';
    gameModeSelect.value = 'online';
    updateOnlineControls();

    socket.emit('create-room', (response) => {
      if (response && response.error) {
        boardStatus.textContent = response.error;
        return;
      }

      if (response) {
        pendingOnlineAction = null;
        onlineRoomId = response.roomId;
        onlineSide = response.side;
        if (roomCodeInput) {
          roomCodeInput.value = response.roomId;
        }
        boardStatus.textContent = `Room ${response.roomId} created. Waiting for second player...`;
      }
    });
  });
}

if (joinRoomBtn) {
  joinRoomBtn.addEventListener('click', () => {
    if (!socket) {
      boardStatus.textContent = 'Online mode needs a server.';
      return;
    }

    const roomId = String(roomCodeInput.value || '').trim().toUpperCase();
    if (!roomId) {
      boardStatus.textContent = 'Enter a room code first.';
      return;
    }

    stopLocalTimer();
    gameMode = 'online';
    gameModeSelect.value = 'online';
    updateOnlineControls();

    socket.emit('join-room', { roomId }, (response) => {
      if (response && response.error) {
        boardStatus.textContent = response.error;
        return;
      }

      if (response) {
        onlineRoomId = response.roomId;
        onlineSide = response.side;
        if (roomCodeInput) {
          roomCodeInput.value = response.roomId;
        }
        boardStatus.textContent = `Joined room ${response.roomId}.`;
      }
    });
  });
}

if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    if (gameMode === 'online' && onlineRoomId && socket) {
      socket.emit('restart-room', { roomId: onlineRoomId });
      return;
    }

    resetGame();
  });
}

if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
  });
}

if (socket) {
  socket.on('connect', () => {
    if (pendingOnlineAction === 'create') {
      createRoomBtn.click();
    } else if (gameMode === 'online') {
      boardStatus.textContent = 'Connected. Create or join a room.';
    }
  });

  socket.on('room-state', (roomState) => {
    if (gameMode !== 'online' && roomState) {
      return;
    }
    applyOnlineRoomState(roomState);
  });
}

updateOnlineControls();
createBoard();
updateTimers();
updateStatus();
renderCapturedPieces();
updateGameMessage();

if (gameMode === 'pvc' && currentTurn === computerColor) {
  makeComputerMove();
}
