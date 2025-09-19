const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const cameraBtn = document.getElementById('cameraBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const preview = document.getElementById('preview');
const video = document.getElementById('video');
const result = document.getElementById('result');
const themeToggle = document.getElementById('themeToggle');

let stream = null;
let currentBlob = null;
let lastDrawnImage = null;

// Theme using html[data-theme]
(function initTheme(){
	const html = document.documentElement;
	const saved = localStorage.getItem('theme') || 'dark';
	html.dataset.theme = saved;
})();

themeToggle?.addEventListener('click', () => {
	const html = document.documentElement;
	const next = html.dataset.theme === 'light' ? 'dark' : 'light';
	html.dataset.theme = next;
	localStorage.setItem('theme', next);
});

function setResult(textHtml){
	result.innerHTML = textHtml;
	result.classList.remove('hidden');
}

function hideResult(){
	result.classList.add('hidden');
	result.innerHTML = '';
}

function drawToCanvas(img){
	lastDrawnImage = img;
	const ctx = preview.getContext('2d');
	const dpr = window.devicePixelRatio || 1;
	const containerWidth = preview.parentElement.clientWidth;
	const maxW = Math.min(900, containerWidth);
	const scale = Math.min(1, maxW / img.width);
	const cssW = Math.round(img.width * scale);
	const cssH = Math.round(img.height * scale);
	preview.style.width = cssW + 'px';
	preview.style.height = cssH + 'px';
	preview.width = Math.round(cssW * dpr);
	preview.height = Math.round(cssH * dpr);
	const ctxScale = 1;
	preview.getContext('2d').setTransform(ctxScale, 0, 0, ctxScale, 0, 0);
	ctx.clearRect(0,0,cssW,cssH);
	ctx.drawImage(img, 0, 0, cssW, cssH);
}

window.addEventListener('resize', () => {
	if(lastDrawnImage){
		drawToCanvas(lastDrawnImage);
	}
});

function enableAnalyze(enable){
	analyzeBtn.disabled = !enable;
}

fileInput.addEventListener('change', async (e) => {
	hideResult();
	if(!fileInput.files || !fileInput.files[0]) return;
	const file = fileInput.files[0];
	currentBlob = file;
	const img = new Image();
	img.onload = () => drawToCanvas(img);
	img.src = URL.createObjectURL(file);
	enableAnalyze(true);
});

// Select Image opens file picker and stops camera if active
selectBtn?.addEventListener('click', () => {
	if(stream){
		stopCamera();
		showCanvas();
	}
	fileInput.click();
});

// Mode toggle
const imageModeBtn = document.getElementById('imageModeBtn');
const manualModeBtn = document.getElementById('manualModeBtn');
const imageMode = document.getElementById('imageMode');
const manualMode = document.getElementById('manualMode');

function stopCamera(){
	if(stream){
		video.classList.add('hidden');
		video.pause();
		stream.getTracks().forEach(t => t.stop());
		stream = null;
		cameraBtn.textContent = 'Use Camera';
	}
}

function setActiveModeButton(mode){
	imageModeBtn?.classList.toggle('is-active', mode==='image');
	manualModeBtn?.classList.toggle('is-active', mode==='manual');
	// Swap primary/secondary visuals for clarity
	if(mode==='image'){
		imageModeBtn?.classList.add('primary');
		imageModeBtn?.classList.remove('secondary');
		manualModeBtn?.classList.add('secondary');
		manualModeBtn?.classList.remove('primary');
	}else{
		manualModeBtn?.classList.add('primary');
		manualModeBtn?.classList.remove('secondary');
		imageModeBtn?.classList.add('secondary');
		imageModeBtn?.classList.remove('primary');
	}
}

// Initialize default mode active state
setActiveModeButton('image');

imageModeBtn?.addEventListener('click', () => {
	manualMode.classList.add('hidden');
	imageMode.classList.remove('hidden');
	setActiveModeButton('image');
	hideResult();
});

manualModeBtn?.addEventListener('click', () => {
	stopCamera();
	imageMode.classList.add('hidden');
	manualMode.classList.remove('hidden');
	setActiveModeButton('manual');
	hideResult();
});

// Ensure only one of video/canvas is visible
function showVideo(){
	preview.classList.add('hidden');
	video.classList.remove('hidden');
}
function showCanvas(){
	video.classList.add('hidden');
	preview.classList.remove('hidden');
}

// After starting camera
async function startCamera(){
	if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){
		throw new Error('getUserMedia not supported');
	}
	stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }}});
	video.srcObject = stream;
	await video.play();
	// Match preview canvas CSS size to video for clean layout
	video.classList.remove('hidden');
	preview.style.width = video.clientWidth + 'px';
	preview.style.height = video.clientHeight + 'px';
	showVideo();
	cameraBtn.textContent = 'Stop Camera';
}

// Override camera button handler to use helpers
cameraBtn.addEventListener('click', async () => {
	hideResult();
	enableAnalyze(false);
	if(stream){
		stopCamera();
		showCanvas();
		return;
	}
	try{
		await startCamera();
		setTimeout(() => {
			const off = document.createElement('canvas');
			off.width = video.videoWidth; off.height = video.videoHeight;
			const c = off.getContext('2d');
			c.drawImage(video, 0, 0);
			off.toBlob(b => { currentBlob = b; enableAnalyze(true); }, 'image/jpeg', 0.9);
		}, 600);
	}catch(err){
		setResult(`<span class="badge"><span class="dot" style="background: var(--danger)"></span> Camera error: ${err}</span>`);
		fileInput.removeAttribute('hidden');
		fileInput.click();
	}
});

analyzeBtn.addEventListener('click', async () => {
	if(!currentBlob){
		return;
	}
	analyzeBtn.disabled = true;
	setResult('<span class="badge"><span class="dot" style="background: var(--accent)"></span> Analyzing...</span>');

	try{
		const fd = new FormData();
		fd.append('image', currentBlob, 'image.jpg');
		const res = await fetch('/analyze', { method: 'POST', body: fd });
		const data = await res.json();
		if(!res.ok){
			throw new Error(data.error || 'Analysis failed');
		}

		let content = '';
		if(data.value_ohms != null){
			const {value, unit} = formatOhms(data.value_ohms);
			content += `<div class="badge"><span class="dot" style="background: var(--accent-2)"></span> <strong>${value} ${unit}</strong></div>`;
		}
		if(data.bands && data.bands.length){
			content += '<div style="margin-top:10px">Detected bands: ' + data.bands.map(b => `${b.color} (${b.digit})`).join(', ') + '</div>';
		}
		setResult(content || 'No bands detected. Try another image.');
	} catch(err){
		setResult(`<span class="badge"><span class="dot" style="background: var(--danger)"></span> ${err.message}</span>`);
	} finally {
		analyzeBtn.disabled = false;
	}
});

function formatOhms(v){
	const units = ["Ω","kΩ","MΩ","GΩ"];
	let i=0;
	while(v >= 1000 && i < units.length - 1){ v /= 1000; i++; }
	const value = (Math.round(v*100)/100).toLocaleString();
	return { value, unit: units[i] };
}

// Manual band picker (revamp-ready)
const manualControls = document.getElementById('manualControls');
const colorMap = [
	{ name: 'BLACK', digit: 0 },
	{ name: 'BROWN', digit: 1 },
	{ name: 'RED', digit: 2 },
	{ name: 'ORANGE', digit: 3 },
	{ name: 'YELLOW', digit: 4 },
	{ name: 'GREEN', digit: 5 },
	{ name: 'BLUE', digit: 6 },
	{ name: 'VIOLET', digit: 7 },
	{ name: 'GRAY', digit: 8 },
	{ name: 'WHITE', digit: 9 },
];
const multMap = [
	{ label: '×10^0 (BLACK)', pow: 0 },
	{ label: '×10^1 (BROWN)', pow: 1 },
	{ label: '×10^2 (RED)', pow: 2 },
	{ label: '×10^3 (ORANGE)', pow: 3 },
	{ label: '×10^4 (YELLOW)', pow: 4 },
	{ label: '×10^5 (GREEN)', pow: 5 },
	{ label: '×10^6 (BLUE)', pow: 6 },
	{ label: '×10^7 (VIOLET)', pow: 7 },
	{ label: '×10^8 (GRAY)', pow: 8 },
	{ label: '×10^9 (WHITE)', pow: 9 },
	{ label: '×10^-1 (GOLD)', pow: -1 },
	{ label: '×10^-2 (SILVER)', pow: -2 },
];
const tolMap = [
	{ label: '±1% (BROWN)', pct: 1 },
	{ label: '±2% (RED)', pct: 2 },
	{ label: '±0.5% (GREEN)', pct: 0.5 },
	{ label: '±0.25% (BLUE)', pct: 0.25 },
	{ label: '±0.1% (VIOLET)', pct: 0.1 },
	{ label: '±0.05% (ORANGE)', pct: 0.05 },
	{ label: '±5% (GOLD)', pct: 5 },
	{ label: '±10% (SILVER)', pct: 10 },
	{ label: '±20% (NONE)', pct: 20 },
];
const tempcoMap = [
	{ label: '250 ppm/K (BLACK)', ppm: 250 },
	{ label: '100 ppm/K (BROWN)', ppm: 100 },
	{ label: '50 ppm/K (RED)', ppm: 50 },
	{ label: '15 ppm/K (ORANGE)', ppm: 15 },
	{ label: '25 ppm/K (YELLOW)', ppm: 25 },
	{ label: '20 ppm/K (GREEN)', ppm: 20 },
	{ label: '10 ppm/K (BLUE)', ppm: 10 },
	{ label: '5 ppm/K (VIOLET)', ppm: 5 },
	{ label: '1 ppm/K (GREY)', ppm: 1 },
];

// Build manual calculator with chips
(function initManualChips(){
	const dColors = [
		{key:'black', label:'black', val:0},
		{key:'brown', label:'brown', val:1},
		{key:'red', label:'red', val:2},
		{key:'orange', label:'orange', val:3},
		{key:'yellow', label:'yellow', val:4},
		{key:'green', label:'green', val:5},
		{key:'blue', label:'blue', val:6},
		{key:'violet', label:'violet', val:7},
		{key:'grey', label:'grey', val:8},
		{key:'white', label:'white', val:9},
	];
	const mulColors = [
		...dColors.map(c=>({key:c.key, label:c.label, pow:c.val})),
		{key:'gold', label:'gold', pow:-1},
		{key:'silver', label:'silver', pow:-2},
	];
	const tolColors = [
		{key:'brown', label:'brown', pct:1},
		{key:'red', label:'red', pct:2},
		{key:'green', label:'green', pct:0.5},
		{key:'blue', label:'blue', pct:0.25},
		{key:'violet', label:'violet', pct:0.1},
		{key:'orange', label:'orange', pct:0.05},
		{key:'gold', label:'gold', pct:5},
		{key:'silver', label:'silver', pct:10},
		{key:'none', label:'none', pct:20},
	];
	const tempColors = [
		{key:'black', label:'black', ppm:250},
		{key:'brown', label:'brown', ppm:100},
		{key:'red', label:'red', ppm:50},
		{key:'orange', label:'orange', ppm:15},
		{key:'yellow', label:'yellow', ppm:25},
		{key:'green', label:'green', ppm:20},
		{key:'blue', label:'blue', ppm:10},
		{key:'violet', label:'violet', ppm:5},
		{key:'grey', label:'grey', ppm:1},
	];
	function renderChips(containerId, name, items, swatchField){
		const group = document.getElementById(containerId);
		if(!group) return;
		group.innerHTML = '';
		items.forEach((item, idx) => {
			const label = document.createElement('label');
			label.className = 'chip';
			const input = document.createElement('input');
			input.type = 'radio'; input.name = name; input.value = String(item[swatchField]);
			if(idx===0) input.checked = true;
			const sw = document.createElement('span'); sw.className = 'swatch swatch-' + item.key;
			const txt = document.createElement('span'); txt.textContent = item.label;
			label.appendChild(input); label.appendChild(sw); label.appendChild(txt);
			group.appendChild(label);
		});
	}
	function updateVisibilityByBands(){
		const n = parseInt(document.getElementById('bandsSel').value, 10);
		document.getElementById('row-d3').style.display = (n >= 5) ? '' : 'none';
		document.getElementById('row-tol').style.display = (n >= 4) ? '' : 'none';
		document.getElementById('row-temp').style.display = (n >= 6) ? '' : 'none';
	}
	function getSelected(name){
		const el = document.querySelector(`input[name="${name}"]:checked`);
		return el ? el.value : null;
	}
	function calculateFromChips(){
		const n = parseInt(document.getElementById('bandsSel').value, 10);
		const d1 = parseInt(getSelected('d1'), 10);
		const d2 = parseInt(getSelected('d2'), 10);
		const d3 = parseInt(getSelected('d3') || '0', 10);
		const mul = parseInt(getSelected('mul'), 10);
		const tol = getSelected('tol');
		const temp = getSelected('temp');
		let digits = '';
		if(n === 3 || n === 4){ digits = `${d1}${d2}`; }
		if(n === 5 || n === 6){ digits = `${d1}${d2}${d3}`; }
		const ohms = Number(digits) * Math.pow(10, mul);
		const { value, unit } = formatOhms(ohms);
		let extra = '';
		if(n >= 4 && tol != null){ extra += `, tolerance ${tol}%`; }
		if(n >= 6 && temp != null){ extra += `, tempco ${temp} ppm/K`; }
		setResult(`<div class="badge"><span class="dot" style="background: var(--accent-2)"></span> <strong>${value} ${unit}</strong></div><div class="muted" style="margin-top:8px">${n}-band${extra}</div>`);
	}
	// initial render
	renderChips('chips-d1', 'd1', dColors, 'val');
	renderChips('chips-d2', 'd2', dColors, 'val');
	renderChips('chips-d3', 'd3', dColors, 'val');
	renderChips('chips-mul', 'mul', mulColors, 'pow');
	renderChips('chips-tol', 'tol', tolColors, 'pct');
	renderChips('chips-temp', 'temp', tempColors, 'ppm');
	updateVisibilityByBands();
	document.getElementById('bandsSel').addEventListener('change', updateVisibilityByBands);
	document.getElementById('manualCalc').addEventListener('click', calculateFromChips);
})();
