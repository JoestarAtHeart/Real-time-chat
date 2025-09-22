const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// --- Server-side data structure ---
// channels = {
//   channelName: {
//     users: Set of usernames,
//     creator: username who created the channel,
//     messages: array of { channel, text, author, timestamp }
//   }
// }
let channels = {
    General: { users: new Set(), creator: null, messages: [] },
};

// Handle socket connections
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Set username
    socket.on("set username", (name) => {
        socket.username = name;

        // Add user to General channel
        channels["General"].users.add(name);
        socket.join("General");

        // Update all clients with General channel users including creator info
        io.to("General").emit("update users", {
            users: Array.from(channels["General"].users),
            creator: channels["General"].creator,
        });
    });

    // Send list of accessible channels to the connected user
    socket.emit(
        "existing channels",
        Object.keys(channels).filter(
            (ch) => channels[ch].users.has(socket.username) || ch === "General"
        )
    );

    // Join a channel
    socket.on("join channel", ({ channel, username }) => {
        socket.username = username;

        // Leave all other channels
        for (let ch in channels) {
            if (channels[ch].users.has(username)) {
                channels[ch].users.delete(username);
                socket.leave(ch);
                io.to(ch).emit("update users", {
                    users: Array.from(channels[ch].users),
                    creator: channels[ch].creator,
                });
            }
        }

        // Create channel if it doesn't exist
        if (!channels[channel]) {
            channels[channel] = { users: new Set(), creator: null, messages: [] };
        }

        // Add user to the channel
        channels[channel].users.add(username);
        socket.join(channel);

        // Update channel members with creator info
        io.to(channel).emit("update users", {
            users: Array.from(channels[channel].users),
            creator: channels[channel].creator,
        });
    });

    // Create new channel
    socket.on("create channel", ({ channel, username }) => {
        if (!channels[channel]) {
            channels[channel] = { users: new Set([username]), creator: username, messages: [] };
            socket.join(channel);

            socket.emit("channel created", { channel, owner: username });
            io.to(channel).emit("update users", {
                users: Array.from(channels[channel].users),
                creator: channels[channel].creator,
            });
        }
    });

    // Delete a channel
    socket.on("delete channel", ({ channel, username }) => {
        if (channels[channel] && channels[channel].creator === username) {
            delete channels[channel];
            io.emit("channel deleted", channel);
        }
    });

    // Handle chat messages
    socket.on("chat message", ({ channel, text }) => {
        if (channels[channel] && channels[channel].users.has(socket.username)) {
            const messageData = { channel, text, author: socket.username, timestamp: Date.now() };
            channels[channel].messages.push(messageData);

            // Send message to all users in the channel
            io.to(channel).emit("chat message", messageData);
        }
    });

    // Get channel history
    socket.on("get channel messages", (channel) => {
        if (channels[channel]) {
            socket.emit("channel messages", { channel, messages: channels[channel].messages });
        }
    });

    // Request users for a channel
    socket.on("request users", (channel) => {
        if (channels[channel]) {
            io.to(socket.id).emit("update users", {
                users: Array.from(channels[channel].users),
                creator: channels[channel].creator,
            });
        }
    });

    // Search users to invite
    socket.on("search users", (query) => {
        const currentChannelUsers = channels[socket.currentChannel]?.users || new Set();
        const allUsers = Array.from(channels["General"].users);
        const results = allUsers.filter(
            (u) => u.toLowerCase().includes(query.toLowerCase()) && !currentChannelUsers.has(u)
        );
        socket.emit("search results", results);
    });

    // Invite user to channel
    socket.on("invite user", ({ channel, username: invited }) => {
        if (!channels[channel]) return;
        channels[channel].users.add(invited);

        const socketsToInvite = [];
        for (let [id, s] of io.sockets.sockets) {
            if (s.username === invited) socketsToInvite.push(s);
        }

        socketsToInvite.forEach(s => {
            s.join(channel);
            s.emit("existing channels", Object.keys(channels).filter(ch => channels[ch].users.has(invited) || ch === "General"));
        });

        io.to(channel).emit("update users", {
            users: Array.from(channels[channel].users),
            creator: channels[channel].creator,
        });
    });

    // Remove user from channel
    socket.on("remove user", ({ channel, username: removed }) => {
        if (!channels[channel]) return;

        channels[channel].users.delete(removed);

        // Send updated channels list
        for (let [id, s] of io.sockets.sockets) {
            if (s.username === removed) {
                s.leave(channel);
                s.emit("existing channels", Object.keys(channels).filter(ch => channels[ch].users.has(removed) || ch === "General"));
                s.emit("channel messages", { channel: "General", messages: channels["General"].messages });
            }
        }

        io.to(channel).emit("update users", {
            users: Array.from(channels[channel].users),
            creator: channels[channel].creator,
        });
    });

    // Disconnect
    socket.on("disconnect", () => {
        for (let ch in channels) {
            if (socket.username && channels[ch].users.has(socket.username)) {
                channels[ch].users.delete(socket.username);
                io.to(ch).emit("update users", {
                    users: Array.from(channels[ch].users),
                    creator: channels[ch].creator,
                });
            }
        }
    });
});

// Start the server
server.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
});
