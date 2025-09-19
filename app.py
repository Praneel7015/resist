from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import os
import io
from PIL import Image
import numpy as np
import cv2 as cv

from resit import findBands, Config

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB
app.config['UPLOAD_EXTENSIONS'] = ['.jpg', '.jpeg', '.png', '.webp']
app.config['UPLOAD_PATH'] = 'uploads'

os.makedirs(app.config['UPLOAD_PATH'], exist_ok=True)


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
	if image.mode not in ("RGB", "RGBA"):
		image = image.convert("RGB")
	arr = np.array(image)
	if arr.shape[-1] == 4:
		arr = arr[:, :, :3]
	return cv.cvtColor(arr, cv.COLOR_RGB2BGR)


@app.get('/health')
def health():
	return jsonify({"status": "ok"})


@app.route('/')
def index():
	return render_template('index.html')


@app.post('/analyze')
def analyze():
	if 'image' not in request.files:
		return jsonify({"error": "No image uploaded"}), 400

	file = request.files['image']
	filename = secure_filename(file.filename or 'upload.png')
	ext = os.path.splitext(filename)[1].lower()
	if ext not in app.config['UPLOAD_EXTENSIONS']:
		return jsonify({"error": "Unsupported file type"}), 400

	try:
		data = file.read()
		image = Image.open(io.BytesIO(data))
		bgr = _pil_to_bgr(image)
		cfg = Config(debug=False)
		bands = findBands(bgr, cfg=cfg)
	except Exception as e:
		return jsonify({"error": f"Failed to process image: {e}"}), 500

	# Compute resistance from bands if possible
	value_ohms = None
	band_list = []
	if len(bands) in (3, 4, 5):
		digits = ''.join(str(b[3]) for b in bands[:-1])
		try:
			value_ohms = int(digits) * (10 ** bands[-1][3])
		except Exception:
			value_ohms = None
	for b in bands:
		band_list.append({
			"x": int(b[0]),
			"y": int(b[1]),
			"color": b[2],
			"digit": int(b[3])
		})

	return jsonify({
		"bands": band_list,
		"value_ohms": value_ohms
	})


if __name__ == '__main__':
	app.run(host='0.0.0.0', port=5000, debug=True)
