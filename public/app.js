/* ==========================================================================
   KLH Computer Vision AI Portal - Client Script
   Structured as modular namespaces for maintainability and scalability.
   ========================================================================== */

// --------------------------------------------------
// Namespace: AppConfig
// Manages global application state
// --------------------------------------------------
const AppConfig = {
  models: [],
  selectedModelId: 'auto',
  activeImageBase64: null, // Raw base64 string without mime prefix
  lastPredictions: [],
  cameraStream: null,
  
  // API endpoints (relative paths routed via firebase.json rewrites)
  endpoints: {
    models: '/api/models',
    detect: '/api/detect'
  }
};

// --------------------------------------------------
// Namespace: DetectionAPI
// Manages backend API requests
// --------------------------------------------------
const DetectionAPI = {
  async fetchModels() {
    try {
      const response = await fetch(AppConfig.endpoints.models);
      if (!response.ok) throw new Error('Failed to retrieve model configuration');
      const data = await response.json();
      AppConfig.models = data.models || [];
      return AppConfig.models;
    } catch (err) {
      console.error('DetectionAPI.fetchModels error:', err);
      throw err;
    }
  },

  async runDetection(imageBase64, modelId) {
    try {
      const response = await fetch(AppConfig.endpoints.detect, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, modelId })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server-side detection error occurred');
      }
      return await response.json();
    } catch (err) {
      console.error('DetectionAPI.runDetection error:', err);
      throw err;
    }
  }
};

// --------------------------------------------------
// Namespace: CameraController
// Controls webcam streams and captures frames
// --------------------------------------------------
const CameraController = {
  async start(videoElement) {
    if (AppConfig.cameraStream) {
      this.stop();
    }

    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      // First try rear camera
      AppConfig.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Rear camera requested but not available, falling back to default camera.', err);
      // Fallback to any camera
      AppConfig.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    videoElement.srcObject = AppConfig.cameraStream;
    await videoElement.play();
  },

  capture(videoElement) {
    if (!AppConfig.cameraStream || !videoElement.videoWidth) {
      throw new Error('Camera is not active or stream is not ready.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    // Flip horizontal if front camera is active (optional, but keep default standard draw)
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to jpeg base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return dataUrl;
  },

  stop() {
    if (AppConfig.cameraStream) {
      AppConfig.cameraStream.getTracks().forEach(track => track.stop());
      AppConfig.cameraStream = null;
    }
  }
};

// --------------------------------------------------
// Namespace: CanvasRenderer
// Handles drawing bounding boxes and labels on canvas
// --------------------------------------------------
const CanvasRenderer = {
  // Generates unique, stable HSL color based on class name
  getColorForClass(className) {
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 85%, 60%)`;
  },

  draw(canvas, image, predictions) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!image.clientWidth || !image.clientHeight || !predictions.length) return;

    // Rescale canvas overlay size to match current visual display dimensions of the image
    canvas.width = image.clientWidth;
    canvas.height = image.clientHeight;

    predictions.forEach(p => {
      if (p.x == null || p.y == null || p.width == null || p.height == null) return;

      // Predictions coordinates are normalized percentages (0.0 to 1.0)
      // Standardize coordinates relative to top-left of box
      const w = p.width * canvas.width;
      const h = p.height * canvas.height;
      const x = (p.x - p.width / 2) * canvas.width;
      const y = (p.y - p.height / 2) * canvas.height;

      const color = this.getColorForClass(p.class);

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.round(canvas.width / 240)); // responsive border thickness
      ctx.strokeRect(x, y, w, h);

      // Draw label background
      const labelText = `${p.class} (${(p.confidence * 100).toFixed(0)}%)`;
      ctx.font = `600 ${Math.max(12, Math.round(canvas.width / 50))}px Outfit, sans-serif`;
      
      const textMetrics = ctx.measureText(labelText);
      const textHeight = Math.max(14, Math.round(canvas.width / 40));
      const labelPadX = 8;
      const labelPadY = 4;

      ctx.fillStyle = color;
      // Position label above box if space permits, otherwise draw inside top-left
      const labelY = (y - textHeight > 0) ? y - textHeight - labelPadY * 2 : y;
      
      ctx.fillRect(
        x, 
        labelY, 
        textMetrics.width + labelPadX * 2, 
        textHeight + labelPadY * 2
      );

      // Draw text
      ctx.fillStyle = '#020208'; // contrast text
      ctx.fillText(
        labelText, 
        x + labelPadX, 
        labelY + textHeight + labelPadY - 2
      );
    });
  },

  clear(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};

// --------------------------------------------------
// Namespace: UIController
// Interacts with DOM, binds actions, handles states
// --------------------------------------------------
const UIController = {
  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadPortalConfiguration();
  },

  cacheElements() {
    this.elements = {
      modelSelect: document.getElementById('modelSelect'),
      modelDescription: document.getElementById('modelDescription'),
      tabUpload: document.getElementById('tabUpload'),
      tabCamera: document.getElementById('tabCamera'),
      fileSection: document.getElementById('fileSection'),
      cameraSection: document.getElementById('cameraSection'),
      dropzone: document.getElementById('dropzone'),
      imageInput: document.getElementById('imageInput'),
      detectButton: document.getElementById('detectButton'),
      btnText: document.querySelector('#detectButton .btn-text'),
      btnSpinner: document.querySelector('#detectButton .btn-spinner'),
      startWebcamBtn: document.getElementById('startWebcamBtn'),
      captureBtn: document.getElementById('captureBtn'),
      stopWebcamBtn: document.getElementById('stopWebcamBtn'),
      detectedModelBadge: document.getElementById('detectedModelBadge'),
      timingBadge: document.getElementById('timingBadge'),
      mediaContainer: document.getElementById('mediaContainer'),
      previewPlaceholder: document.getElementById('previewPlaceholder'),
      previewWrapper: document.getElementById('previewWrapper'),
      imagePreview: document.getElementById('imagePreview'),
      canvasOverlay: document.getElementById('canvasOverlay'),
      videoWrapper: document.getElementById('videoWrapper'),
      webcamVideo: document.getElementById('webcamVideo'),
      resultsContainer: document.getElementById('resultsContainer')
    };
  },

  bindEvents() {
    // Model Selector
    this.elements.modelSelect.addEventListener('change', (e) => {
      AppConfig.selectedModelId = e.target.value;
      this.updateModelDescription();
    });

    // Navigation tabs
    this.elements.tabUpload.addEventListener('click', () => this.switchSourceTab('upload'));
    this.elements.tabCamera.addEventListener('click', () => this.switchSourceTab('camera'));

    // File Dropzone Actions
    this.elements.dropzone.addEventListener('click', () => this.elements.imageInput.click());
    
    this.elements.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dropzone.classList.add('dragover');
    });

    this.elements.dropzone.addEventListener('dragleave', () => {
      this.elements.dropzone.classList.remove('dragover');
    });

    this.elements.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files?.[0];
      if (file) this.handleImageFile(file);
    });

    this.elements.imageInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleImageFile(file);
    });

    // Webcam Controls
    this.elements.startWebcamBtn.addEventListener('click', () => this.startWebcam());
    this.elements.captureBtn.addEventListener('click', () => this.capturePhoto());
    this.elements.stopWebcamBtn.addEventListener('click', () => this.stopWebcam());

    // Run Vision Trigger
    this.elements.detectButton.addEventListener('click', () => this.triggerAnalysis());

    // Canvas redraw on window resize
    window.addEventListener('resize', () => {
      if (AppConfig.activeImageBase64 && AppConfig.lastPredictions.length > 0) {
        CanvasRenderer.draw(
          this.elements.canvasOverlay,
          this.elements.imagePreview,
          AppConfig.lastPredictions
        );
      }
    });
  },

  async loadPortalConfiguration() {
    this.showModelSelectLoading(true);
    try {
      const models = await DetectionAPI.fetchModels();
      this.populateModelSelect(models);
      this.updateModelDescription();
      this.showModelSelectLoading(false);
    } catch (err) {
      this.showModelSelectLoading(false);
      this.elements.modelDescription.textContent = 'Failed to load model configurations.';
      this.elements.modelDescription.style.color = '#ef4444';
      this.showError('Unable to contact backend servers to load models. Try refreshing.');
    }
  },

  showModelSelectLoading(isLoading) {
    if (isLoading) {
      this.elements.modelSelect.disabled = true;
      this.elements.modelDescription.textContent = 'Loading CV configurations...';
    } else {
      this.elements.modelSelect.disabled = false;
    }
  },

  populateModelSelect(models) {
    // Keep 'auto' as first option
    const autoOption = this.elements.modelSelect.options[0];
    this.elements.modelSelect.innerHTML = '';
    this.elements.modelSelect.appendChild(autoOption);

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name} (${model.type.includes('roboflow') ? 'Roboflow' : 'Gemini AI'})`;
      this.elements.modelSelect.appendChild(option);
    });
  },

  updateModelDescription() {
    const activeId = AppConfig.selectedModelId;
    if (activeId === 'auto') {
      this.elements.modelDescription.textContent = '✨ Automatic Classifier: Evaluating image contents dynamically to select the best domain model (Farm Animals, Construction Safety, License Plates, etc.) using Gemini 1.5 Flash.';
      return;
    }

    const model = AppConfig.models.find(m => m.id === activeId);
    if (model) {
      this.elements.modelDescription.textContent = `${model.description} (Min confidence: ${(model.confidenceThreshold * 100).toFixed(0)}%)`;
    }
  },

  switchSourceTab(source) {
    if (source === 'upload') {
      this.elements.tabUpload.classList.add('active');
      this.elements.tabCamera.classList.remove('active');
      this.elements.fileSection.classList.add('active');
      this.elements.cameraSection.classList.remove('active');
      this.stopWebcam();
    } else {
      this.elements.tabUpload.classList.remove('active');
      this.elements.tabCamera.classList.add('active');
      this.elements.fileSection.classList.remove('active');
      this.elements.cameraSection.classList.add('active');
    }
  },

  handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      this.showError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fullBase64 = reader.result;
      AppConfig.activeImageBase64 = fullBase64.split(',')[1];
      
      this.elements.imagePreview.src = fullBase64;
      this.displayPreviewContainer('image');
      
      // Clear previous overlay and output breakdown
      CanvasRenderer.clear(this.elements.canvasOverlay);
      AppConfig.lastPredictions = [];
      this.elements.resultsContainer.innerHTML = '<p class="empty-results-text">Awaiting detection run...</p>';
      this.elements.timingBadge.style.display = 'none';
      this.elements.detectedModelBadge.style.display = 'none';
      
      this.elements.detectButton.disabled = false;
    };
    reader.readAsDataURL(file);
  },

  async startWebcam() {
    this.elements.startWebcamBtn.disabled = true;
    this.elements.startWebcamBtn.textContent = 'Initializing...';
    this.displayPreviewContainer('video');
    
    try {
      await CameraController.start(this.elements.webcamVideo);
      this.elements.startWebcamBtn.style.display = 'none';
      this.elements.stopWebcamBtn.style.display = 'inline-block';
      this.elements.captureBtn.disabled = false;
    } catch (err) {
      console.error(err);
      this.elements.startWebcamBtn.disabled = false;
      this.elements.startWebcamBtn.textContent = 'Turn On Camera';
      this.displayPreviewContainer('placeholder');
      this.showError('Failed to access camera. Verify browser permissions.');
    }
  },

  capturePhoto() {
    try {
      const dataUrl = CameraController.capture(this.elements.webcamVideo);
      AppConfig.activeImageBase64 = dataUrl.split(',')[1];
      
      this.elements.imagePreview.src = dataUrl;
      this.displayPreviewContainer('image');
      
      // Clear previous outputs
      CanvasRenderer.clear(this.elements.canvasOverlay);
      AppConfig.lastPredictions = [];
      this.elements.resultsContainer.innerHTML = '<p class="empty-results-text">Awaiting detection run...</p>';
      this.elements.timingBadge.style.display = 'none';
      this.elements.detectedModelBadge.style.display = 'none';
      
      this.elements.detectButton.disabled = false;
      
      // Release camera since we captured a frame
      this.stopWebcam();
    } catch (err) {
      console.error(err);
      this.showError('Webcam frame capture failed.');
    }
  },

  stopWebcam() {
    CameraController.stop();
    this.elements.startWebcamBtn.style.display = 'inline-block';
    this.elements.startWebcamBtn.disabled = false;
    this.elements.startWebcamBtn.textContent = 'Turn On Camera';
    this.elements.stopWebcamBtn.style.display = 'none';
    this.elements.captureBtn.disabled = true;
    
    if (!AppConfig.activeImageBase64) {
      this.displayPreviewContainer('placeholder');
    } else {
      this.displayPreviewContainer('image');
    }
  },

  displayPreviewContainer(mode) {
    if (mode === 'placeholder') {
      this.elements.previewPlaceholder.style.display = 'flex';
      this.elements.previewWrapper.style.display = 'none';
      this.elements.videoWrapper.style.display = 'none';
    } else if (mode === 'image') {
      this.elements.previewPlaceholder.style.display = 'none';
      this.elements.previewWrapper.style.display = 'flex';
      this.elements.videoWrapper.style.display = 'none';
    } else if (mode === 'video') {
      this.elements.previewPlaceholder.style.display = 'none';
      this.elements.previewWrapper.style.display = 'none';
      this.elements.videoWrapper.style.display = 'block';
    }
  },

  async triggerAnalysis() {
    if (!AppConfig.activeImageBase64) return;

    this.setLoadingState(true);
    const startTime = performance.now();

    try {
      const response = await DetectionAPI.runDetection(
        AppConfig.activeImageBase64,
        AppConfig.selectedModelId
      );

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      if (response.success) {
        AppConfig.lastPredictions = response.predictions || [];
        
        // Draw predictions on Canvas Overlay
        CanvasRenderer.draw(
          this.elements.canvasOverlay,
          this.elements.imagePreview,
          AppConfig.lastPredictions
        );

        // Display results metadata
        this.renderResults(AppConfig.lastPredictions, response.modelName);
        this.showTiming(duration);
        this.showModelBadge(response.modelName, response.autoClassified !== null);
      } else {
        throw new Error(response.error || 'Server-side failure');
      }
      this.setLoadingState(false);
    } catch (err) {
      console.error(err);
      this.setLoadingState(false);
      this.renderError(err.message || 'Error running detection pipelines.');
    }
  },

  setLoadingState(isLoading) {
    if (isLoading) {
      this.elements.detectButton.disabled = true;
      this.elements.btnText.textContent = 'Running Model Inference...';
      this.elements.btnSpinner.style.display = 'block';
      this.elements.resultsContainer.innerHTML = `
        <div class="status-msg loading">
          <div class="skeleton-bar"></div>
          <div class="skeleton-bar" style="width: 80%;"></div>
          <p>Processing neural pathways...</p>
        </div>
      `;
      CanvasRenderer.clear(this.elements.canvasOverlay);
    } else {
      this.elements.detectButton.disabled = false;
      this.elements.btnText.textContent = 'Run Vision Analysis';
      this.elements.btnSpinner.style.display = 'none';
    }
  },

  renderResults(predictions, modelName) {
    if (!predictions || predictions.length === 0) {
      this.elements.resultsContainer.innerHTML = `
        <div class="status-msg info">
          <p>No objects detected above the confidence threshold by the <strong>${modelName}</strong> engine.</p>
        </div>
      `;
      return;
    }

    const itemsHtml = predictions.map(p => {
      const scorePercentage = (p.confidence * 100).toFixed(0);
      const color = CanvasRenderer.getColorForClass(p.class);
      return `
        <li class="prediction-item">
          <div class="prediction-meta">
            <span class="prediction-label" style="color: ${color};">${p.class}</span>
            <span class="prediction-score" style="color: ${color};">${scorePercentage}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${scorePercentage}%; background: ${color};"></div>
          </div>
        </li>
      `;
    }).join('');

    this.elements.resultsContainer.innerHTML = `<ul class="results-list">${itemsHtml}</ul>`;
  },

  showTiming(seconds) {
    this.elements.timingBadge.style.display = 'inline-block';
    this.elements.timingBadge.textContent = `${seconds}s`;
  },

  showModelBadge(modelName, isAuto) {
    this.elements.detectedModelBadge.style.display = 'inline-block';
    this.elements.detectedModelBadge.textContent = isAuto ? `✨ Auto: ${modelName}` : modelName;
  },

  renderError(msg) {
    this.elements.resultsContainer.innerHTML = `
      <div class="status-msg error">
        <strong>Inference Failed</strong>
        <p>${msg}</p>
      </div>
    `;
    this.elements.timingBadge.style.display = 'none';
    this.elements.detectedModelBadge.style.display = 'none';
  },

  showError(msg) {
    alert(msg);
  }
};

// Start application
document.addEventListener('DOMContentLoaded', () => UIController.init());
