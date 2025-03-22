const socket = io();

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const createGameButton = document.getElementById("create-game");
const joinGameButton = document.getElementById("join-game");
const gameIdInput = document.getElementById("game-id");
const wordDisplay = document.getElementById("word-display");
const inputBox = document.getElementById("input-box");
const timerDisplay = document.getElementById("timer-display");
const yourScoreDisplay = document.getElementById("your-score");
const opponentScoreDisplay = document.getElementById("opponent-score");
const gameOverDisplay = document.getElementById("game-over");
const retryButton = document.getElementById("retry-button");

let gameId;
let isGameActive = false;

// Create a new game
createGameButton.addEventListener("click", () => {
    socket.emit("createGame");
});

// Join an existing game
joinGameButton.addEventListener("click", () => {
    const gameId = gameIdInput.value.trim();
    if (gameId) {
        socket.emit("joinGame", gameId);
    }
});

// Handle game creation
socket.on("gameCreated", (id) => {
    gameId = id;
    lobby.classList.add("hidden");
    game.classList.remove("hidden");
    alert(`Game created! Share this ID with your friend: ${id}`);
});

// Handle game joining
socket.on("gameJoined", (gameState) => {
    lobby.classList.add("hidden");
    game.classList.remove("hidden");
    isGameActive = true;
    inputBox.disabled = false;
    inputBox.focus();
});

// Handle game start
socket.on("gameStarted", (word) => {
    wordDisplay.textContent = word;
    inputBox.value = "";
    inputBox.focus();
});

// Handle score updates
socket.on("updateScores", (scores) => {
    yourScoreDisplay.textContent = scores[socket.id]; // Update your score
    const opponentId = Object.keys(scores).find((id) => id !== socket.id); // Find the opponent's ID
    if (opponentId) {
        opponentScoreDisplay.textContent = scores[opponentId]; // Update opponent's score
    }
});

// Handle timer updates
socket.on("updateTimer", (time) => {
    timerDisplay.textContent = `Time: ${time}`;
});

// Handle game over
socket.on("gameOver", (scores) => {
    isGameActive = false;
    inputBox.disabled = true;
    gameOverDisplay.classList.remove("hidden");
    retryButton.classList.remove("hidden");
});

// Handle player input
inputBox.addEventListener("keyup", (event) => {
    if (event.key === "Enter" && isGameActive) {
        const input = inputBox.value.trim();
        socket.emit("playerInput", gameId, input);
        inputBox.value = "";
    }
});

// Handle retry
retryButton.addEventListener("click", () => {
    gameOverDisplay.classList.add("hidden");
    retryButton.classList.add("hidden");
    inputBox.disabled = false;
    inputBox.focus();
    socket.emit("joinGame", gameId); // Rejoin the game
});