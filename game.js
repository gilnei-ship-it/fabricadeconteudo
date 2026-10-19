const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiScore = document.getElementById('score');
const uiWave = document.getElementById('wave');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const finalScoreEl = document.getElementById('final-score');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Cores
const COLORS = {
    primary: '#00D2FF',
    secondary: '#FF007F',
    gold: '#F5A623',
    white: '#FFFFFF'
};

// Áudio Contexto (Gerado Proceduralmente)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Utilitários de Vibração
function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// Efeito de Screenshake
function triggerShake() {
    document.body.classList.remove('shake');
    void document.body.offsetWidth; // Force reflow
    document.body.classList.add('shake');
}

// Entidades do Jogo
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = COLORS.primary;
        this.powerLevel = 1;
        this.kills = 0;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
    }
}

class Projectile {
    constructor(x, y, velocity, size = 5) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.radius = size;
        this.color = COLORS.primary;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

class Enemy {
    constructor(x, y, radius, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocity = velocity;
        this.color = COLORS.secondary;
        this.hit = false;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.hit ? COLORS.white : this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.hit = false; // Reset hit flash
        this.draw();
    }
}

class Particle {
    constructor(x, y, velocity, color) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.color = color;
        this.alpha = 1;
        this.radius = Math.random() * 3;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
        this.draw();
    }
}

class FloatingText {
    constructor(text, x, y) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.alpha = 1;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.font = "bold 20px 'Orbitron'";
        ctx.fillStyle = COLORS.gold;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.gold;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
    update() {
        this.y -= 1;
        this.alpha -= 0.02;
        this.draw();
    }
}

// Estado Global
let player;
let projectiles = [];
let enemies = [];
let particles = [];
let floatingTexts = [];
let animationId;
let score = 0;
let wave = 1;
let frames = 0;
let spawnRate = 100;
let gameActive = false;
let slowMo = false;

// Input do Rato/Toque
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('touchmove', (e) => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; });

function init() {
    player = new Player(canvas.width / 2, canvas.height / 2);
    projectiles = [];
    enemies = [];
    particles = [];
    floatingTexts = [];
    score = 0;
    wave = 1;
    frames = 0;
    spawnRate = 100;
    uiScore.innerText = score;
    uiWave.innerText = wave;
}

function spawnEnemies() {
    if (frames % spawnRate === 0) {
        const radius = Math.random() * (30 - 10) + 10;
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
        }
        const angle = Math.atan2(player.y - y, player.x - x);
        const speed = (Math.random() * 1.5 + 0.5) * (1 + wave * 0.2); // Escala com a onda
        const velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        enemies.push(new Enemy(x, y, radius, velocity));
    }
}

function handleShooting() {
    if (frames % Math.max(10, 30 - player.powerLevel * 2) === 0) { // Evolução da cadência
        const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
        playSound('shoot');
        
        // Tiro Múltiplo baseado no PowerLevel
        let projectilesToFire = 1;
        if (player.powerLevel > 5) projectilesToFire = 3;
        
        for (let i = 0; i < projectilesToFire; i++) {
            const spread = projectilesToFire > 1 ? (i - 1) * 0.2 : 0;
            const velocity = { x: Math.cos(angle + spread) * 7, y: Math.sin(angle + spread) * 7 };
            const size = Math.min(10, 5 + player.powerLevel * 0.5); // Evolução do tamanho
            projectiles.push(new Projectile(player.x, player.y, velocity, size));
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const vel = { x: (Math.random() - 0.5) * (Math.random() * 6), y: (Math.random() - 0.5) * (Math.random() * 6) };
        particles.push(new Particle(x, y, vel, color));
    }
}

function endGame() {
    gameActive = false;
    vibrate([300, 100, 300]); // Dano Crítico
    cancelAnimationFrame(animationId);
    overlay.classList.add('active');
    finalScoreEl.classList.remove('hidden');
    finalScoreEl.querySelector('span').innerText = score;
}

function animate() {
    if (!gameActive) return;
    animationId = requestAnimationFrame(animate);
    
    // Efeito Slow Motion
    if (slowMo) {
        ctx.fillStyle = 'rgba(11, 12, 16, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        slowMo = false; // reset após um frame longo
    } else {
        ctx.fillStyle = 'rgba(11, 12, 16, 0.2)'; // Rasto fluido
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    player.x += (mouse.x - player.x) * 0.1;
    player.y += (mouse.y - player.y) * 0.1;
    player.draw();

    handleShooting();
    spawnEnemies();

    // Atualizar Partículas e Textos
    particles.forEach((p, i) => { p.alpha <= 0 ? particles.splice(i, 1) : p.update(); });
    floatingTexts.forEach((t, i) => { t.alpha <= 0 ? floatingTexts.splice(i, 1) : t.update(); });

    // Atualizar Projéteis
    projectiles.forEach((proj, pIdx) => {
        proj.update();
        if (proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
            projectiles.splice(pIdx, 1);
        }
    });

    // Colisões e Inimigos
    enemies.forEach((enemy, eIdx) => {
        enemy.update();

        // Colisão Player x Enemy
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - enemy.radius - player.radius < 1) {
            createExplosion(player.x, player.y, COLORS.primary);
            endGame();
        }

        // Colisão Projectile x Enemy
        projectiles.forEach((proj, pIdx) => {
            const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
            if (dist - enemy.radius - proj.radius < 1) {
                enemy.hit = true;
                
                // Reduz tamanho do inimigo (vida)
                if (enemy.radius > 15) {
                    enemy.radius -= 5;
                    projectiles.splice(pIdx, 1);
                    createExplosion(enemy.x, enemy.y, COLORS.white);
                } else {
                    // Morte do Inimigo
                    score += 100;
                    player.kills++;
                    uiScore.innerText = score;
                    vibrate([50]);
                    playSound('explosion');
                    triggerShake();
                    createExplosion(enemy.x, enemy.y, COLORS.secondary);
                    floatingTexts.push(new FloatingText('+100', enemy.x, enemy.y));
                    
                    enemies.splice(eIdx, 1);
                    projectiles.splice(pIdx, 1);

                    // Evolução de Poder e Ondas
                    if (player.kills % 10 === 0) {
                        player.powerLevel++;
                        wave++;
                        uiWave.innerText = wave;
                        spawnRate = Math.max(20, spawnRate - 10);
                        vibrate([100, 50, 100, 50, 200]); // Celebração de Onda
                        slowMo = true; // Efeito Slow-mo de transição
                        floatingTexts.push(new FloatingText('LEVEL UP!', player.x, player.y - 30));
                    }
                }
            }
        });
    });
    frames++;
}

startBtn.addEventListener('click', () => {
    init();
    overlay.classList.remove('active');
    // Necessário para inicializar o AudioContext nos navegadores
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gameActive = true;
    animate();
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
