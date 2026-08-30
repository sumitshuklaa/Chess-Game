import assert from 'node:assert/strict';
import {
  createInitialBoard,
  getValidMovesForSquare,
  isLegalMove,
  makeMove,
  isKingInCheck,
  getPieceColor,
  getLegalMovesForColor,
  isCheckmate,
} from './chess.mjs';

const board = createInitialBoard();

assert.equal(board[0][0], 'bR');
assert.equal(board[6][0], 'wP');
assert.deepEqual(getValidMovesForSquare(board, 6, 0), [
  { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0, piece: 'wP', captured: null },
  { fromRow: 6, fromCol: 0, toRow: 4, toCol: 0, piece: 'wP', captured: null },
]);

assert.equal(getPieceColor('wK'), 'w');
assert.equal(getPieceColor(null), null);

assert.equal(isKingInCheck(board, 'b'), false);

const testBoard = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, 'wK', null, null, null, null, null],
];

assert.equal(isKingInCheck(testBoard, 'w'), false);

const moveBoard = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, 'bK', null, null, null],
];

assert.equal(isKingInCheck(moveBoard, 'b'), false);

const legalBoard = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, 'wP', null, null],
  [null, null, null, null, null, null, 'bK', null],
];

assert.equal(isLegalMove(legalBoard, { fromRow: 6, fromCol: 5, toRow: 5, toCol: 5, piece: 'wP', captured: null }, 'w'), true);

const moved = makeMove(board, { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0, piece: 'wP', captured: null });
assert.equal(moved[5][0], 'wP');
assert.equal(moved[6][0], null);

const checkBoard = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, 'bQ', null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, 'wK', null, null, null],
];

assert.equal(isKingInCheck(checkBoard, 'w'), true);

const mateBoard = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, 'bR'],
  [null, null, null, null, null, null, 'bQ', 'wK'],
];

assert.equal(isKingInCheck(mateBoard, 'w'), true);
assert.equal(getLegalMovesForColor(mateBoard, 'w').length > 0, false);
assert.equal(isCheckmate(mateBoard, 'w'), true);

console.log('All chess tests passed.');
