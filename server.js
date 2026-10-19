const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let tvSocketId = null; 
const players = {}; 

io.on('connection', (socket) => {
    // A TV avisa que está online
    socket.on('registerTV', () => {
        tvSocketId = socket.id;
        console.log('TV registrada:', tvSocketId);
    });

    // Celular entra enviando apenas o nome
    socket.on('joinGame', (name) => {
        const color = Object.keys(players).length % 2 === 0 ? '#2352B5' : '#FF6600';
        players[socket.id] = { name, color };
        
        socket.emit('joined'); // Libera a tela de controle no celular
        
        // Avisa a TV que alguém entrou
        if (tvSocketId) {
            io.to(tvSocketId).emit('playerJoined', { id: socket.id, name, color });
        }
    });

    // Repassa os comandos de movimento e tiro para a TV
    socket.on('move', (dir) => {
        if (tvSocketId) io.to(tvSocketId).emit('playerMove', { id: socket.id, dir });
    });

    socket.on('shoot', () => {
        if (tvSocketId) io.to(tvSocketId).emit('playerShoot', { id: socket.id });
    });
    
    // Gerencia desconexões
    socket.on('disconnect', () => {
        if (socket.id === tvSocketId) {
            tvSocketId = null; 
            console.log('TV desconectada');
        } else if (players[socket.id]) {
            delete players[socket.id];
            if (tvSocketId) io.to(tvSocketId).emit('playerLeft', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
