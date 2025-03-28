import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cors from 'cors';
import { words, timerDuration } from "./config.js"; // Import named exports

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
    origin: [
      "https://sachinksalim.github.io",
      "https://sachinksalim.github.io/word-rush-game"
    ],
    credentials: true
  }));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "https://sachinksalim.github.io",
            "https://sachinksalim.github.io/word-rush-game", // GitHub Pages URL
            "http://localhost:3000", // Local development
        ],
        methods: ["GET", "POST"],
    },
});

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

const games = {}; // Store active games
const players = {}; // Store player usernames and socket IDs

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Handle username selection
    socket.on("setUsername", (username) => {
        if (!username || typeof username !== "string") {
            socket.emit("usernameError", "Invalid username.");
            return;
        }

        // Check if the username is already taken
        if (Object.values(players).includes(username)) {
            socket.emit("usernameError", "Username is already taken.");
            return;
        }

        // Store the username
        players[socket.id] = username;
        socket.emit("usernameSet", username);
        console.log(`Player ${socket.id} set username to ${username}`);
    });

    // Handle game creation
    socket.on("createGame", () => {
        if (!players[socket.id]) {
            socket.emit("gameError", "Please set a username first.");
            return;
        }

        const gameId = Math.random().toString(36).substring(2, 8); // Generate a unique game ID
        games[gameId] = {
            players: [players[socket.id]], // Store usernames instead of socket IDs
            scores: { [players[socket.id]]: 0 }, // Use usernames as keys
            currentWord: "",
            currentWordIndex: 0, // Track the current word index
            timer: timerDuration, // Use timer duration from config
            isGameActive: false,
            timerInterval: null, // Store the timer interval for cleanup
        };
        socket.join(gameId);
        socket.emit("gameCreated", gameId);
    });

    // Handle game joining
    socket.on("joinGame", (gameId) => {
        if (!players[socket.id]) {
            socket.emit("gameError", "Please set a username first.");
            return;
        }

        if (!games[gameId]) {
            socket.emit("joinError", "Invalid game ID.");
            return;
        }
        if (games[gameId].players.length >= 2) {
            socket.emit("joinError", "Game is full.");
            return;
        }

        const username = players[socket.id];
        games[gameId].players.push(username);
        games[gameId].scores[username] = 0;
        games[gameId].readyPlayers = []; // Initialize readyPlayers array
        socket.join(gameId);
        io.to(gameId).emit("gameJoined", games[gameId]);
    });

    // Handle player ready event
    socket.on("playerReady", (gameId) => {
        const game = games[gameId];
        const username = players[socket.id];

        if (!game || !username || game.readyPlayers.includes(username)) return;

        game.readyPlayers.push(username); // Mark player as ready
        console.log(`Player ${username} is ready for game ${gameId}`); // Log player readiness

        // Start the game if both players are ready
        if (game.readyPlayers.length === 2) {
            console.log("Both players are ready. Starting game for:", gameId); // Log game start
            startGame(gameId);
        }
    });

    // Handle player input
    socket.on("playerInput", (gameId, input) => {
        const game = games[gameId];
        const username = players[socket.id];

        if (!game || !game.isGameActive || !username) {
            console.log("Game is not active or does not exist.");
            return;
        }

        console.log(`Player input received from ${username}: ${input}`); // Log player input

        if (input === game.currentWord) {
            game.scores[username] += 2; // +2 points for correct typing
        } else {
            game.scores[username] = Math.max(game.scores[username] - 1, 0); // -1 point for incorrect typing
        }
        console.log(`Updated scores:`, game.scores); // Log updated scores
        io.to(gameId).emit("updateScores", {
            scores: game.scores,
            triggeredBy: username,
        });

        // Move to the next word sequentially
        game.currentWordIndex = (game.currentWordIndex + 1) % words.length; // Circle back to 0 if at the end
        game.currentWord = words[game.currentWordIndex]; // Pick the next word

        // Emit 'gameUpdated' with the new word and scores
        io.to(gameId).emit("gameUpdated", {
            word: game.currentWord,
            scores: game.scores,
        });
    });

    // Handle player disconnect
    socket.on("disconnect", () => {
        const username = players[socket.id];
        console.log(`Player ${username} (${socket.id}) disconnected.`);

        // Clean up games if a player disconnects
        for (const gameId in games) {
            const game = games[gameId];
            if (game.players.includes(username)) {
                game.players = game.players.filter((player) => player !== username);
                if (game.players.length === 0) {
                    clearInterval(game.timerInterval); // Clear the timer interval
                    delete games[gameId];
                } else {
                    // Notify the remaining player that the game is over
                    io.to(gameId).emit("gameOver", game.scores);
                    clearInterval(game.timerInterval); // Clear the timer interval
                    game.isGameActive = false;
                }
            }
        }

        // Remove the player from the players object
        delete players[socket.id];
    });
});

// Function to start the game
function startGame(gameId) {
    const game = games[gameId];
    if (!game) return;

    game.isGameActive = true;
    game.currentWordIndex = 0; // Start from the first word
    game.currentWord = words[game.currentWordIndex]; // Use the first word from config
    game.timer = timerDuration; // Use timer duration from config
    io.to(gameId).emit("gameStarted", game.currentWord);

    // Start the timer
    game.timerInterval = setInterval(() => {
        game.timer--;
        io.to(gameId).emit("updateTimer", game.timer);
        if (game.timer <= 0) {
            clearInterval(game.timerInterval);
            game.isGameActive = false;
            io.to(gameId).emit("gameOver", game.scores);
        }
    }, 1000);
}

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the server and games object for testing
export { server, games };