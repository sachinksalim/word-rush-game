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
            timerInterval: null, // Store the timer interval for cleanup
        };
        socket.join(gameId);
        socket.emit("gameCreated", gameId);
    });

    // Handle game joining
    socket.on("joinGame", (gameId) => {
        if (!games[gameId]) {
            socket.emit("joinError", "Invalid game ID.");
            return;
        }
        if (games[gameId].players.length >= 2) {
            socket.emit("joinError", "Game is full.");
            return;
        }
        games[gameId].players.push(socket.id);
        games[gameId].scores[socket.id] = 0;
        games[gameId].readyPlayers = []; // Initialize readyPlayers array
        socket.join(gameId);
        io.to(gameId).emit("gameJoined", games[gameId]);
    });

    // Handle player ready event
    socket.on("playerReady", (gameId) => {
        const game = games[gameId];
        if (!game || game.readyPlayers.includes(socket.id)) return;

        game.readyPlayers.push(socket.id); // Mark player as ready
        console.log(`Player ${socket.id} is ready for game ${gameId}`); // Log player readiness

        // Start the game if both players are ready
        if (game.readyPlayers.length === 2) {
            console.log("Both players are ready. Starting game for:", gameId); // Log game start
            startGame(gameId);
        }
    });

    // Handle player input
    socket.on("playerInput", (gameId, input) => {
        console.log(`Player input received: ${input}`); // Log player input
        const game = games[gameId];
        if (!game || !game.isGameActive) {
            console.log("Game is not active or does not exist.");
            return;
        }
    
        if (input === game.currentWord) {
            game.scores[socket.id] += 2; // +2 points for correct typing
        } else {
            game.scores[socket.id] = Math.max(game.scores[socket.id] - 1, 0); // -1 point for incorrect typing
        }
        console.log(`Updated scores:`, game.scores); // Log updated scores
        io.to(gameId).emit("updateScores", game.scores);
    
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
        console.log("A player disconnected:", socket.id);
        // Clean up games if a player disconnects
        for (const gameId in games) {
            const game = games[gameId];
            if (game.players.includes(socket.id)) {
                game.players = game.players.filter((player) => player !== socket.id);
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