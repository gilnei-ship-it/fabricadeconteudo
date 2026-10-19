const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for(let i=0; i<4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { host: socket.id, players: {} };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
    });

    socket.on('joinRoom', ({ roomCode, nickname }) => {
        const code = roomCode.toUpperCase();
        if (rooms[code]) {
            rooms[code].players[socket.id] = { nickname, score: 0 };
            socket.join(code);
            socket.emit('joined', code);
            io.to(rooms[code].host).emit('playerJoined', { id: socket.id, nickname });
        } else {
            socket.emit('errorMsg', 'Código de sala inválido.');
        }
    });

    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) io.to(roomCode).emit('gameStarted');
    });

    socket.on('playerAction', ({ roomCode }) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].score += 10; // 10 pontos por conteúdo gerado
            io.to(rooms[code].host).emit('updateScore', {
                id: socket.id,
                score: rooms[roomCode].players[socket.id].score
            });
        }
    });
});

server.listen(3000, () => console.log('Servidor rodando na porta 3000'));
