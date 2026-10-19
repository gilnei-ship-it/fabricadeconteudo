const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
const rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[code] = { host: socket.id, players: {} };
        socket.join(code);
        socket.emit('roomCreated', code);
    });

    socket.on('joinRoom', ({ code, name }) => {
        if (rooms[code] && Object.keys(rooms[code].players).length < 20) {
            // Alterna cores entre azul e laranja
            const color = Object.keys(rooms[code].players).length % 2 === 0 ? '#2352B5' : '#FF6600';
            rooms[code].players[socket.id] = { name, color, x: 0.5 }; // Posição normalizada (0 a 1)
            socket.join(code);
            socket.emit('joined');
            io.to(rooms[code].host).emit('playerJoined', { id: socket.id, name, color });
        }
    });

    socket.on('move', ({ code, dir }) => {
        if (rooms[code]) io.to(rooms[code].host).emit('playerMove', { id: socket.id, dir });
    });

    socket.on('shoot', ({ code }) => {
        if (rooms[code]) io.to(rooms[code].host).emit('playerShoot', { id: socket.id });
    });
    
    socket.on('disconnect', () => {
        for (let code in rooms) {
            if (rooms[code].players[socket.id]) {
                delete rooms[code].players[socket.id];
                io.to(rooms[code].host).emit('playerLeft', socket.id);
            }
        }
    });
});

server.listen(3000, () => console.log('Servidor rodando na porta 3000'));
