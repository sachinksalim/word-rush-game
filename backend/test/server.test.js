import { expect } from "chai";
import sinon from "sinon";
import { server, games } from "../server.js";
import ioClient from "socket.io-client";
// import { words } from "../config.js";

describe("Word Rush Game - Both Players Play", () => {
    let player1, player2;
    let createdGameId;

    before((done) => {
        const port = server.address().port;
        player1 = ioClient(`http://localhost:${port}`);
        player2 = ioClient(`http://localhost:${port}`);

        Promise.all([
            new Promise((resolve) => player1.on("connect", resolve)),
            new Promise((resolve) => player2.on("connect", resolve)),
        ]).then(() => {
            done();
        });
    });

    after((done) => {
        if (player1) {
            player1.disconnect();
        }
        if (player2) {
            player2.disconnect();
        }
        done();
    });

    it("should allow players to set usernames", (done) => {
        player1.emit("setUsername", "Alice");

        player1.on("usernameSet", (username) => {
            expect(username).to.equal("Alice");
        });

        player2.emit("setUsername", "Bob");

        player2.on("usernameSet", (username) => {
            expect(username).to.equal("Bob");
            done();
        });
    });

    it("should create and join a game with usernames", (done) => {
        player1.emit("createGame");

        player1.on("gameCreated", (gameId) => {
            createdGameId = gameId;

            player2.emit("joinGame", createdGameId);

            player2.on("gameJoined", (gameState) => {
                expect(gameState.players).to.have.lengthOf(2);
                expect(gameState.players).to.include("Alice");
                expect(gameState.players).to.include("Bob");
                done();
            });
        });
    });

    it("should update scores for both players", (done) => {
        const input1 = "apple";
        const input2 = "banana";

        player1.emit("playerReady", createdGameId);
        player2.emit("playerReady", createdGameId);

        player1.on("gameStarted", (word) => {
            player1.emit("playerInput", createdGameId, input1);
            setTimeout(() => {
                player2.emit("playerInput", createdGameId, input2);
            }, 500);

            player1.on("updateScores", (data) => {
                if (data.triggeredBy === "Alice") {
                    expect(data.scores["Alice"]).to.equal(2);
                }
            });

            player2.on("updateScores", (data) => {
                if (data.triggeredBy === "Bob") {
                    expect(data.scores["Bob"]).to.equal(2);
                    done();
                }
            });
        });
    });
});