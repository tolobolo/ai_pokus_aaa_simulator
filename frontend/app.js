const API = "";

// The patient selected on page 0; used on pages 1 and 2.
let currentPatient = null;

// The image drawn on the canvas (HTMLImageElement).
let canvasImage = null;

// Points placed by the user: array of {x, y}, max length 2.
let userPoints = [];

// Metadata fetched from the backend when entering page 2.
// Contains x1/y1/x2/y2 (answer), element_spacing, dim_size, etc.
let currentMetadata = null;

// Whether the user has clicked "Show answer" on the current image.
let showingAnswer = false;

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
  currentMetadata = null;
  showingAnswer = false;

  // Fetch metadata (contains spacing and answer coordinates)
  const metaResponse = await fetch(`${API}/patients/${name}/metadata`);
  currentMetadata = await metaResponse.json();

  // Fetch and draw the image
  const image = new Image();
  image.src = `${API}/patients/${name}/image`;
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

// ---------------------------------------------------------------------------
// Distance calculation
// ---------------------------------------------------------------------------

// Returns the Euclidean distance between two canvas points converted to mm,
// using ElementSpacing from the metadata (mm per pixel).
// ElementSpacing is stored as a string like "0.217599 0.217599"; we use the
// first value (x-axis spacing).
function distanceMm(ax, ay, bx, by) {
  const distPx = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  const spacing = parseFloat(currentMetadata.element_spacing.split(" ")[0]);
  return (distPx * spacing).toFixed(1);
}

// ---------------------------------------------------------------------------
// Canvas fit and draw
// ---------------------------------------------------------------------------

// Set the canvas CSS dimensions to the largest size that fits its wrapper
// while preserving the image aspect ratio.
function fitCanvas() {
  if (!canvasImage) return;

  const canvas = document.getElementById("image-canvas");
  const wrapper = canvas.parentElement;

  const scale = Math.min(
    wrapper.clientWidth / canvasImage.naturalWidth,
    wrapper.clientHeight / canvasImage.naturalHeight,
  );

  canvas.style.width = Math.round(canvasImage.naturalWidth * scale) + "px";
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

  if (canvasImage) ctx.drawImage(canvasImage, 0, 0);

  // User's points and line in blue
  ctx.fillStyle = "#3a6df0";
  ctx.strokeStyle = "#3a6df0";
  ctx.lineWidth = 2;
  userPoints.forEach((p) => drawDot(ctx, p.x, p.y));
  if (userPoints.length === 2) drawLine(ctx, userPoints[0], userPoints[1]);

  // Answer points and line in red (only after "Show answer" is clicked)
  if (showingAnswer && currentMetadata) {
    ctx.fillStyle = "#e74c3c";
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    const a = { x: currentMetadata.x1, y: currentMetadata.y1 };
    const b = { x: currentMetadata.x2, y: currentMetadata.y2 };
    drawDot(ctx, a.x, a.y);
    drawDot(ctx, b.x, b.y);
    drawLine(ctx, a, b);
  }

  updateInstructions();
  updateDistanceDisplay();
}

function updateInstructions() {
  const el = document.getElementById("instructions");
  if (userPoints.length === 0) {
    el.textContent = "Click on the image to place point 1";
  } else if (userPoints.length === 1) {
    el.textContent = "Click on the image to place point 2";
  } else {
    el.textContent =
      "Both points placed — press Reset to start over, or click Show answer";
  }
}

function updateDistanceDisplay() {
  const display = document.getElementById("distance-display");
  const userLabel = document.getElementById("user-distance");
  const answerLabel = document.getElementById("answer-distance");

  const hasUserLine = userPoints.length === 2;

  if (!hasUserLine && !showingAnswer) {
    display.classList.add("hidden");
    return;
  }

  display.classList.remove("hidden");

  if (hasUserLine && currentMetadata) {
    const mm = distanceMm(
      userPoints[0].x,
      userPoints[0].y,
      userPoints[1].x,
      userPoints[1].y,
    );
    userLabel.textContent = `Your line: ${mm} mm`;
    userLabel.classList.remove("hidden");
  } else {
    userLabel.classList.add("hidden");
  }

  if (showingAnswer && currentMetadata) {
    const mm = distanceMm(
      currentMetadata.x1,
      currentMetadata.y1,
      currentMetadata.x2,
      currentMetadata.y2,
    );
    answerLabel.textContent = `Answer: ${mm} mm`;
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
  if (userPoints.length >= 2) return;

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
  showingAnswer = false;
  redraw();
});

document.getElementById("btn-show-answer").addEventListener("click", () => {
  // Metadata is already loaded — just reveal the answer
  showingAnswer = true;
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
