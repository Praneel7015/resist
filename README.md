# Resistance Checker

A clean web app to detect resistor color bands from a photo and compute the resistance value. Built with Flask, OpenCV, and a modern HTML/CSS/JS UI.

## Features
- Upload an image or capture via camera (if supported by the browser)
- Detects color bands using OpenCV and estimates resistance
- Displays a formatted value (Ω, kΩ, MΩ, GΩ) and the detected bands
- Two modes: Image Mode (camera/upload) and Manual Mode (band picker)
- Responsive UI for mobile and desktop

## Requirements
- Python 3.11+ (tested on Windows 10/11)
- A working camera (optional, for capture)

## Setup

### 1) Clone or open the project
Place the folder on your machine, then open a terminal in the project root.

### 2) Create a virtual environment
Windows PowerShell:
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3) Install dependencies
```
pip install -r requirements.txt
```

## Run
```
python app.py
```
The server will start on `http://127.0.0.1:5000` (also accessible via your local network address shown in the terminal).

## Usage
1. Open `http://127.0.0.1:5000` in your browser.
2. Choose a mode using the toggle at the top:
   - Image Mode: Click "Select Image" to upload a resistor photo, or "Use Camera" to capture, then press "Analyze".
   - Manual Mode: Pick band colors and multiplier to calculate resistance without an image.
3. Results show the formatted resistance value and any detected bands.

## Mobile
- The UI is mobile-friendly; canvas scales to the device width and redraws on orientation change/resizes.
- Camera uses the rear lens when available and prefers 1280×720.

## Notes & Tips
- Good lighting and focus improve band detection accuracy.
- Color thresholds for detection are defined in `resit.py` in `Colour_Range`. You can tune these for your camera/lighting.
- Supported image formats: `.jpg`, `.jpeg`, `.png`, `.webp`.

## Project Structure
```
app.py                 # Flask server with /, /health and /analyze
resit.py               # OpenCV band detection logic
requirements.txt       # Python dependencies
Dockerfile             # Container image
.dockerignore          # Docker build context prune
.gitignore             # VCS ignores
templates/index.html   # Frontend HTML
static/style.css       # UI styles
static/app.js          # Frontend logic (upload/camera/analyze + manual picker)
```

## Deploy

### Option A: Docker (any VM or container service)
```
docker build -t resistor-checker .
docker run -p 8080:8080 resistor-checker
```
Open `http://localhost:8080`. Health check endpoint: `/health`.

### Option B: AWS App Runner (from GitHub repo)
1. Push this project to a GitHub repository.
2. In AWS Console, open App Runner → Create service.
3. Source: Repository → connect your GitHub repo and branch.
4. Build type: Use Dockerfile in repo (default). No extra build commands needed.
5. Port: set to `8080` (Dockerfile exposes 8080; Waitress listens on `${PORT}`).
6. Health check path: `/health`.
7. Create service. App Runner will build and deploy on each push.

### Option C: Render.com (free tier friendly)
1. Push to GitHub.
2. Create a new Web Service → Connect repo.
3. Runtime: Docker → it detects the Dockerfile.
4. Set port to `8080`. Deploy.

### Option D: AWS Amplify (frontend) + App Runner/Render (backend)
Amplify Hosting excels at static sites. Use it for the UI and host the Python API elsewhere:
- Host the UI (contents of `templates`+`static`) with Amplify/any static host.
- Host the Flask API with App Runner or Render (using the provided Dockerfile).
- Point the UI to the remote API. In `static/app.js`, change the fetch calls from `fetch('/analyze', ...)` to:
```
fetch('https://your-api.example.com/analyze', { method: 'POST', body: fd })
```

## Production
For development, Flask’s built-in server is fine. For production, use a WSGI server like `waitress` (already used in Dockerfile):
```
waitress-serve --host=0.0.0.0 --port=8080 app:app
```

## License
MIT
