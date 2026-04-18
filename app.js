/* ── Cold Zero – app.js ─────────────────────────────────────────
 *  Client-side image processing using OpenCV.js
 *  Detects grid, green laser, red reticle → outputs 3 distances
 * ──────────────────────────────────────────────────────────────*/

let cvReady = false;
let loadedImage = null;

function onOpenCvReady() {
    cvReady = true;
    console.log('OpenCV.js loaded');
    document.getElementById('processBtn').disabled = !loadedImage;
}

// ── File upload handling ────────────────────────────────────────
const uploadArea = document.getElementById('uploadArea');
const fileInput  = document.getElementById('fileInput');
const preview    = document.getElementById('preview');
const processBtn = document.getElementById('processBtn');

fileInput.addEventListener('change', handleFile);
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#00d4ff'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#444'; });
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '#444';
    if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFile(); }
});

function handleFile() {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        uploadArea.querySelector('p').style.display = 'none';
        uploadArea.querySelector('.icon').style.display = 'none';
        uploadArea.classList.add('has-image');
        loadedImage = new Image();
        loadedImage.src = e.target.result;
        loadedImage.onload = () => { processBtn.disabled = !cvReady; };
    };
    reader.readAsDataURL(file);
}

processBtn.addEventListener('click', () => {
    if (!cvReady || !loadedImage) return;
    processImage();
});

// ── Image Processing Pipeline ───────────────────────────────────
function processImage() {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    loading.style.display = 'block';
    results.style.display = 'none';

    // Defer to allow UI update
    setTimeout(() => {
        try {
            const output = runPipeline(loadedImage);
            showResults(output);
            if (!output.error) drawAnnotations(output);
        } catch (err) {
            showResults({ error: 'Processing error: ' + err.message });
        }
        loading.style.display = 'none';
    }, 50);
}

function drawAnnotations(output) {
    const canvas = document.getElementById('annotatedCanvas');
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;
    canvas.style.display = 'block';
    document.getElementById('legend').style.display = 'block';
    const ctx = canvas.getContext('2d');
    ctx.drawImage(loadedImage, 0, 0);

    const r = Math.max(25, output.ppmm * 8); // circle radius scaled to image
    const blueDotR = Math.max(8, output.ppmm * 5); // 10mm diameter = 5mm radius

    // 1. Green circle around laser
    ctx.beginPath();
    ctx.arc(output.laser.x, output.laser.y, r, 0, 2 * Math.PI);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(3, output.ppmm * 0.5);
    ctx.stroke();

    // 2. Red circle around reticle
    ctx.beginPath();
    ctx.arc(output.reticle.x, output.reticle.y, r, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = Math.max(3, output.ppmm * 0.5);
    ctx.stroke();

    // 3. Blue dot at ideal reticle position (10mm diameter)
    ctx.beginPath();
    ctx.arc(output.ideal.x, output.ideal.y, blueDotR, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(51, 153, 255, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, output.ppmm * 0.3);
    ctx.stroke();

    // Labels
    const fontSize = Math.max(14, output.ppmm * 3);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = '#00ff00';
    ctx.fillText('Laser', output.laser.x + r + 5, output.laser.y - 5);
    ctx.fillStyle = '#ff0000';
    ctx.fillText('Reticle', output.reticle.x + r + 5, output.reticle.y - 5);
    ctx.fillStyle = '#3399ff';
    ctx.fillText('Ideal Laser', output.ideal.x + blueDotR + 5, output.ideal.y - 5);

    // 4. Grid scale indicators (one grid square length)
    const gridPx = output.ppmm * parseFloat(document.getElementById('cfgGridSpacing').value || 10);
    const lw = Math.max(2, output.ppmm * 0.4);

    // Horizontal bar along X axis (below laser, 1 grid square wide)
    const hBarY = output.laser.y + r + 20;
    const hBarX = output.laser.x - gridPx / 2;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(hBarX, hBarY);
    ctx.lineTo(hBarX + gridPx, hBarY);
    // end ticks
    ctx.moveTo(hBarX, hBarY - 6);
    ctx.lineTo(hBarX, hBarY + 6);
    ctx.moveTo(hBarX + gridPx, hBarY - 6);
    ctx.lineTo(hBarX + gridPx, hBarY + 6);
    ctx.stroke();
    // label
    ctx.fillStyle = '#ffff00';
    ctx.font = `bold ${Math.max(12, output.ppmm * 2.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${parseFloat(document.getElementById('cfgGridSpacing').value || 10)} mm`, hBarX + gridPx / 2, hBarY + fontSize + 4);

    // Vertical bar along Y axis (left of laser, 1 grid square tall)
    const vBarX = output.laser.x - r - 20;
    const vBarY = output.laser.y - gridPx / 2;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(vBarX, vBarY);
    ctx.lineTo(vBarX, vBarY + gridPx);
    // end ticks
    ctx.moveTo(vBarX - 6, vBarY);
    ctx.lineTo(vBarX + 6, vBarY);
    ctx.moveTo(vBarX - 6, vBarY + gridPx);
    ctx.lineTo(vBarX + 6, vBarY + gridPx);
    ctx.stroke();
    // label
    ctx.fillStyle = '#ffff00';
    ctx.save();
    ctx.translate(vBarX - fontSize - 2, vBarY + gridPx / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${parseFloat(document.getElementById('cfgGridSpacing').value || 10)} mm`, 0, 0);
    ctx.restore();
    ctx.textAlign = 'start';
}

function runPipeline(img) {
    const BORE_TO_RAIL  = parseFloat(document.getElementById('cfgBoreToRail').value)  || 25.4;
    const OPTIC_CENTER  = parseFloat(document.getElementById('cfgOpticCenter').value)  || 38.0;
    const GRID_SPACING  = parseFloat(document.getElementById('cfgGridSpacing').value)  || 10.0;

    // Load image into OpenCV Mat
    const canvas = document.getElementById('canvasOutput');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const src = cv.imread(canvas);

    try {
        // Convert to gray and HSV
        const gray = new cv.Mat();
        const hsv  = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        const hsv2 = new cv.Mat();
        cv.cvtColor(hsv, hsv2, cv.COLOR_RGB2HSV);
        hsv.delete();

        // 1. Grid detection
        const ppmm = detectGridScale(gray, GRID_SPACING);
        if (ppmm <= 0) {
            gray.delete(); hsv2.delete(); src.delete();
            return { error: 'Error: Grid not detected' };
        }

        // 2. Green laser centroid
        const laser = findCentroid(hsv2, [35, 50, 50], [85, 255, 255]);
        if (!laser) {
            gray.delete(); hsv2.delete(); src.delete();
            return { error: 'Error: Laser point not detected' };
        }

        // 3. Red reticle centroid (two HSV bands)
        const r1 = findCentroid(hsv2, [0, 50, 50], [10, 255, 255]);
        const r2 = findCentroid(hsv2, [170, 50, 50], [180, 255, 255]);
        let reticle = null;
        if (r1 && r2) {
            reticle = { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
        } else if (r1) {
            reticle = r1;
        } else if (r2) {
            reticle = r2;
        }
        if (!reticle) {
            gray.delete(); hsv2.delete(); src.delete();
            return { error: 'Error: Reticle not detected' };
        }

        // 4. Calculations
        const hob_mm  = BORE_TO_RAIL + OPTIC_CENTER;
        // Ideal laser position: directly below the reticle by HOB
        // (image Y grows downward, so + means below)
        const ideal_laser_x = reticle.x;
        const ideal_laser_y = reticle.y + (hob_mm * ppmm);

        const error_x = (laser.x - ideal_laser_x) / ppmm;
        const error_y = (laser.y - ideal_laser_y) / ppmm;
        const abs_y   = Math.abs(laser.y - reticle.y) / ppmm;

        gray.delete(); hsv2.delete(); src.delete();

        return {
            error_x: error_x,
            error_y: error_y,
            abs_y: abs_y,
            ppmm: ppmm,
            laser: laser,
            reticle: reticle,
            ideal: { x: ideal_laser_x, y: ideal_laser_y }
        };
    } catch (e) {
        src.delete();
        throw e;
    }
}

// ── Grid Scale Detection (Hough Lines) ──────────────────────────
function detectGridScale(gray, gridSpacingMm) {
    const blurred = new cv.Mat();
    const edges   = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5);
    cv.Canny(blurred, edges, 30, 100);

    // Try multiple thresholds to find grid lines
    let bestPpmm = 0;
    for (let threshold = 150; threshold >= 50; threshold -= 20) {
        const lines = new cv.Mat();
        cv.HoughLines(edges, lines, 1, Math.PI / 180, threshold);

        const hRho = [];
        const vRho = [];
        for (let i = 0; i < lines.rows; i++) {
            const rho   = Math.abs(lines.data32F[i * 2]);
            const theta = lines.data32F[i * 2 + 1];
            if (Math.abs(theta - Math.PI / 2) < Math.PI / 12) {
                hRho.push(rho);
            } else if (theta < Math.PI / 12 || theta > Math.PI - Math.PI / 12) {
                vRho.push(rho);
            }
        }
        lines.delete();

        // Need at least 3 lines in one direction to get reliable spacing
        if (hRho.length < 3 && vRho.length < 3) continue;

        const hg = medianGap(deduplicate(hRho, 5));
        const vg = medianGap(deduplicate(vRho, 5));

        let pixelGap = 0;
        if (hg > 5 && vg > 5) pixelGap = (hg + vg) / 2;
        else if (hg > 5) pixelGap = hg;
        else if (vg > 5) pixelGap = vg;

        if (pixelGap > 5) {
            bestPpmm = pixelGap / gridSpacingMm;
            console.log(`Grid detected: threshold=${threshold}, hLines=${hRho.length}, vLines=${vRho.length}, pixelGap=${pixelGap.toFixed(1)}, ppmm=${bestPpmm.toFixed(3)}`);
            break;
        }
    }

    blurred.delete(); edges.delete();
    return bestPpmm;
}

// Remove near-duplicate line positions (within minDist pixels)
function deduplicate(arr, minDist) {
    if (arr.length === 0) return arr;
    arr.sort((a, b) => a - b);
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] - result[result.length - 1] > minDist) {
            result.push(arr[i]);
        }
    }
    return result;
}

function medianGap(arr) {
    if (arr.length < 2) return 0;
    const gaps = [];
    for (let i = 1; i < arr.length; i++) gaps.push(arr[i] - arr[i - 1]);
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

// ── Color Centroid Detection ────────────────────────────────────
function findCentroid(hsv, lo, hi) {
    const mask = new cv.Mat();
    const low  = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(...lo, 0));
    const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(...hi, 0));
    cv.inRange(hsv, low, high, mask);
    low.delete(); high.delete();

    // Morphological cleanup
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    kernel.delete();

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    mask.delete(); hierarchy.delete();

    if (contours.size() === 0) {
        contours.delete();
        return null;
    }

    // Find largest contour
    let maxArea = 0, maxIdx = 0;
    for (let i = 0; i < contours.size(); i++) {
        const area = cv.contourArea(contours.get(i));
        if (area > maxArea) { maxArea = area; maxIdx = i; }
    }

    const moments = cv.moments(contours.get(maxIdx));
    contours.delete();

    if (moments.m00 < 1e-6) return null;
    return { x: moments.m10 / moments.m00, y: moments.m01 / moments.m00 };
}

// ── Display Results ─────────────────────────────────────────────
function showResults(output) {
    const results = document.getElementById('results');
    results.style.display = 'block';

    if (output.error) {
        results.className = 'error';
        results.innerHTML = `
            <div class="result-title error">⚠️ ${output.error}</div>
        `;
        return;
    }

    results.className = 'success';
    results.innerHTML = `
        <div class="result-title success">✅ Analysis Complete</div>
        <div class="result-row">
            <span class="result-label">Error X (Windage):</span>
            <span class="result-value">${output.error_x.toFixed(2)} mm</span>
        </div>
        <div class="result-row">
            <span class="result-label">Error Y (Elevation):</span>
            <span class="result-value">${output.error_y.toFixed(2)} mm</span>
        </div>
        <div class="result-row">
            <span class="result-label">Absolute Y Distance:</span>
            <span class="result-value">${output.abs_y.toFixed(2)} mm</span>
        </div>
        <div class="result-row" style="border-top: 1px solid #2a2a4a; margin-top: 10px; padding-top: 10px;">
            <span class="result-label">Scale (pixels/mm):</span>
            <span class="result-value">${output.ppmm.toFixed(3)}</span>
        </div>
        <div class="result-row">
            <span class="result-label">Laser position:</span>
            <span class="result-value">(${output.laser.x.toFixed(1)}, ${output.laser.y.toFixed(1)}) px</span>
        </div>
        <div class="result-row">
            <span class="result-label">Reticle position:</span>
            <span class="result-value">(${output.reticle.x.toFixed(1)}, ${output.reticle.y.toFixed(1)}) px</span>
        </div>
        <div class="result-row">
            <span class="result-label">Ideal laser position:</span>
            <span class="result-value">(${output.ideal.x.toFixed(1)}, ${output.ideal.y.toFixed(1)}) px</span>
        </div>
        <div class="result-row">
            <span class="result-label">Pixel distance (laser→reticle):</span>
            <span class="result-value">ΔX=${(output.laser.x - output.reticle.x).toFixed(1)}  ΔY=${(output.laser.y - output.reticle.y).toFixed(1)} px</span>
        </div>
    `;
}
