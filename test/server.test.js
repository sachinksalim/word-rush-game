import { expect } from "chai"; // Import expect from chai
import sinon from "sinon"; // Import sinon for mocking
import { server, games } from "../server.js"; // Import server and games from server.js
import ioClient from "socket.io-client"; // Import socket.io-client for simulating clients

describe("Word Rush Game - Username Handling", () => {
    let player1, player2;
    let createdGameId;

    before((done) => {
        // Simulate two client connections
        const port = server.address().port; // Get the port from the existing server
        player1 = ioClient(`http://localhost:${port}`);
        player2 = ioClient(`http://localhost:${port}`);

        // Wait for both players to connect
        Promise.all([
            new Promise((resolve) => player1.on("connect", resolve)),
            new Promise((resolve) => player2.on("connect", resolve)),
        ]).then(() => {
            console.log("Both players connected."); // Log client connections
            done();
        });
    });

    after((done) => {
        // Disconnect the clients
        if (player1) {
            player1.disconnect();
            console.log("Player 1 disconnected."); // Log client disconnection
        }
        if (player2) {
            player2.disconnect();
            console.log("Player 2 disconnected."); // Log client disconnection
        }
        done();
    });

    it("should allow players to set usernames", (done) => {
        // Player 1 sets a username
        player1.emit("setUsername", "Alice");

        player1.on("usernameSet", (username) => {
            console.log(`Player 1 username set to ${username}`);
            expect(username).to.equal("Alice");

            // Player 2 sets a username
            player2.emit("setUsername", "Bob");

            player2.on("usernameSet", (username) => {
                console.log(`Player 2 username set to ${username}`);
                expect(username).to.equal("Bob");
                done();
            });
        });
    });

    it("should reject invalid or duplicate usernames", (done) => {
        // Player 1 tries to set an empty username
        player1.emit("setUsername", "");

        player1.on("usernameError", (message) => {
            console.log(`Username error: ${message}`);
            expect(message).to.equal("Invalid username.");

            // Player 2 tries to set a duplicate username
            player2.emit("setUsername", "Alice");

            player2.on("usernameError", (message) => {
                console.log(`Username error: ${message}`);
                expect(message).to.equal("Username is already taken.");
                done();
            });
        });
    });

    it("should create and join a game with usernames", (done) => {
        // Player 1 creates the game
        player1.emit("createGame");

        player1.on("gameCreated", (gameId) => {
            createdGameId = gameId;
            console.log("Game created with ID:", createdGameId);

            // Player 2 joins the game
            player2.emit("joinGame", createdGameId);

            player2.on("gameJoined", (gameState) => {
                console.log("Player 2 joined game:", gameState);
                expect(gameState.players).to.have.lengthOf(2); // Ensure both players are in the game
                expect(gameState.players).to.include("Alice"); // Player 1's username
                expect(gameState.players).to.include("Bob"); // Player 2's username
                done();
            });
        });
    });

    it("should update scores correctly with usernames", (done) => {
        const input = "apple";

        // Player 1 notifies they're ready
        player1.emit("playerReady", createdGameId);

        // Player 2 notifies they're ready
        player2.emit("playerReady", createdGameId);

        // Player 1 listens for gameStarted event
        player1.on("gameStarted", (word) => {
            console.log("Game started with word:", word);

            // Player 1 listens for updateScores event
            player1.on("updateScores", (scores) => {
                console.log("updateScores event received:", scores);
                try {
                    // Verify score update for Player 1 (Alice)
                    expect(scores["Alice"]).to.equal(2); // +2 points for correct input
                    done();
                } catch (error) {
                    done(error); // Fail the test if the assertion fails
                }
            });

            // Player 1 emits playerInput event
            console.log("Player 1 emitting playerInput event with:", { gameId: createdGameId, input });
            player1.emit("playerInput", createdGameId, input);
        });
    });
});