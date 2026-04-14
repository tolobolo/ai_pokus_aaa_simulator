const API = "";

// The patient selected on page 0; used on pages 1 and 2.
let currentPatient = null;

// The image drawn on the canvas (HTMLImageElement).
let canvasImage = null;

// Points placed by the user: array of {x, y}, max length 2.
let userPoints = [];

// Answer points fetched from the backend, or null if not yet loaded.
let answerPoints = null;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function showPage(number) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${number}`).classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Page 0 — patient list
// ---------------------------------------------------------------------------

async function loadPatients() {
  const response = await fetch(`${API}/patients`);
  const data = await response.json();
  const list = document.getElementById("patient-list");
  const empty = document.getElementById("no-patients");

  list.innerHTML = "";

  if (data.patients.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  data.patients.forEach((name) => {
    const item = document.createElement("li");
    item.textContent = name;
    item.addEventListener("click", () => selectPatient(name));
    list.appendChild(item);
  });
}

function selectPatient(name) {
  currentPatient = name;
  loadVideo(name);
  showPage(1);
}

// ---------------------------------------------------------------------------
// Page 1 — video
// ---------------------------------------------------------------------------

function loadVideo(name) {
  document.getElementById("video-title").textContent = name;

  const video = document.getElementById("video-player");
  video.src = `${API}/patients/${name}/video`;
  video.load();
}

// ---------------------------------------------------------------------------
// Page 2 — image with point selection
// ---------------------------------------------------------------------------

async function loadImagePage(name) {
  document.getElementById("image-title").textContent = name;

  // Reset state from any previous patient
  userPoints = [];
  answerPoints = null;

  // Fetch the image and draw it on the canvas
  const url = `${API}/patients/${name}/image`;
  const image = new Image();
  image.src = url;
  image.onload = () => {
    canvasImage = image;
    const canvas = document.getElementById("image-canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    redraw();
  };

  showPage(2);
}

// Redraw everything: image, user points/line, and optionally the answer line.
function redraw() {
  const canvas = document.getElementById("image-canvas");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the background image
  if (canvasImage) {
    ctx.drawImage(canvasImage, 0, 0);
  }

  // Draw the user's points and line in blue
  ctx.fillStyle = "#3a6df0";
  ctx.strokeStyle = "#3a6df0";
  ctx.lineWidth = 2;
  userPoints.forEach((p) => drawDot(ctx, p.x, p.y));
  if (userPoints.length === 2) {
    drawLine(ctx, userPoints[0], userPoints[1]);
  }

  // Draw the answer points and line in red (if "Show answer" was clicked)
  if (answerPoints) {
    const p1 = { x: answerPoints.p1[0], y: answerPoints.p1[1] };
    const p2 = { x: answerPoints.p2[0], y: answerPoints.p2[1] };
    ctx.fillStyle = "#e74c3c";
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    drawDot(ctx, p1.x, p1.y);
    drawDot(ctx, p2.x, p2.y);
    drawLine(ctx, p1, p2);
  }
}

function drawDot(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawLine(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

// Handle clicks on the canvas: place up to two points.
document.getElementById("image-canvas").addEventListener("click", (event) => {
  if (userPoints.length >= 2) return; // already have two points

  const canvas = document.getElementById("image-canvas");
  const rect = canvas.getBoundingClientRect();

  // Convert screen coordinates to canvas coordinates (handles CSS scaling)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  userPoints.push({ x, y });
  redraw();
});

// ---------------------------------------------------------------------------
// Button handlers
// ---------------------------------------------------------------------------

document.getElementById("btn-to-image").addEventListener("click", () => {
  loadImagePage(currentPatient);
});

document.getElementById("btn-reset").addEventListener("click", () => {
  userPoints = [];
  answerPoints = null;
  redraw();
});

document.getElementById("btn-show-answer").addEventListener("click", async () => {
  const response = await fetch(`${API}/patients/${currentPatient}/answer`);
  answerPoints = await response.json();
  redraw();
});

document.getElementById("btn-next-patient").addEventListener("click", () => {
  currentPatient = null;
  loadPatients();
  showPage(0);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

loadPatients();
