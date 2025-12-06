import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Floor
const floorGeo = new THREE.PlaneGeometry(50, 30);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light);

// Heroes
const hero1Geo = new THREE.BoxGeometry(1, 2, 1);
const hero1Mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const hero1 = new THREE.Mesh(hero1Geo, hero1Mat);
hero1.position.set(-5, 1, 0);
scene.add(hero1);

const hero2Geo = new THREE.BoxGeometry(1, 2, 1);
const hero2Mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const hero2 = new THREE.Mesh(hero2Geo, hero2Mat);
hero2.position.set(5, 1, 0);
scene.add(hero2);

// Ball
const ballGeo = new THREE.SphereGeometry(0.7, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.position.set(0, 1, 0);
scene.add(ball);

// Keyboard input
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Movement & jump variables
const speed = 0.15;
const jumpVelocity = 0.4;
const gravity = -0.02;
let hero1VelY = 0, hero2VelY = 0;
let hero1CanJump = true, hero2CanJump = true;
let ballVel = new THREE.Vector3();

camera.position.set(0, 20, 30);
camera.lookAt(0,0,0);

function animate() {
    requestAnimationFrame(animate);

    // Hero1 WASD + Space
    if (keys['w']) hero1.position.z -= speed;
    if (keys['s']) hero1.position.z += speed;
    if (keys['a']) hero1.position.x -= speed;
    if (keys['d']) hero1.position.x += speed;
    if (keys[' '] && hero1CanJump) { hero1VelY = jumpVelocity; hero1CanJump = false; }

    hero1VelY += gravity;
    hero1.position.y += hero1VelY;
    if (hero1.position.y <= 1) { hero1.position.y = 1; hero1VelY = 0; hero1CanJump = true; }

    // Hero2 Arrow keys + Up
    if (keys['arrowup']) hero2.position.z -= speed;
    if (keys['arrowdown']) hero2.position.z += speed;
    if (keys['arrowleft']) hero2.position.x -= speed;
    if (keys['arrowright']) hero2.position.x += speed;
    if (keys['enter'] && hero2CanJump) { hero2VelY = jumpVelocity; hero2CanJump = false; }

    hero2VelY += gravity;
    hero2.position.y += hero2VelY;
    if (hero2.position.y <= 1) { hero2.position.y = 1; hero2VelY = 0; hero2CanJump = true; }

    // Simple ball physics (collisions with heroes)
    function collide(hero) {
        const dir = new THREE.Vector3().subVectors(ball.position, hero.position);
        if (dir.length() < 1.5) {
            dir.normalize();
            ballVel.add(dir.multiplyScalar(0.3));
        }
    }
    collide(hero1);
    collide(hero2);

    ballVel.y += gravity;
    ball.position.add(ballVel);

    if (ball.position.y <= 0.7) { ball.position.y = 0.7; ballVel.y = 0; }

    // Dampen ball velocity
    ballVel.multiplyScalar(0.98);

    //render
    renderer.render(scene, camera);
}

animate();