export function createInitialBoard() {
  return [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
  ];
}

export function getPieceColor(piece) {
  if (!piece) return null;
  return piece[0];
}

function isInsideBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function pieceCanMove(board, fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  if (!piece) return false;

  const color = getPieceColor(piece);
  const target = board[toRow][toCol];
  if (target && getPieceColor(target) === color) return false;

  const pieceType = piece[1];
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absRow = Math.abs(rowDiff);
  const absCol = Math.abs(colDiff);

  switch (pieceType) {
    case 'P': {
      const direction = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const oneStep = fromRow + direction;

      if (colDiff === 0 && toRow === oneStep && !target) return true;
      if (colDiff === 0 && fromRow === startRow && toRow === fromRow + 2 * direction && !board[fromRow + direction][fromCol] && !target) return true;
      if (Math.abs(colDiff) === 1 && toRow === fromRow + direction && target && getPieceColor(target) !== color) return true;
      return false;
    }
    case 'R':
      if (rowDiff === 0 || colDiff === 0) {
        const stepRow = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
        const stepCol = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;
        let r = fromRow + stepRow;
        let c = fromCol + stepCol;
        while (r !== toRow || c !== toCol) {
          if (board[r][c]) return false;
          r += stepRow;
          c += stepCol;
        }
        return true;
      }
      return false;
    case 'N':
      return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    case 'B':
      if (absRow !== absCol) return false;
      const rowStep = rowDiff > 0 ? 1 : -1;
      const colStep = colDiff > 0 ? 1 : -1;
      let r = fromRow + rowStep;
      let c = fromCol + colStep;
      while (r !== toRow || c !== toCol) {
        if (board[r][c]) return false;
        r += rowStep;
        c += colStep;
      }
      return true;
    case 'Q':
      if (rowDiff === 0 || colDiff === 0 || absRow === absCol) {
        const stepRow = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
        const stepCol = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;
        let r = fromRow + stepRow;
        let c = fromCol + stepCol;
        while (r !== toRow || c !== toCol) {
          if (board[r][c]) return false;
          r += stepRow;
          c += stepCol;
        }
        return true;
      }
      return false;
    case 'K':
      return Math.max(absRow, absCol) === 1;
    default:
      return false;
  }
}

export function getValidMovesForSquare(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === row && c === col) continue;
      if (isInsideBoard(r, c) && pieceCanMove(board, row, col, r, c)) {
        moves.push({
          fromRow: row,
          fromCol: col,
          toRow: r,
          toCol: c,
          piece,
          captured: board[r][c],
        });
      }
    }
  }

  const direction = getPieceColor(piece) === 'w' ? -1 : 1;
  moves.sort((a, b) => {
    if (direction === -1) {
      return b.toRow - a.toRow || a.toCol - b.toCol;
    }
    return a.toRow - b.toRow || a.toCol - b.toCol;
  });

  return moves;
}

export function isLegalMove(board, move, currentTurn) {
  if (!move || (!move.fromRow && move.fromRow !== 0) || (!move.fromCol && move.fromCol !== 0)) return false;
  if (!move.toRow && move.toRow !== 0 || !move.toCol && move.toCol !== 0) return false;

  const piece = board[move.fromRow][move.fromCol];
  if (!piece) return false;
  if (getPieceColor(piece) !== currentTurn) return false;

  const target = board[move.toRow][move.toCol];
  if (target && getPieceColor(target) === currentTurn) return false;
  if (target && target[1] === 'K') return false;

  const validMoves = getValidMovesForSquare(board, move.fromRow, move.fromCol);
  const isValidTarget = validMoves.some((m) => m.toRow === move.toRow && m.toCol === move.toCol);
  if (!isValidTarget) return false;

  const simulatedBoard = makeMove(board, move);
  return !isKingInCheck(simulatedBoard, currentTurn);
}

export function makeMove(board, move) {
  const newBoard = cloneBoard(board);
  newBoard[move.toRow][move.toCol] = newBoard[move.fromRow][move.fromCol];
  newBoard[move.fromRow][move.fromCol] = null;
  return newBoard;
}

export function isKingInCheck(board, color) {
  let kingRow = -1;
  let kingCol = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece === `${color}K`) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (getPieceColor(piece) === color) continue;

      if (pieceCanMove(board, r, c, kingRow, kingCol)) {
        return true;
      }
    }
  }

  return false;
}

export function hasKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === `${color}K`) {
        return true;
      }
    }
  }
  return false;
}

export function getLegalMovesForColor(board, color) {
  if (!hasKing(board, color)) return [];

  const moves = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || getPieceColor(piece) !== color) continue;

      for (const move of getValidMovesForSquare(board, row, col)) {
        const simulatedBoard = makeMove(board, move);
        const kingStillSafe = !isKingInCheck(simulatedBoard, color);

        if (kingStillSafe) {
          moves.push(move);
        }
      }
    }
  }

  return moves;
}

export function isCheckmate(board, color) {
  if (!hasKing(board, color)) return false;
  if (!isKingInCheck(board, color)) return false;
  return getLegalMovesForColor(board, color).length === 0;
}
