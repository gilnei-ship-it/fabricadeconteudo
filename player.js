const socket = io();
const screens = { login: document.getElementById('login-screen'), waiting: document.getElementById('waiting-screen'), game: document.getElementById('game-screen') };
let myRoomCode = '';

document.getElementById('join-btn').addEventListener('click', () => {
    const code = document.getElementById('code-input').value.toUpperCase();
    const name = document.getElementById('name-input').value.trim();
    if (code.length === 4 && name.length > 0) {
        myRoomCode = code;
        socket.emit('joinRoom', { roomCode: code, nickname: name });
    }
});

socket.on('joined', () => {
    screens.login.classList.add('hidden');
    screens.waiting.classList.remove('hidden');
});

socket.on('gameStarted', () => {
    screens.waiting.classList.add('hidden');
    screens.game.classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
});

// Ação de clique no celular
const btn = document.getElementById('action-btn');
const sendAction = (e) => {
    if(e) e.preventDefault();
    socket.emit('playerAction', { roomCode: myRoomCode });
    if (navigator.vibrate) navigator.vibrate(20); // Resposta tátil
};

btn.addEventListener('touchstart', sendAction);
btn.addEventListener('click', sendAction);
