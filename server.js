import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const adapter = new JSONFile("db.json");
const db = new Low(adapter, { polls: [] });

await db.read();


// ✅ CREATE POLL
app.post("/create", async (req, res) => {
    const { question, options } = req.body;

    if (!question || options.length < 2) {
        return res.status(400).json({ error: "Invalid poll data" });
    }

    const poll = {
        id: nanoid(6),
        question,
        options: options.map(opt => ({
            text: opt,
            votes: 0
        })),
        voters: []
    };

    db.data.polls.push(poll);
    await db.write();

    res.json({ link: `/poll.html?id=${poll.id}` });
});


// ✅ GET POLL
app.get("/poll/:id", (req, res) => {
    const poll = db.data.polls.find(p => p.id === req.params.id);

    if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
    }

    res.json(poll);
});


// ✅ SOCKET CONNECTION
io.on("connection", (socket) => {

    socket.on("joinPoll", (pollId) => {
        socket.join(pollId);
    });

    socket.on("vote", async ({ pollId, optionIndex, voterId }) => {

        const poll = db.data.polls.find(p => p.id === pollId);
        if (!poll) return;

        // ⭐ Anti-duplicate voting
        if (poll.voters.includes(voterId)) return;

        poll.options[optionIndex].votes++;
        poll.voters.push(voterId);

        await db.write();

        io.to(pollId).emit("updateResults", poll.options);
    });
});


server.listen(3000, () => {
    console.log("🚀 Server running at http://localhost:3000");
});