import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { words, timerDuration } from "./config.js"; // Import named exports

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

const games = {}; // Store active games

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    // Handle game creation
    socket.on("createGame", () => {
        const gameId = Math.random().toString(36).substring(2, 8); // Generate a unique game ID
        games[gameId] = {
            players: [socket.id],
            scores: { [socket.id]: 0 },
            currentWord: "",
            currentWordIndex: 0, // Track the current word index
            timer: timerDuration, // Use timer duration from config
            isGameActive: false,
        };
        socket.join(gameId);
        socket.emit("gameCreated", gameId);
    });

    // Handle game joining
    socket.on("joinGame", (gameId) => {
        if (games[gameId] && games[gameId].players.length < 2) {
            games[gameId].players.push(socket.id);
            games[gameId].scores[socket.id] = 0;
            socket.join(gameId);
            io.to(gameId).emit("gameJoined", games[gameId]);

            // Start the game automatically when two players join
            if (games[gameId].players.length === 2) {
                startGame(gameId);
            }
        } else {
            socket.emit("joinError", "Invalid game ID or game is full.");
        }
    });

    // Handle player input
    socket.on("playerInput", (gameId, input) => {
        const game = games[gameId];
        if (game && game.isGameActive) {
            if (input === game.currentWord) {
                game.scores[socket.id] += 2; // +2 points for correct typing
            } else {
                game.scores[socket.id] = Math.max(game.scores[socket.id] - 1, 0); // -1 point for incorrect typing
            }
            io.to(gameId).emit("updateScores", game.scores);

            // Move to the next word sequentially
            game.currentWordIndex = (game.currentWordIndex + 1) % words.length; // Circle back to 0 if at the end
            game.currentWord = words[game.currentWordIndex]; // Pick the next word
            io.to(gameId).emit("gameStarted", game.currentWord);
        }
    });

    // Handle player disconnect
    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);
        // Clean up games if a player disconnects
        for (const gameId in games) {
            const game = games[gameId];
            if (game.players.includes(socket.id)) {
                game.players = game.players.filter((player) => player !== socket.id);
                if (game.players.length === 0) {
                    delete games[gameId];
                }
            }
        }
    });
});

// Function to start the game
function startGame(gameId) {
    const game = games[gameId];
    if (game) {
        game.isGameActive = true;
        game.currentWordIndex = 0; // Start from the first word
        game.currentWord = words[game.currentWordIndex]; // Use the first word from config
        game.timer = timerDuration; // Use timer duration from config
        io.to(gameId).emit("gameStarted", game.currentWord);

        // Start the timer
        const timerInterval = setInterval(() => {
            game.timer--;
            io.to(gameId).emit("updateTimer", game.timer);
            if (game.timer <= 0) {
                clearInterval(timerInterval);
                game.isGameActive = false;
                io.to(gameId).emit("gameOver", game.scores);
            }
        }, 1000);
    }
}

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the server and games object for testing
export { server, games };