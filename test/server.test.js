import { expect } from "chai"; // Import expect from chai
import sinon from "sinon"; // Import sinon for mocking
import { server, games } from "../server.js"; // Import server and games from server.js
import ioClient from "socket.io-client"; // Import socket.io-client for simulating clients

describe("Word Rush Game", () => {
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

    it("should create a game and allow a second player to join", (done) => {
        player1.emit("createGame");

        player1.on("gameCreated", (gameId) => {
            createdGameId = gameId;
            console.log("Game created with ID:", createdGameId);

            player2.emit("joinGame", createdGameId);

            player2.on("gameJoined", (gameState) => {
                console.log("Player 2 joined game:", gameState);
                expect(gameState.players).to.have.lengthOf(2); // Ensure both players are in the game
                done();
            });
        });
    });

    it("should start the game when both players are ready", (done) => {
        player1.emit("playerReady", createdGameId);
        player2.emit("playerReady", createdGameId);

        player1.on("gameStarted", (word) => {
            console.log("Game started with word:", word);
            expect(word).to.be.a("string"); // Ensure a valid word is provided
            done();
        });
    });

    it("should update scores correctly when a player submits a valid input", (done) => {
        const input = "apple";
    
        player1.on("updateScores", (scores) => {
            console.log("updateScores event received:", scores);
            try {
                expect(scores[player1.id]).to.equal(2); // +2 points for correct input
                done();
            } catch (error) {
                done(error);
            }
        });
    
        player1.emit("playerInput", createdGameId, input);
    });
});