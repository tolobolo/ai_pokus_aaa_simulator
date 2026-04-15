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
    fitCanvas();
    redraw();
  };

  showPage(2);
}

// Returns Euclidean distance between two points as a percentage of the
// image diagonal (= the longest possible line in the image, i.e. 100%).
function distancePct(ax, ay, bx, by) {
  const dist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  return ((dist / canvasImage.naturalWidth) * 100).toFixed(1);
}

// Set the canvas CSS dimensions to the largest size that fits its wrapper
// while preserving the image aspect ratio.
// The canvas pixel coordinate system (canvas.width/height) stays at the
// image's natural dimensions, so the click scaling math stays correct.
function fitCanvas() {
  if (!canvasImage) return;

  const canvas = document.getElementById("image-canvas");
  const wrapper = canvas.parentElement;

  const wrapperW = wrapper.clientWidth;
  const wrapperH = wrapper.clientHeight;

  // How much do we need to scale down to fit inside the wrapper?
  const scale = Math.min(wrapperW / canvasImage.naturalWidth,
                         wrapperH / canvasImage.naturalHeight);

  canvas.style.width  = Math.round(canvasImage.naturalWidth  * scale) + "px";
  canvas.style.height = Math.round(canvasImage.naturalHeight * scale) + "px";
}

// Re-fit the canvas whenever the window is resized
window.addEventListener("resize", () => {
  fitCanvas();
  redraw();
});

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
    const p1 = { x: answerPoints.x1, y: answerPoints.y1 };
    const p2 = { x: answerPoints.x2, y: answerPoints.y2 };
    ctx.fillStyle = "#e74c3c";
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    drawDot(ctx, p1.x, p1.y);
    drawDot(ctx, p2.x, p2.y);
    drawLine(ctx, p1, p2);
  }

  // Update distance labels below the canvas
  updateDistanceDisplay();
}

function updateDistanceDisplay() {
  const display = document.getElementById("distance-display");
  const userLabel = document.getElementById("user-distance");
  const answerLabel = document.getElementById("answer-distance");

  const hasUserLine = userPoints.length === 2;
  const hasAnswer = answerPoints !== null;

  if (!hasUserLine && !hasAnswer) {
    display.classList.add("hidden");
    return;
  }

  display.classList.remove("hidden");

  if (hasUserLine) {
    const pct = distancePct(userPoints[0].x, userPoints[0].y, userPoints[1].x, userPoints[1].y);
    userLabel.textContent = `Your line: ${pct}%`;
    userLabel.classList.remove("hidden");
  } else {
    userLabel.classList.add("hidden");
  }

  if (hasAnswer) {
    const pct = distancePct(answerPoints.x1, answerPoints.y1, answerPoints.x2, answerPoints.y2);
    answerLabel.textContent = `Answer: ${pct}%`;
    answerLabel.classList.remove("hidden");
  } else {
    answerLabel.classList.add("hidden");
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
  const response = await fetch(`${API}/patients/${currentPatient}/metadata`);
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
