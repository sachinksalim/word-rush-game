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
const readyButton = document.getElementById("ready-button");
const usernameDisplay = document.getElementById("username");

let gameId;
let isGameActive = false;
let username;

//

const USERNAME_DISABLED = true;
if(USERNAME_DISABLED) {
    setTimeout(() => {
        username = socket.id.substring(2, 12);
        socket.emit("setUsername", username);
    }, 500);
}
else {
    // Prompt for username
    username = prompt("Enter your username:");
    if (username) {
        socket.emit("setUsername", username);
    } else {
        alert("Username is required to play.");
        window.location.reload(); // Reload the page to prompt again
    }
}

socket.on("usernameSet", (username) => {
    usernameDisplay.textContent = username; // Display the username
    console.log("Username set as:", username);
});

// Create a new game
createGameButton.addEventListener("click", () => {
    socket.emit("createGame");
});

// Join an existing game
joinGameButton.addEventListener("click", () => {
    gameId = gameIdInput.value.trim();
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
    inputBox.disabled = true;
    readyButton.disabled = false;
});

// Handle Ready button click
readyButton.addEventListener("click", () => {
    socket.emit("playerReady", gameId);
    readyButton.disabled = true;
});

// Handle game start
socket.on("gameStarted", (word) => {
    isGameActive = true;
    wordDisplay.textContent = word;
    inputBox.disabled = false;
    inputBox.focus();
});

// Handle game updates (new word and scores)
socket.on("gameUpdated", (data) => {
    wordDisplay.textContent = data.word;
    inputBox.value = "";
    inputBox.focus();
    updateScores(data.scores);
});

// Handle score updates
socket.on("updateScores", (data) => {
    updateScores(data.scores);
});

// Function to update scores
function updateScores(scores) {
    yourScoreDisplay.textContent = scores[username]; // Use socket.id as the username
    const opponentUsername = Object.keys(scores).find((u) => u !== username); // Find the opponent's username
    if (opponentUsername) {
        opponentScoreDisplay.textContent = scores[opponentUsername]; // Update opponent's score
    }
}

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
    updateScores(scores);
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
    socket.emit("joinGame", gameId);
});