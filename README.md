# Chess Game

A browser-based chess game with:

**[Play Online](https://chess-game-movc.onrender.com/)**

- Human vs Human mode
- Human vs Computer mode
- Online multiplayer room mode
- Legal move validation and check/checkmate detection
- Captured piece tracking
- Timers for both sides
- Responsive board and modern UI

## Features

- Full chess movement rules and move validation
- Highlighting for legal moves and captures
- Check and checkmate detection
- Captured pieces panel
- Restart and sound controls
- Online room creation and joining using Socket.IO
- Side-specific timers for White and Black
- Modern responsive layout with glassmorphism-inspired styling

## Project Structure

- `index.html` – app structure and UI
- `style.css` – styling and layout
- `script.js` – game logic and online multiplayer client behavior
- `server.js` – multiplayer room server and turn/timer logic
- `chess.mjs` – chess rules engine
- `chess.test.mjs` – chess logic validation tests

## How to Run

1. Open a terminal in the project folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open the app in a browser:

   ```text
   http://localhost:3000
   ```

## Game Modes

### Human vs Computer

- Play against the computer.
- The computer attempts legal moves with a basic scoring strategy.

### Human vs Human

- Local two-player chess.
- Same browser, alternate turns.

### Online Multiplayer

- Click Create Room to generate a room code.
- Share the code with another player.
- The second player joins from another browser tab or device on the same network.
- The server assigns White/Black automatically.
- Timers count down for each side based on the turn.

## Notes

- The app must be served through a local web server, not opened directly as a file.
- Online multiplayer depends on Socket.IO and the server running on port 3000.

## Scripts

```bash
npm start
```

Runs the chess server.


