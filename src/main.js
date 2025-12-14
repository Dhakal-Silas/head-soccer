// main.js
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Floor
const floorGeo = new THREE.PlaneGeometry(50, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: '#6e6340', side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

// Goal posts (height matches max jump)
const goalHeight = 6.5;
const goalPostMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

// Left goal
const leftGoalPost1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, goalHeight, 0.3), goalPostMat);
leftGoalPost1.position.set(-23, goalHeight / 2, 0);
scene.add(leftGoalPost1);

const leftGoalPost2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, goalHeight, 0.3), goalPostMat);
leftGoalPost2.position.set(-23, goalHeight / 2, 6);
scene.add(leftGoalPost2);

const leftGoalBar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 6.3), goalPostMat);
leftGoalBar.position.set(-23, goalHeight, 3);
scene.add(leftGoalBar);

// Right goal
const rightGoalPost1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, goalHeight, 0.3), goalPostMat);
rightGoalPost1.position.set(23, goalHeight / 2, 0);
scene.add(rightGoalPost1);

const rightGoalPost2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, goalHeight, 0.3), goalPostMat);
rightGoalPost2.position.set(23, goalHeight / 2, 6);
scene.add(rightGoalPost2);

const rightGoalBar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 6.3), goalPostMat);
rightGoalBar.position.set(23, goalHeight, 3);
scene.add(rightGoalBar);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Heroes
const hero1Geo = new THREE.BoxGeometry(1.5, 2.5, 1);
const hero1Mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const hero1 = new THREE.Mesh(hero1Geo, hero1Mat);
hero1.position.set(-10, 1.25, 3);
scene.add(hero1);

const hero2Geo = new THREE.BoxGeometry(1.5, 2.5, 1);
const hero2Mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const hero2 = new THREE.Mesh(hero2Geo, hero2Mat);
hero2.position.set(10, 1.25, 3);
scene.add(hero2);

// Ball
const ballGeo = new THREE.SphereGeometry(1, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.position.set(0, 1, 3);
scene.add(ball);

// Keyboard input
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Movement & jump variables
const speed = 0.2;
const jumpVelocity = 0.6;
const gravity = -0.025;
let hero1VelY = 0, hero2VelY = 0;
let hero1CanJump = true, hero2CanJump = true;
let ballVelX = -0.15, ballVelY = 0; // Ball starts moving towards hero1

// Position camera for 2D side view
camera.position.set(0, 8, 25);
camera.lookAt(0, 3, 3);

let score1 = 0, score2 = 0;
let lastScorer = 0; // 1 for hero1 scored, 2 for hero2 scored
let gameOver = false;

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const gameoverEl = document.getElementById('gameover');

// Timer (2 minutes = 120 seconds)
let timeLeft = 120;
const timerInterval = setInterval(() => {
    if (!gameOver) {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            endGame();
        }
    }
}, 1000);

function endGame() {
    gameOver = true;
    clearInterval(timerInterval);

    let winner = '';
    if (score1 > score2) {
        winner = 'Green Player Wins!';
    } else if (score2 > score1) {
        winner = 'Red Player Wins!';
    } else {
        winner = "It's a Draw!";
    }

    gameoverEl.innerHTML = `
        <div>GAME OVER</div>
        <div style="margin-top: 20px;">${winner}</div>
        <div style="margin-top: 20px; font-size: 36px;">Final Score: ${score1} - ${score2}</div>
    `;
    gameoverEl.style.display = 'block';
}

function updateScore() {
    scoreEl.textContent = `${score1} - ${score2}`;
}

function checkGoal() {
    // Check left goal (hero2 scores) - ball must be below goalpost height
    if (ball.position.x < -22 && ball.position.y < goalHeight && ball.position.z > 0 && ball.position.z < 6) {
        score2++;
        lastScorer = 2;
        updateScore();
        resetPlayers();
        resetBall();
    }
    // Check right goal (hero1 scores) - ball must be below goalpost height
    if (ball.position.x > 22 && ball.position.y < goalHeight && ball.position.z > 0 && ball.position.z < 6) {
        score1++;
        lastScorer = 1;
        updateScore();
        resetPlayers();
        resetBall();
    }

    // Ball hits the back of left goal post (above goal height) - bounce back
    if (ball.position.x < -22 && ball.position.y >= goalHeight) {
        ball.position.x = -22;
        ballVelX = -ballVelX * 0.7; // Reverse and dampen
    }

    // Ball hits the back of right goal post (above goal height) - bounce back
    if (ball.position.x > 22 && ball.position.y >= goalHeight) {
        ball.position.x = 22;
        ballVelX = -ballVelX * 0.7; // Reverse and dampen
    }
}

function resetPlayers() {
    // Reset players to original positions
    hero1.position.set(-10, 1.25, 3);
    hero2.position.set(10, 1.25, 3);
    hero1VelY = 0;
    hero2VelY = 0;
    hero1CanJump = true;
    hero2CanJump = true;
}

function resetBall() {
    // Reset ball to center
    ball.position.set(0, 1, 3);

    // Ball moves towards the player who should receive it
    // First goal or hero1 conceded - ball moves to hero1
    if (lastScorer === 0 || lastScorer === 2) {
        ballVelX = -0.15;
        ballVelY = 0;
    }
    // Hero2 conceded - ball moves to hero2
    else {
        ballVelX = 0.15;
        ballVelY = 0;
    }
}

function kickBall(hero, isHighShot) {
    const dx = ball.position.x - hero.position.x;
    const dy = ball.position.y - hero.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
        const direction = hero === hero1 ? 1 : -1;
        // High shot: more speed and much more height
        // Low shot: moderate speed and lower height
        ballVelX = direction * (isHighShot ? 1.2 : 1);
        ballVelY = isHighShot ? 0.8 : 0.3;
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (gameOver) {
        renderer.render(scene, camera);
        return;
    }

    // Hero1 - A/D for left/right, W for jump, J high kick, K low kick
    if (keys['a']) hero1.position.x -= speed;
    if (keys['d']) hero1.position.x += speed;
    if (keys['w'] && hero1CanJump) {
        hero1VelY = jumpVelocity;
        hero1CanJump = false;
    }
    if (keys['j']) {
        kickBall(hero1, true);
        keys['j'] = false;
    }
    if (keys['k']) {
        kickBall(hero1, false);
        keys['k'] = false;
    }

    hero1VelY += gravity;
    hero1.position.y += hero1VelY;
    if (hero1.position.y <= 1.25) {
        hero1.position.y = 1.25;
        hero1VelY = 0;
        hero1CanJump = true;
    }

    // Keep hero1 in bounds (can go anywhere)
    hero1.position.x = Math.max(-22, Math.min(22, hero1.position.x));

    // Hero2 - Arrow Left/Right, Arrow Up for jump, ' high kick, \ low kick
    if (keys['arrowleft']) hero2.position.x -= speed;
    if (keys['arrowright']) hero2.position.x += speed;
    if (keys['arrowup'] && hero2CanJump) {
        hero2VelY = jumpVelocity;
        hero2CanJump = false;
    }
    if (keys["'"]) {
        kickBall(hero2, true);
        keys["'"] = false;
    }
    if (keys['\\']) {
        kickBall(hero2, false);
        keys['\\'] = false;
    }

    hero2VelY += gravity;
    hero2.position.y += hero2VelY;
    if (hero2.position.y <= 1.25) {
        hero2.position.y = 1.25;
        hero2VelY = 0;
        hero2CanJump = true;
    }

    // Keep hero2 in bounds (can go anywhere)
    hero2.position.x = Math.max(-22, Math.min(22, hero2.position.x));

    // Ball physics - collisions with heroes (based on contact point)
    function collide(hero) {
        const dx = ball.position.x - hero.position.x;
        const dy = ball.position.y - hero.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1.5) {
            // Calculate angle based on where ball hits the hero
            const angle = Math.atan2(dy, dx);

            // Power depends on relative position
            const power = 0.35;

            // Horizontal velocity based on which side of hero was hit
            ballVelX = Math.cos(angle) * power;

            // Vertical velocity based on height of contact
            // If ball hits top of hero (dy > 0.5), it goes up more
            // If ball hits side/bottom, it gets less vertical velocity
            if (dy > 0.5) {
                // Hit from top - ball bounces up
                ballVelY = Math.abs(Math.sin(angle)) * power * 1.2;
            } else if (dy < -0.5) {
                // Hit from bottom - ball goes down then up (natural bounce)
                ballVelY = Math.sin(angle) * power * 0.8;
            } else {
                // Hit from side - medium vertical velocity
                ballVelY = Math.sin(angle) * power;
            }
        }
    }

    collide(hero1);
    collide(hero2);

    // Apply gravity to ball
    ballVelY += gravity;

    // Update ball position
    ball.position.x += ballVelX;
    ball.position.y += ballVelY;

    // Ball collision with floor
    if (ball.position.y <= 0.7) {
        ball.position.y = 0.7;
        // Bounce with damping, but preserve horizontal trajectory
        ballVelY = -ballVelY * 0.65;
    }

    // Ball collision with ceiling (if it goes too high)
    if (ball.position.y > 10) {
        ball.position.y = 10;
        // Reverse vertical velocity to make it come down
        ballVelY = -Math.abs(ballVelY) * 0.7;
    }

    // Ball collision with walls
    if (ball.position.x < -24 || ball.position.x > 24) {
        ballVelX = -ballVelX * 0.8;
        ball.position.x = ball.position.x < 0 ? -24 : 24;
    }

    // Keep ball in 2D plane
    ball.position.z = 3;

    // Dampen ball velocity
    ballVelX *= 0.99;
    ballVelY *= 0.99;

    checkGoal();

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});