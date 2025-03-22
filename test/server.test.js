import { expect } from "chai"; // Import expect from chai
import sinon from "sinon"; // Import sinon for mocking
import { Server } from "socket.io"; // Import Server from socket.io
import http from "http"; // Import http module
import express from "express"; // Import express
import { server, games } from "../server.js"; // Import server and games from server.js

describe("Word Rush Game", () => {
    let io, socket;

    before((done) => {
        const app = express();
        const httpServer = http.createServer(app);
        io = new Server(httpServer);
        httpServer.listen(() => {
            const port = httpServer.address().port;
            socket = io(`http://localhost:${port}`);
            socket.on("connect", done);
        });
    });

    after(() => {
        io.close();
        socket.disconnect();
    });

    it("should update scores correctly", (done) => {
        const gameId = "testGame";
        const playerId = "player1";
        const input = "apple";

        // Mock game state
        server.games[gameId] = {
            players: [playerId],
            scores: { [playerId]: 0 },
            currentWord: "apple",
            currentWordIndex: 0,
            timer: 30,
            isGameActive: true,
        };

        // Emit player input
        socket.emit("playerInput", gameId, input);

        // Verify score update
        setTimeout(() => {
            expect(server.games[gameId].scores[playerId]).to.equal(2); // +2 points for correct input
            done();
        }, 100);
    });
});