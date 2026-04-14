# App Overview

A web application with a backend and a frontend.
The app lets a user select a patient, watch a video, then mark two points on an image and compare their answer to the correct answer.

# Notes for the Agent
- Simple program — no need to scale up
- Code should be readable and understandable to beginners


# Backend
  - Serves the frontend static files from `../frontend/` at `/`                                                                                                                             
      so only one server needs to run (`cargo run` in `backend/`)  
  
- Written in Rust using Actix-web
- Data is stored in a `data/` folder, with one subfolder per patient: `data/<patient_name>/`
- Each patient folder contains:
  - `video.mp4` — a video file
  - `image.png` — an image file
  - `answer.json` — the correct answer (coordinates of two points)

## API Endpoints

- `GET /patients` → returns a list of patient names
- `GET /patients/<patient_name>/video` → returns the video file
- `GET /patients/<patient_name>/image` → returns the image file
- `GET /patients/<patient_name>/answer` → returns the coordinates of two points as JSON, e.g. `{ "p1": [x, y], "p2": [x, y] }`

# Frontend

- Written in plain HTML, CSS, and JavaScript
- Calls the backend API

## Page 0 — Patient List
- Shows a list of all patients
- Clicking a patient name navigates to Page 1 for that patient

## Page 1 — Video
- Shows the patient's video
- A "Next" button navigates to Page 2

## Page 2 — Image and Answer
- Shows the patient's image
- The user can click to place two points on the image; a line is drawn between them
- Buttons:
  - **Reset points** — removes the placed points and clears the drawn line
  - **Show answer** — calls the answer endpoint and draws the correct line in a different color
  - **Next patient** — goes back to Page 0
