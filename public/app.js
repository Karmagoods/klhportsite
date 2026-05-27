const imageInput = document.getElementById("imageInput");
const detectButton = document.getElementById("detectButton");
const imagePreview = document.getElementById("imagePreview");
const resultsContainer = document.getElementById("resultsContainer");
const canvas = document.getElementById("canvasOverlay");
const ctx = canvas.getContext("2d");

const ENDPOINT = "https://us-central1-klhinnovation-6eac7.cloudfunctions.net/runFarmAnimalDetection";

let lastPredictions = [];

/* =========================
   Image preview
========================= */
imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imagePreview.style.display = "block";
    resultsContainer.innerHTML = "";

    imagePreview.onload = () => {
      canvas.width = imagePreview.clientWidth;
      canvas.height = imagePreview.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastPredictions = [];
    };
  };
  reader.readAsDataURL(file);
});

/* =========================
   Run detection
========================= */
detectButton.addEventListener("click", async () => {
  const file = imageInput.files?.[0];
  if (!file) {
    alert("Please select an image first.");
    return;
  }

  detectButton.disabled = true;
  detectButton.textContent = "Detecting…";
  resultsContainer.innerHTML = "<p>Analyzing image…</p>";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Image = reader.result.split(",")[1];

      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image }),
      });

      if (!response.ok) throw new Error("Detection failed");

      const data = await response.json();
      console.log("RAW RESPONSE:", data);

      lastPredictions = extractPredictions(data);
      drawPredictions(lastPredictions);

    } catch (err) {
      console.error(err);
      resultsContainer.innerHTML = `<p style="color:red">Detection failed<br/><small>${err.message}</small></p>`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastPredictions = [];
    } finally {
      detectButton.disabled = false;
      detectButton.textContent = "Run Detection";
    }
  };

  reader.readAsDataURL(file);
});

/* =========================
   Extract predictions
========================= */
function extractPredictions(data) {
  const output = data?.outputs?.[0] || {};
  let predictions = [];

  // First, try detection_predictions.predictions
  if (output.detection_predictions?.predictions) {
    predictions = output.detection_predictions.predictions;
  } else if (Array.isArray(output.predictions)) {
    predictions = output.predictions;
  } else if (Array.isArray(output.detection_results)) {
    predictions = output.detection_results;
  } else {
    const arr = Object.values(output).find(v => Array.isArray(v));
    if (arr) predictions = arr;
  }

  if (!Array.isArray(predictions)) predictions = [];

  // Show results list
  if (predictions.length === 0) {
    resultsContainer.innerHTML = "<p>No objects detected.</p>";
  } else {
    const list = predictions
      .map(p => {
        const label = p.class || p.label || "Unknown";
        const confidence = (p.confidence ?? 0) * 100;
        return `<li>${label} — ${confidence.toFixed(1)}%</li>`;
      })
      .join("");
    resultsContainer.innerHTML = `<h2>Detection Results</h2><ul>${list}</ul>`;
  }

  return predictions;
}

/* =========================
   Draw predictions
========================= */
function drawPredictions(predictions) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!imagePreview.clientWidth || !imagePreview.clientHeight) return;

  const scaleX = canvas.width / imagePreview.naturalWidth;
  const scaleY = canvas.height / imagePreview.naturalHeight;

  predictions.forEach(p => {
    if (p.x != null && p.y != null && p.width != null && p.height != null) {
      const x = (p.x - p.width / 2) * scaleX;
      const y = (p.y - p.height / 2) * scaleY;
      const w = p.width * scaleX;
      const h = p.height * scaleY;

      ctx.strokeStyle = "lime";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = "lime";
      ctx.font = "16px Arial";
      ctx.fillText(
        `${p.class || p.label || "Unknown"} (${((p.confidence ?? 0) * 100).toFixed(1)}%)`,
        x,
        y - 6
      );
    }
  });
}

/* =========================
   Redraw on resize
========================= */
window.addEventListener("resize", () => {
  if (imagePreview.src && lastPredictions.length > 0) {
    canvas.width = imagePreview.clientWidth;
    canvas.height = imagePreview.clientHeight;
    drawPredictions(lastPredictions);
  }
});
