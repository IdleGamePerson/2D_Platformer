const game = document.getElementById('game');
const player = document.getElementById('player');
const goal = document.getElementById('goal');
const winMessage = document.getElementById('win-message');
const timerDisplay = document.getElementById('timer');

const roomCountDisplay = document.getElementById('room-count');
const roomTimeDisplay = document.getElementById('room-time');
const totalTimeDisplay = document.getElementById('total-time');

let totalStartTime = Date.now();
let roomStartTime = Date.now();
let currentRoom = 1;

let lives = 3;
const livesDisplay = document.getElementById('lives');

let distanceMap = [];
let lastDistanceUpdate = 0;
const distanceUpdateInterval = 500; // ms

let enemies = [];
const enemySize = 30;
const enemyMoveInterval = 500; // ms

// Labyrinth
let cols = 20;
let rows = 20;
const cellSize = 40;
const playerSize = 30;
const maze = [];

// Spielerposition und Bewegung
let x = 5, y = 5;
let vx = 0, vy = 0;
const speed = 2.5;
const jump = -10;
const gravity = 0.35;
let onGround = false;
const keys = {};

let startTime = null;
let timeInterval = null;

// Tasteneingabe
document.addEventListener('keydown', (e) => keys[e.code] = true);
document.addEventListener('keyup', (e) => keys[e.code] = false);
document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && onGround) { // Linksklick & am Boden
    vy = jump;
    onGround = false;
  }
});

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function Cell(i, j) {
  this.i = i;
  this.j = j;
  this.visited = false;
  this.walls = { top: true, right: true, bottom: true, left: true };
}

function index(i, j) {
  if (i < 0 || j < 0 || i >= cols || j >= rows) return null;
  return i + j * cols;
}

function removeWalls(a, b) {
  const dx = b.i - a.i;
  const dy = b.j - a.j;
  if (dx === 1) { a.walls.right = false; b.walls.left = false; }
  if (dx === -1) { a.walls.left = false; b.walls.right = false; }
  if (dy === 1) { a.walls.bottom = false; b.walls.top = false; }
  if (dy === -1) { a.walls.top = false; b.walls.bottom = false; }
}

function generateMaze() {
  maze.length = 0;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      maze.push(new Cell(i, j));
    }
  }

  const stack = [];
  let current = maze[0];
  current.visited = true;
  let lastDir = null;

  while (true) {
    const directions = [
      { dx: 0, dy: -1, dir: 'top' },
      { dx: 1, dy: 0, dir: 'right' },
      { dx: 0, dy: 1, dir: 'bottom' },
      { dx: -1, dy: 0, dir: 'left' }
    ];

    const unvisitedNeighbors = [];

    for (let d of directions) {
      const ni = current.i + d.dx;
      const nj = current.j + d.dy;
      const neighbor = maze[index(ni, nj)];

      if (neighbor && !neighbor.visited) {
        // Bevorzugung für Richtungswechsel
        const directionChange = (lastDir !== d.dir);
        const weight = directionChange ? 3 : 1;
        for (let k = 0; k < weight; k++) {
          unvisitedNeighbors.push({ cell: neighbor, dir: d.dir, dx: d.dx, dy: d.dy });
        }
      }
    }

    if (unvisitedNeighbors.length > 0) {
      const choice = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
      const next = choice.cell;

      removeWalls(current, next);
      next.visited = true;

      stack.push(current);
      current = next;
      lastDir = choice.dir;
    } else if (stack.length > 0) {
      current = stack.pop();
      lastDir = null;
    } else {
      break;
    }
  }
}

function drawMaze() {
  for (let cell of maze) {
    const x = cell.i * cellSize;
    const y = cell.j * cellSize;

    if (cell.walls.top) addWall(x, y, cellSize, 2);
    if (cell.walls.right) addWall(x + cellSize - 2, y, 2, cellSize);
    if (cell.walls.bottom) addWall(x, y + cellSize - 2, cellSize, 2);
    if (cell.walls.left) addWall(x, y, 2, cellSize);
  }
}

function addWall(x, y, w, h) {
  const wall = document.createElement('div');
  wall.className = 'wall';
  wall.style.left = `${x}px`;
  wall.style.top = `${y}px`;
  wall.style.width = `${w}px`;
  wall.style.height = `${h}px`;
  game.appendChild(wall);
}

function rectsCollide(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function computeDistanceMap() {
  distanceMap = Array.from({ length: rows }, () => Array(cols).fill(Infinity));

  const queue = [];

  const startI = Math.floor(x / cellSize);
  const startJ = Math.floor(y / cellSize);

  distanceMap[startJ][startI] = 0;
  queue.push({ i: startI, j: startJ });

  while (queue.length > 0) {
    const { i, j } = queue.shift();
    const cell = maze[index(i, j)];
    const dist = distanceMap[j][i];

    const dirs = [
      { dx: 0, dy: -1, dir: 'top' },
      { dx: 1, dy: 0, dir: 'right' },
      { dx: 0, dy: 1, dir: 'bottom' },
      { dx: -1, dy: 0, dir: 'left' }
    ];

    for (let d of dirs) {
      const ni = i + d.dx;
      const nj = j + d.dy;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const neighbor = maze[index(ni, nj)];
      if (!cell.walls[d.dir] && distanceMap[nj][ni] > dist + 1) {
        distanceMap[nj][ni] = dist + 1;
        queue.push({ i: ni, j: nj });
      }
    }
  }
}

function weightedRandom(items, weights) {
  let total = 0;
  const r = Math.random();
  for (let i = 0; i < items.length; i++) {
    total += weights[i];
    if (r <= total) return items[i];
  }
  return items[items.length - 1]; // Fallback
}

function moveEnemy(enemy) {
  const cell = maze[index(enemy.i, enemy.j)];
  const neighbors = [];

  const dirs = [
    { dx: 0, dy: -1, dir: 'top' },
    { dx: 1, dy: 0, dir: 'right' },
    { dx: 0, dy: 1, dir: 'bottom' },
    { dx: -1, dy: 0, dir: 'left' }
  ];

  for (let d of dirs) {
    const ni = enemy.i + d.dx;
    const nj = enemy.j + d.dy;
    const neighbor = maze[index(ni, nj)];
    if (!neighbor) continue;

    if (!cell.walls[d.dir]) {
      const isLast = enemy.last && enemy.last.i === ni && enemy.last.j === nj;
      if (isLast && Math.random() > 0.1) continue;

      const distance = distanceMap[nj]?.[ni] ?? Infinity;
      neighbors.push({ i: ni, j: nj, distance });
    }
  }

  if (neighbors.length === 0 && enemy.last) {
    neighbors.push({ i: enemy.last.i, j: enemy.last.j, distance: 999 });
  }

  if (neighbors.length > 0) {
    const epsilon = 0.01;
    const weights = neighbors.map(n => 1 / (n.distance + epsilon));
    const sum = weights.reduce((a, b) => a + b, 0);
    const probs = weights.map(w => w / sum);
    const selected = weightedRandom(neighbors, probs);

    enemy.last = { i: enemy.i, j: enemy.j };
    enemy.i = selected.i;
    enemy.j = selected.j;

    enemy.element.style.left = enemy.i * cellSize + 5 + 'px';
    enemy.element.style.top = enemy.j * cellSize + 5 + 'px';
  }
}

function init() {
  // Zeit, Raumzähler, Start
  cols = 20 + (currentRoom - 1);
  rows = 20 + (currentRoom - 1);
  game.style.width = `${cols * cellSize}px`;
  game.style.height = `${rows * cellSize}px`;
  totalStartTime = Date.now();
  roomStartTime = Date.now();
  currentRoom = 1;
  roomCountDisplay.textContent = currentRoom;

  // Labyrinth, Spieler, Ziel initial aufbauen
  generateMaze();
  drawMaze();

  x = 5;
  y = 5;
  player.style.left = `${x}px`;
  player.style.top = `${y}px`;

  goal.style.left = `${(cols - 1) * cellSize + 5}px`;
  goal.style.top = `${(rows - 1) * cellSize + 5}px`;

  // Gegner initial platzieren (wie in resetLevel)
  const availableCells = maze.filter(c =>
    !(c.i === 0 && c.j === 0) &&
    !(c.i === cols - 1 && c.j === rows - 1)
  );
  shuffleArray(availableCells);
  for (let n = 0; n < 2; n++) {
    const cell = availableCells[n];
    const enemy = {
      i: cell.i,
      j: cell.j,
      last: null,
      element: document.createElement('div')
    };
    enemy.element.className = 'enemy';
    enemy.element.style.width = enemySize + 'px';
    enemy.element.style.height = enemySize + 'px';
    enemy.element.style.position = 'absolute';
    enemy.element.style.background = 'crimson';
    enemy.element.style.left = cell.i * cellSize + 5 + 'px';
    enemy.element.style.top = cell.j * cellSize + 5 + 'px';
    game.appendChild(enemy.element);
    enemies.push(enemy);
  }

  // Zeit-UI regelmäßig aktualisieren
  timeInterval = setInterval(() => {
    const now = Date.now();
    const roomElapsed = (now - roomStartTime) / 1000;
    const totalElapsed = (now - totalStartTime) / 1000;

    roomTimeDisplay.textContent = roomElapsed.toFixed(1);
    totalTimeDisplay.textContent = totalElapsed.toFixed(1);
  }, 100);

  // Spieler regelmäßig leicht anheben (Anti-Boden-Glitch)
  setInterval(() => {
    y = Math.max(0, y - 1);
  }, 100);

  // Gegnerbewegung alle 0.5s
  setInterval(() => {
    for (let enemy of enemies) {
      moveEnemy(enemy);
    }
  }, enemyMoveInterval);

  // Spiel-Loop starten
  requestAnimationFrame(update);
  computeDistanceMap();
  lives = 3;
  livesDisplay.textContent = lives;
}

function update() {
  const now = Date.now();

  // Distance Map aktualisieren
  if (now - lastDistanceUpdate > distanceUpdateInterval) {
    computeDistanceMap();
    lastDistanceUpdate = now;
  }

  // Eingabe: Bewegung & Sprung
  vx = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) vx = -speed;
  if (keys['ArrowRight'] || keys['KeyD']) vx = speed;
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && onGround) {
    vy = jump;
    onGround = false;
  }

  vy += gravity;

  let nextX = x + vx;
  let nextY = y + vy;
  const playerRect = { x: nextX, y: nextY, width: playerSize, height: playerSize };
  onGround = false;

  // Wandkollision prüfen
  const walls = document.getElementsByClassName('wall');
  for (let wall of walls) {
    const rect = wall.getBoundingClientRect();
    const gameRect = game.getBoundingClientRect();
    const wallRect = {
      x: rect.left - gameRect.left,
      y: rect.top - gameRect.top,
      width: rect.width,
      height: rect.height
    };

    if (rectsCollide(playerRect, wallRect)) {
      if (x + playerSize <= wallRect.x && nextX + playerSize > wallRect.x) {
        nextX = wallRect.x - playerSize;
      } else if (x >= wallRect.x + wallRect.width && nextX < wallRect.x + wallRect.width) {
        nextX = wallRect.x + wallRect.width;
      }

      if (y + playerSize <= wallRect.y && nextY + playerSize > wallRect.y) {
        nextY = wallRect.y - playerSize;
        vy = 0;
        onGround = true;
      } else if (y >= wallRect.y + wallRect.height && nextY < wallRect.y + wallRect.height) {
        nextY = wallRect.y + wallRect.height;
        vy = 0;
      }
    }
  }

  // Spielfeldbegrenzung
  nextX = Math.max(0, Math.min(nextX, cols * cellSize - playerSize));
  nextY = Math.max(0, Math.min(nextY, rows * cellSize - playerSize));

  // Position aktualisieren
  x = nextX;
  y = nextY;
  player.style.left = `${x}px`;
  player.style.top = `${y}px`;

  // Kamera folgt dem Spieler
  const viewport = document.getElementById('viewport');
  const offsetX = x + playerSize / 2 - viewport.clientWidth / 2;
  const offsetY = y + playerSize / 2 - viewport.clientHeight / 2;
  game.style.left = `${-offsetX}px`;
  game.style.top = `${-offsetY}px`;

  // Ziel erreicht?
  if (rectsCollide(
    { x, y, width: playerSize, height: playerSize },
    {
      x: (cols - 1) * cellSize + 5,
      y: (rows - 1) * cellSize + 5,
      width: 30,
      height: 30
    }
  )) {
    resetLevel();
  }

  // Gegnerkollision prüfen
  for (let enemy of enemies) {
    const ex = enemy.i * cellSize + 5;
    const ey = enemy.j * cellSize + 5;
    const enemyRect = {
      x: ex,
      y: ey,
      width: enemySize,
      height: enemySize
    };

    if (rectsCollide(
      { x, y, width: playerSize, height: playerSize },
      enemyRect
    )) {
      lives--;
      livesDisplay.textContent = lives;

      if (lives <= 0) {
        alert("💀 Game Over!");
        location.reload();
        return;
      }

      // Gegner zufällig neu platzieren
      const available = maze.filter(c =>
        !(c.i === 0 && c.j === 0) &&
        !(c.i === cols - 1 && c.j === rows - 1)
      );
      shuffleArray(available);
      const newCell = available[0];
      enemy.i = newCell.i;
      enemy.j = newCell.j;
      enemy.element.style.left = newCell.i * cellSize + 5 + 'px';
      enemy.element.style.top = newCell.j * cellSize + 5 + 'px';
      enemy.last = null;

      break;
    }
  }

  // Fog-of-War Maske aktualisieren (absolut zum Bildschirm)
  const fog = document.getElementById('fog');
  const radius = 5 * cellSize;
  const viewportRect = viewport.getBoundingClientRect();
  const cx = viewportRect.left + viewport.clientWidth / 2;
  const cy = viewportRect.top + viewport.clientHeight / 2;

  const gradient = `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, transparent 0%, transparent ${radius - 5}px, black ${radius}px)`;
  fog.style.maskImage = gradient;
  fog.style.webkitMaskImage = gradient;

  // Weiter animieren
  requestAnimationFrame(update);
}


function resetLevel() {
  // Raumzähler erhöhen
  currentRoom++;
  roomCountDisplay.textContent = currentRoom;

  // Neue Labyrinthgröße berechnen
  cols = 20 + (currentRoom - 1);
  rows = 20 + (currentRoom - 1);
  const totalCells = cols * rows;

  // Spielfeldgröße anpassen
  game.style.width = `${cols * cellSize}px`;
  game.style.height = `${rows * cellSize}px`;

  // Wände entfernen
  document.querySelectorAll('.wall').forEach(w => w.remove());
  maze.length = 0;

  // Labyrinth neu generieren
  generateMaze();
  drawMaze();

  // Spielerposition zurücksetzen
  x = 5;
  y = 5;
  player.style.left = `${x}px`;
  player.style.top = `${y}px`;

  // Zielposition setzen (rechts unten)
  goal.style.left = `${(cols - 1) * cellSize + 5}px`;
  goal.style.top = `${(rows - 1) * cellSize + 5}px`;

  // Zeit zurücksetzen
  roomStartTime = Date.now();

  // Gegner entfernen
  document.querySelectorAll('.enemy').forEach(e => e.remove());
  enemies = [];

  // Gegneranzahl berechnen
  const enemyCount = Math.floor(totalCells / 200);

  // Gegnerpositionen auswählen
  const availableCells = maze.filter(c =>
    !(c.i === 0 && c.j === 0) &&  // Startzelle
    !(c.i === cols - 1 && c.j === rows - 1) // Zielzelle
  );
  shuffleArray(availableCells);

  // Gegner erzeugen
  for (let n = 0; n < enemyCount; n++) {
    const cell = availableCells[n];
    const enemy = {
      i: cell.i,
      j: cell.j,
      last: null,
      element: document.createElement('div')
    };
    enemy.element.className = 'enemy';
    enemy.element.style.width = enemySize + 'px';
    enemy.element.style.height = enemySize + 'px';
    enemy.element.style.position = 'absolute';
    enemy.element.style.background = 'crimson';
    enemy.element.style.left = cell.i * cellSize + 5 + 'px';
    enemy.element.style.top = cell.j * cellSize + 5 + 'px';
    game.appendChild(enemy.element);
    enemies.push(enemy);
  }

  // Distance Map für Gegner berechnen
  computeDistanceMap();
}

init();
