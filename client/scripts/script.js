// Initialize Socket.IO client
const socket = io("http://localhost:3001");

// DOM elements
const createChannelForm = document.querySelector(".create-channel-form");
const createChannelInput = createChannelForm.querySelector(".create-channel-input");
const channelsList = document.querySelector(".channels-list");
const messagesContainer = document.querySelector(".messages-container");
const newMessageForm = document.querySelector(".new-message-form");
const messageInput = newMessageForm.querySelector(".message-input");
const chatName = document.querySelector(".active-chat-name");

// Members pannel elements
const membersList = document.querySelector(".members-list");
const channelMembersContainer = document.querySelector(".channel-members-container");
const showMembersBtn = document.querySelector(".chat-members-button");

// Popup for adding users to channels
const popupContainer = document.querySelector(".popup-container");
const addUserButton = document.querySelector(".add-user-button");
const closePopupButton = popupContainer.querySelector(".close-popup-button");
const userSearchForm = popupContainer.querySelector(".user-search-form");
const userSearchInput = popupContainer.querySelector(".search-user-input");
const userList = popupContainer.querySelector(".search-user-list");

// Opening members pannel
showMembersBtn.addEventListener("click", () => {
    channelMembersContainer.classList.toggle("active");
});

addUserButton.addEventListener("click", () => {
    if (currentChannel === "General") {
        alert("Users cannot be invited to the General");
        return;
    }

    popupContainer.classList.toggle("active");
});

closePopupButton.addEventListener("click", () => {
    popupContainer.classList.remove("active");
});

// Client data
let currentChannel = "General";
let username = "";

// Ask username once
function askUsername() {
    let name = "";
    while (!name) {
        name = prompt("Enter your username:", "").trim();
        if (!name) alert("Username cannot be empty.");
    }
    return name;
}

username = askUsername();
socket.emit("set username", username);

// Store messages by channel
let messagesByChannel = { General: [] };

// Helper functions
function addMessage(channel, { text, author }) {
    if (!messagesByChannel[channel]) {
        messagesByChannel[channel] = [];
    }

    messagesByChannel[channel].push({ text, author });

    if (channel === currentChannel) {
        renderMessages(channel);
    }
}

// Render messages for the active channel
function renderMessages(channel) {
    messagesContainer.innerHTML = "";
    if (messagesByChannel[channel]) {
        messagesByChannel[channel].forEach(({ text, author }) => {
            const messageEl = document.createElement("div");
            messageEl.classList.add("message");
            if (author === username) messageEl.classList.add("current-user-message");
            messageEl.textContent = `${author}: ${text}`;
            messagesContainer.appendChild(messageEl);
        });
    }
}

function renderMembers(users, channelCreator) {
    membersList.innerHTML = "";
    users.forEach(user => {
        const li = document.createElement("li");
        li.classList.add("member");
        if (user === username) li.classList.add("current-user");

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("member-name");
        nameSpan.textContent = user;
        li.appendChild(nameSpan);

        // Show kick button only if:
        // * current user is the channel creator
        // * the user to kick is not the creator
        // * not yourself
        if (
            username === channelCreator &&
            user !== channelCreator &&
            user !== username &&
            currentChannel !== "General"
        ) {
            const kickBtn = document.createElement("button");
            kickBtn.classList.add("kick-user-button");

            const kickIcon = document.createElement("img");
            kickIcon.classList.add("kick-user-icon");
            kickIcon.src = "./images/delete-user-icon.svg";
            kickIcon.alt = "kick user icon";

            kickBtn.appendChild(kickIcon);
            li.appendChild(kickBtn);

            kickBtn.addEventListener("click", () => {
                socket.emit("remove user", { channel: currentChannel, username: user });
            });
        }

        membersList.appendChild(li);
    });
}

// Switch channel
function setActiveChannel(channelName) {
    currentChannel = channelName;

    const allItems = document.querySelectorAll(".channels-list-item");
    allItems.forEach(item => item.classList.remove("active"));
    const activeItem = [...allItems].find(item => {
        const div = item.querySelector(".channel-name");
        return div && div.textContent === channelName;
    });
    if (activeItem) activeItem.classList.add("active");

    chatName.textContent = channelName;
    if (!messagesByChannel[channelName]) messagesByChannel[channelName] = [];

    // Request message history 
    socket.emit("get channel messages", channelName);

    renderMessages(channelName);

    // Request member list
    socket.emit("request users", channelName);
}

// Add channel to channel list in DOM
function addChannelToList(channelName, isOwner = false) {
    const li = document.createElement("li");
    li.classList.add("channels-list-item");

    if (channelName === currentChannel) {
        li.classList.add("active");
    }

    const nameDiv = document.createElement("div");
    nameDiv.classList.add("channel-name");
    nameDiv.textContent = channelName;
    li.appendChild(nameDiv);

    // Add delete button if user owns the channel
    if (isOwner && channelName !== "General") {
        li.classList.add("current-user-channel");
        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("delete-channel-button");
        const deleteIcon = document.createElement("img");
        deleteIcon.src = "./images/trashbox-icon.svg";
        deleteIcon.alt = "trashbox icon";
        deleteIcon.classList.add("delete-channel-icon");
        deleteBtn.appendChild(deleteIcon);
        li.appendChild(deleteBtn);

        deleteBtn.addEventListener("click", e => {
            e.stopPropagation();
            socket.emit("delete channel", { channel: channelName, username });
        });
    }

    // Switch to channel on click
    li.addEventListener("click", e => {
        if (e.target.closest(".delete-channel-button")) return;
        setActiveChannel(channelName);
    });

    channelsList.prepend(li);
}

// Socket handlers
socket.on("connect", () => {
    socket.emit("join channel", { channel: "General", username });
});

socket.on("chat message", ({ channel, text, author }) => {
    addMessage(channel, { text, author });
});

socket.on("channel messages", ({ channel, messages }) => {
    messagesByChannel[channel] = messages.map(({ text, author }) => ({ text, author }));
    if (channel === currentChannel) {
        renderMessages(channel);
    }
});

socket.on("existing channels", channelNames => {
    channelsList.innerHTML = "";
    channelNames.forEach(ch => addChannelToList(ch));
    setActiveChannel("General");
});

socket.on("channel created", ({ channel, owner }) => {
    const isOwner = owner === username;
    addChannelToList(channel, isOwner);
    if (isOwner) {
        setActiveChannel(channel);
    }
});

socket.on("channel deleted", channelName => {
    const li = [...channelsList.children].find(item => item.querySelector(".channel-name").textContent === channelName);
    if (li) {
        li.remove();
    }

    delete messagesByChannel[channelName];

    if (currentChannel === channelName) {
        setActiveChannel("General");
    }
});

socket.on("update users", ({ users, creator }) => {
    renderMembers(users, creator);
});

// Create channel
createChannelForm.addEventListener("submit", e => {
    e.preventDefault();

    const name = createChannelInput.value.trim();
    if (!name) return;

    socket.emit("create channel", { channel: name, username });
    createChannelInput.value = "";
});

// Send message
newMessageForm.addEventListener("submit", e => {
    e.preventDefault();

    const text = messageInput.value.trim();
    if (!text) return;

    socket.emit("chat message", { channel: currentChannel, text });
    messageInput.value = "";
});

// Search users in popup
userSearchForm.addEventListener("submit", e => {
    e.preventDefault();

    const query = userSearchInput.value.trim().toLowerCase();
    if (!query) return;

    userList.innerHTML = "";
    socket.emit("search users", query);
});

socket.on("search results", users => {
    users.forEach(user => {
        const li = document.createElement("li");
        li.classList.add("search-user-list-item");

        const nameDiv = document.createElement("div");
        nameDiv.classList.add("found-user-name");
        nameDiv.textContent = user;
        li.appendChild(nameDiv);

        const inviteBtn = document.createElement("button");
        inviteBtn.classList.add("invite-user-button");
        const icon = document.createElement("img");
        icon.src = "./images/invite-user-icon.svg";
        icon.alt = "invite icon";
        icon.classList.add("invite-user-icon");
        inviteBtn.appendChild(icon);

        inviteBtn.addEventListener("click", () => {
            socket.emit("invite user", { channel: currentChannel, username: user });
            li.remove();
        });

        li.appendChild(inviteBtn);
        userList.appendChild(li);
    });
});

// Search channels
const searchForm = document.querySelector(".search-form");
const searchInput = searchForm.querySelector(".search-channel-input");
const clearBtn = searchForm.querySelector(".clear-field-button");

searchForm.addEventListener("submit", evt => {
    evt.preventDefault(); // предотвращаем перезагрузку страницы
    const query = searchInput.value.trim().toLowerCase();

    const items = document.querySelectorAll(".channels-list-item");
    items.forEach(item => {
        const channelName = item.querySelector(".channel-name").textContent.toLowerCase();
        if (channelName.includes(query)) {
            item.classList.remove("hidden");
        } else {
            item.classList.add("hidden");
        }
    });
});

clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    const items = document.querySelectorAll(".channels-list-item");
    items.forEach(item => item.classList.remove("hidden"));
});
