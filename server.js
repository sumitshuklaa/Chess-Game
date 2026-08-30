import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createInitialBoard, makeMove, isLegalMove, isKingInCheck, isCheckmate, hasKing } from './chess.mjs';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: {},
      board: createInitialBoard(),
      currentTurn: 'w',
      gameOver: false,
      status: 'Game is ongoing.',
      timerStarted: false,
      whiteTime: 300,
      blackTime: 300,
      whiteCaptured: [],
      blackCaptured: [],
      createdAt: Date.now(),
    });
  }

  return rooms.get(roomId);
}

function serializeRoom(room) {
  return {
    roomId: room.id,
    players: room.players,
    board: room.board,
    currentTurn: room.currentTurn,
    gameOver: room.gameOver,
    status: room.status,
    timerStarted: room.timerStarted,
    whiteTime: room.whiteTime,
    blackTime: room.blackTime,
    whiteCaptured: room.whiteCaptured,
    blackCaptured: room.blackCaptured,
  };
}

function emitRoomState(room) {
  const roomState = serializeRoom(room);

  for (const socketId of Object.keys(room.players)) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('room-state', {
        ...roomState,
        side: room.players[socketId],
      });
    }
  }
}

function updateStatus(room) {
  if (!hasKing(room.board, 'w')) {
    room.gameOver = true;
    room.status = 'White king has been eliminated. Black wins!';
    return;
  }

  if (!hasKing(room.board, 'b')) {
    room.gameOver = true;
    room.status = 'Black king has been eliminated. White wins!';
    return;
  }

  if (isCheckmate(room.board, 'w')) {
    room.gameOver = true;
    room.status = 'Checkmate! Black wins.';
    return;
  }

  if (isCheckmate(room.board, 'b')) {
    room.gameOver = true;
    room.status = 'Checkmate! White wins.';
    return;
  }

  room.gameOver = false;

  if (isKingInCheck(room.board, 'w')) {
    room.status = 'White is in check!';
  } else if (isKingInCheck(room.board, 'b')) {
    room.status = 'Black is in check!';
  } else {
    room.status = 'Game is ongoing.';
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.timerStarted || Object.keys(room.players).length < 2 || room.gameOver) {
      continue;
    }

    if (room.currentTurn === 'w') {
      room.whiteTime = Math.max(0, room.whiteTime - 1);
      if (room.whiteTime <= 0) {
        room.gameOver = true;
        room.status = 'Time up! Black wins.';
      }
    } else {
      room.blackTime = Math.max(0, room.blackTime - 1);
      if (room.blackTime <= 0) {
        room.gameOver = true;
        room.status = 'Time up! White wins.';
      }
    }

    emitRoomState(room);
  }
}, 1000);

io.on('connection', (socket) => {
  socket.on('create-room', (callback) => {
    let roomId = randomRoomCode();
    while (rooms.has(roomId)) {
      roomId = randomRoomCode();
    }

    const room = getRoom(roomId);
    room.players[socket.id] = 'w';
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.side = 'w';

    if (typeof callback === 'function') {
      callback({ roomId, side: 'w' });
    }

    emitRoomState(room);
  });

  socket.on('join-room', ({ roomId }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found' });
      return;
    }

    if (room.players[socket.id]) {
      if (typeof callback === 'function') callback({ roomId, side: room.players[socket.id] });
      return;
    }

    if (Object.keys(room.players).length >= 2) {
      if (typeof callback === 'function') callback({ error: 'Room is full' });
      return;
    }

    const nextSide = Object.values(room.players).includes('w') ? 'b' : 'w';
    room.players[socket.id] = nextSide;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.side = nextSide;

    if (typeof callback === 'function') {
      callback({ roomId, side: nextSide });
    }

    emitRoomState(room);
  });

  socket.on('move', ({ roomId, fromRow, fromCol, toRow, toCol }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const side = room.players[socket.id];
    if (!side) return;
    if (room.gameOver) return;
    if (room.currentTurn !== side) return;

    const piece = room.board[fromRow]?.[fromCol];
    if (!piece || piece[0] !== side) return;

    const move = {
      fromRow,
      fromCol,
      toRow,
      toCol,
      piece,
      captured: room.board[toRow]?.[toCol],
    };

    if (!isLegalMove(room.board, move, side)) return;

    const nextBoard = makeMove(room.board, move);
    room.board = nextBoard;

    if (!room.timerStarted) {
      room.timerStarted = true;
    }

    if (move.captured) {
      if (side === 'w') {
        room.blackCaptured.push(move.captured);
      } else {
        room.whiteCaptured.push(move.captured);
      }
    }

    room.currentTurn = side === 'w' ? 'b' : 'w';
    updateStatus(room);
    emitRoomState(room);
  });

  socket.on('restart-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.board = createInitialBoard();
    room.currentTurn = 'w';
    room.gameOver = false;
    room.status = 'Game is ongoing.';
    room.timerStarted = false;
    room.whiteTime = 300;
    room.blackTime = 300;
    room.whiteCaptured = [];
    room.blackCaptured = [];
    emitRoomState(room);
  });

  socket.on('leave-room', ({ roomId } = {}) => {
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    delete room.players[socket.id];
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.side = null;

    if (Object.keys(room.players).length === 0) {
      rooms.delete(roomId);
      return;
    }

    room.status = 'Waiting for another player...';
    emitRoomState(room);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || !room.players[socket.id]) return;

    delete room.players[socket.id];
    socket.leave(roomId);

    if (Object.keys(room.players).length === 0) {
      rooms.delete(roomId);
      return;
    }

    room.status = 'Waiting for another player...';
    emitRoomState(room);
  });
});

app.use(express.static('./'));

server.listen(PORT, () => {
  console.log(`Chess server running at http://localhost:${PORT}`);
});

