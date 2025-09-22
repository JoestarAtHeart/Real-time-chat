# RealTime Chat App

A simple real-time chat application built with **Node.js**, **Express**, and **Socket.IO**.  
Frontend is a static client (HTML/CSS/JS), backend runs on Node.js with WebSocket communication.

---

## Features
- Create and delete channels  
- Join channels and see members  
- Invite users to channels  
- Kick users (only channel creator)  
- Search users and channels  
- Real-time messaging with history  
- **General channel**: default channel available for everyone. It cannot be deleted, and users cannot be invited/kicked from it.  

---

## Installation & Usage

1. Clone the repository:
   ```bash
   git clone https://github.com/JoestarAtHeart/Real-time-chat.git
   cd Real-time-chat/

2. Install server dependencies:
   ```bash
   cd server
   npm install

3. Start the server:
   ```bash
   npm start

4. Open the client:
- Open client/index.html directly in your browser
- Or serve it with any static server (e.g. VS Code Live Server extension).

---

## Requirements
- Node.js (>=14)
- npm

---

## Project Structure
- **server/** – backend (Node.js + Express + Socket.IO)  
- **client/** – frontend (HTML, CSS, JavaScript)
