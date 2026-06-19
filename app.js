const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const APP_TITLE = "Demostar Sensorium";
const PANEL_NAMES = new Set(["mission", "models", "signals", "result"]);
const FALLBACK_MODELS = [
  {
    id: "google/gemini-2.5-flash",
    name: "Google: Gemini 2.5 Flash",
    architecture: {
      input_modalities: ["text", "image", "audio"],
      output_modalities: ["text"]
    }
  },
  {
    id: "openai/gpt-audio-mini",
    name: "OpenAI: GPT Audio Mini",
    architecture: {
      input_modalities: ["text", "audio"],
      output_modalities: ["text", "audio"]
    }
  },
  {
    id: "mistralai/voxtral-small-24b-2507",
    name: "Mistral: Voxtral Small 24B 2507",
    architecture: {
      input_modalities: ["text", "audio"],
      output_modalities: ["text"]
    }
  }
];

const state = {
  apiKey: "",
  vlmModel: "google/gemini-2.5-flash",
  sttModel: "openai/whisper-1",
  audioModel: "google/gemini-2.5-flash",
  audioVoiceModel: "",
  mode: "guide",
  videoStream: null,
  audioStream: null,
  mediaRecorder: null,
  audioChunks: [],
  lastAudioBlob: null,
  lastAudioAt: 0,
  transcript: "",
  micLevel: 0,
  location: null,
  orientation: null,
  motion: null,
  battery: null,
  wakeLock: null,
  gestures: [],
  events: [],
  activePointers: new Map(),
  lastTapAt: 0,
  lastShakeAt: 0,
  busy: false,
  latestResult: "",
  latestAudioInsight: "",
  generatedVoiceUrl: "",
  modelCatalog: [],
  modelCatalogLoaded: false,
  activePanel: "mission",
  supported: {}
};

const els = {};

function bindElements() {
  [
    "cameraPreview",
    "snapshotCanvas",
    "cameraEmpty",
    "gestureSurface",
    "gestureReadout",
    "armBtn",
    "analyzeBtn",
    "recordBtn",
    "fullscreenBtn",
    "settingsBtn",
    "settingsPanel",
    "apiKeyInput",
    "vlmModelInput",
    "sttModelInput",
    "audioModelInput",
    "audioVoiceModelInput",
    "modelStatus",
    "clearKeyBtn",
    "missionInput",
    "sampleMissionBtn",
    "capabilityGrid",
    "busyDot",
    "locationMetric",
    "motionMetric",
    "micMetric",
    "gestureMetric",
    "eventLog",
    "clearEventsBtn",
    "resultBody",
    "speakBtn",
    "shareBtn",
    "copyBtn"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function detectSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.supported = {
    camera: !!navigator.mediaDevices?.getUserMedia,
    microphone: !!navigator.mediaDevices?.getUserMedia,
    geolocation: !!navigator.geolocation,
    motion: "DeviceMotionEvent" in window,
    orientation: "DeviceOrientationEvent" in window,
    vibration: "vibrate" in navigator,
    wakeLock: "wakeLock" in navigator,
    share: "share" in navigator,
    clipboard: !!navigator.clipboard?.writeText,
    speech: "speechSynthesis" in window,
    speechRecognition: !!SpeechRecognition,
    battery: "getBattery" in navigator,
    network: "connection" in navigator
  };
}

function restoreSettings() {
  state.apiKey = "";
  state.vlmModel = sessionStorage.getItem("openrouter-vlm-model") || state.vlmModel;
  state.sttModel = sessionStorage.getItem("openrouter-stt-model") || state.sttModel;
  state.audioModel = sessionStorage.getItem("openrouter-audio-model") || state.audioModel;
  state.audioVoiceModel = sessionStorage.getItem("openrouter-audio-voice-model") || state.audioVoiceModel;
  els.apiKeyInput.value = state.apiKey;
  els.vlmModelInput.value = state.vlmModel;
  els.sttModelInput.value = state.sttModel;
  els.audioModelInput.value = state.audioModel;
  els.audioVoiceModelInput.value = state.audioVoiceModel;
}

function wireEvents() {
  els.armBtn.addEventListener("click", primeSensors);
  els.analyzeBtn.addEventListener("click", runFusion);
  els.recordBtn.addEventListener("click", toggleRecording);
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);
  els.settingsBtn.addEventListener("click", () => {
    showPanel("models", true);
  });
  els.clearKeyBtn.addEventListener("click", () => {
    state.apiKey = "";
    els.apiKeyInput.value = "";
    addEvent("key", "OpenRouter key cleared");
    renderCapabilities();
  });
  els.apiKeyInput.addEventListener("input", (event) => {
    state.apiKey = event.target.value.trim();
    renderCapabilities();
  });
  els.vlmModelInput.addEventListener("change", (event) => {
    state.vlmModel = event.target.value.trim() || "google/gemini-2.5-flash";
    sessionStorage.setItem("openrouter-vlm-model", state.vlmModel);
    renderCapabilities();
  });
  els.sttModelInput.addEventListener("change", (event) => {
    state.sttModel = event.target.value.trim() || "openai/whisper-1";
    sessionStorage.setItem("openrouter-stt-model", state.sttModel);
    renderCapabilities();
  });
  els.audioModelInput.addEventListener("change", (event) => {
    state.audioModel = event.target.value.trim() || "google/gemini-2.5-flash";
    sessionStorage.setItem("openrouter-audio-model", state.audioModel);
    renderCapabilities();
  });
  els.audioVoiceModelInput.addEventListener("change", (event) => {
    state.audioVoiceModel = event.target.value.trim();
    if (state.audioVoiceModel) {
      sessionStorage.setItem("openrouter-audio-voice-model", state.audioVoiceModel);
    } else {
      sessionStorage.removeItem("openrouter-audio-voice-model");
    }
    renderCapabilities();
  });
  els.sampleMissionBtn.addEventListener("click", () => {
    els.missionInput.value = "Tell me what I can do next from exactly where I am, using what the phone sees, hears, feels, and where it is.";
  });
  document.querySelectorAll(".mode-chip").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode-chip").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.mode = button.dataset.mode;
      addEvent("mode", `Fusion mode set to ${state.mode}`);
    });
  });
  els.clearEventsBtn.addEventListener("click", () => {
    state.events = [];
    state.gestures = [];
    renderEvents();
    renderMetrics();
  });
  els.speakBtn.addEventListener("click", speakResult);
  els.shareBtn.addEventListener("click", shareResult);
  els.copyBtn.addEventListener("click", copyResult);
  wirePanelTabs();
  wireGestureSurface();
}

function wirePanelTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.panel, true));
  });
}

function showPanel(panelName, updateHash = false) {
  if (!PANEL_NAMES.has(panelName)) return;
  const target = document.querySelector(`.deck-panel[data-panel="${panelName}"]`);
  if (!target) return;
  state.activePanel = panelName;
  document.querySelectorAll(".deck-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === panelName);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    const isActive = button.dataset.panel === panelName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  if (updateHash) {
    history.replaceState(null, "", `#${panelName}`);
  }
}

async function loadOpenRouterModels() {
  setModelStatus("Loading OpenRouter model list...");
  try {
    const response = await fetch(`${OPENROUTER_BASE}/models?output_modalities=all&sort=most-popular`, {
      headers: {
        "Accept": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const payload = await response.json();
    const models = Array.isArray(payload.data) ? payload.data : [];
    if (!models.length) {
      throw new Error("OpenRouter returned no models");
    }
    state.modelCatalog = normalizeModels(models);
    state.modelCatalogLoaded = true;
    populateModelSelectors();
    setModelStatus(`${state.modelCatalog.length} OpenRouter models loaded`);
    addEvent("models", `${state.modelCatalog.length} OpenRouter models loaded`);
  } catch (error) {
    state.modelCatalog = normalizeModels(FALLBACK_MODELS);
    state.modelCatalogLoaded = false;
    populateModelSelectors();
    setModelStatus(`Using fallback model list: ${cleanError(error)}`);
    addEvent("models", "OpenRouter model list unavailable; using fallbacks");
  }
  renderCapabilities();
}

function normalizeModels(models) {
  const unique = new Map();
  models.forEach((model) => {
    if (!model?.id || unique.has(model.id)) return;
    unique.set(model.id, {
      ...model,
      name: model.name || model.id,
      architecture: {
        ...(model.architecture || {}),
        input_modalities: model.architecture?.input_modalities || [],
        output_modalities: model.architecture?.output_modalities || []
      }
    });
  });
  return [...unique.values()].sort((a, b) => modelLabel(a).localeCompare(modelLabel(b)));
}

function populateModelSelectors() {
  const visionModels = filterModels({
    inputAny: ["image"],
    outputAny: ["text"]
  });
  const speechModels = filterModels({
    inputAny: ["audio"],
    outputAny: ["text"]
  });
  const audioReasoningModels = filterModels({
    inputAny: ["audio"],
    outputAny: ["text"]
  });
  const audioReplyModels = filterModels({
    outputAny: ["audio"]
  });

  populateModelSelect(els.vlmModelInput, visionModels, state.vlmModel, {
    pinnedModels: [modelById(state.vlmModel), modelById("google/gemini-2.5-flash")]
  });
  populateModelSelect(els.sttModelInput, speechModels, state.sttModel, {
    pinnedModels: [
      {
        id: "openai/whisper-1",
        name: "OpenAI: Whisper 1",
        architecture: { input_modalities: ["audio"], output_modalities: ["text"] }
      },
      modelById(state.sttModel)
    ]
  });
  populateModelSelect(els.audioModelInput, audioReasoningModels, state.audioModel, {
    pinnedModels: [modelById(state.audioModel), modelById("google/gemini-2.5-flash")]
  });
  populateModelSelect(els.audioVoiceModelInput, audioReplyModels, state.audioVoiceModel, {
    emptyLabel: "Browser speech fallback",
    pinnedModels: [modelById(state.audioVoiceModel), modelById("openai/gpt-audio-mini")]
  });
}

function filterModels({ inputAny = [], outputAny = [] }) {
  return state.modelCatalog.filter((model) => {
    const inputs = model.architecture.input_modalities || [];
    const outputs = model.architecture.output_modalities || [];
    const inputMatches = !inputAny.length || inputAny.some((modality) => inputs.includes(modality));
    const outputMatches = !outputAny.length || outputAny.some((modality) => outputs.includes(modality));
    return inputMatches && outputMatches;
  });
}

function populateModelSelect(select, models, currentValue, options = {}) {
  const pinned = (options.pinnedModels || []).filter(Boolean);
  const merged = normalizeModels([...pinned, ...models]);
  const selectedValue = currentValue || "";
  const choices = [];

  if (options.emptyLabel) {
    choices.push(`<option value="">${escapeHtml(options.emptyLabel)}</option>`);
  }
  if (selectedValue && !merged.some((model) => model.id === selectedValue)) {
    choices.push(`<option value="${escapeHtml(selectedValue)}">${escapeHtml(selectedValue)} (custom)</option>`);
  }
  choices.push(...merged.map((model) => (
    `<option value="${escapeHtml(model.id)}">${escapeHtml(modelLabel(model))}</option>`
  )));

  select.innerHTML = choices.join("");
  select.value = selectedValue;
  if (selectedValue && select.value !== selectedValue) {
    select.value = "";
  }
}

function modelById(id) {
  if (!id) return null;
  return state.modelCatalog.find((model) => model.id === id)
    || FALLBACK_MODELS.find((model) => model.id === id)
    || null;
}

function modelLabel(model) {
  return `${model.name || model.id} - ${model.id}`;
}

function setModelStatus(text) {
  if (els.modelStatus) {
    els.modelStatus.textContent = text;
  }
}

function wireGestureSurface() {
  els.gestureSurface.addEventListener("pointerdown", (event) => {
    els.gestureSurface.setPointerCapture(event.pointerId);
    state.activePointers.set(event.pointerId, pointerSnapshot(event));
    if (state.activePointers.size === 2) {
      const pair = [...state.activePointers.values()];
      state.pinchStart = pointerPairMetrics(pair[0], pair[1]);
    }
    window.clearTimeout(event.longPressTimer);
    const pointerId = event.pointerId;
    const longPressTimer = window.setTimeout(() => {
      const pointer = state.activePointers.get(pointerId);
      if (pointer) {
        addGesture("long press", "held focus");
      }
    }, 650);
    const pointer = state.activePointers.get(pointerId);
    pointer.longPressTimer = longPressTimer;
  });

  els.gestureSurface.addEventListener("pointermove", (event) => {
    const pointer = state.activePointers.get(event.pointerId);
    if (!pointer) return;
    pointer.currentX = event.clientX;
    pointer.currentY = event.clientY;

    if (state.activePointers.size === 2 && state.pinchStart) {
      const pair = [...state.activePointers.values()];
      const metrics = pointerPairMetrics(pair[0], pair[1]);
      const scale = metrics.distance / Math.max(1, state.pinchStart.distance);
      const rotation = metrics.angle - state.pinchStart.angle;
      if (Math.abs(scale - 1) > 0.18) {
        addGesture(scale > 1 ? "pinch out" : "pinch in", `${scale.toFixed(2)}x`);
        state.pinchStart.distance = metrics.distance;
      }
      if (Math.abs(rotation) > 18) {
        addGesture(rotation > 0 ? "rotate right" : "rotate left", `${Math.round(rotation)} deg`);
        state.pinchStart.angle = metrics.angle;
      }
    }
  });

  ["pointerup", "pointercancel"].forEach((type) => {
    els.gestureSurface.addEventListener(type, (event) => {
      const pointer = state.activePointers.get(event.pointerId);
      if (!pointer) return;
      window.clearTimeout(pointer.longPressTimer);
      pointer.currentX = event.clientX;
      pointer.currentY = event.clientY;
      const dx = pointer.currentX - pointer.startX;
      const dy = pointer.currentY - pointer.startY;
      const distance = Math.hypot(dx, dy);
      const elapsed = performance.now() - pointer.startedAt;

      if (distance > 70 && elapsed < 850) {
        addGesture(`swipe ${swipeDirection(dx, dy)}`, `${Math.round(distance)} px`);
      } else if (elapsed < 300 && distance < 16) {
        const now = Date.now();
        const gesture = now - state.lastTapAt < 320 ? "double tap" : "tap";
        state.lastTapAt = now;
        addGesture(gesture, screenZone(event.clientX, event.clientY));
      }

      state.activePointers.delete(event.pointerId);
      if (state.activePointers.size < 2) {
        state.pinchStart = null;
      }
    });
  });
}

function pointerSnapshot(event) {
  return {
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    startedAt: performance.now(),
    longPressTimer: null
  };
}

function pointerPairMetrics(a, b) {
  const dx = b.currentX - a.currentX;
  const dy = b.currentY - a.currentY;
  return {
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx) * 180 / Math.PI
  };
}

function swipeDirection(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function screenZone(x, y) {
  const bounds = els.gestureSurface.getBoundingClientRect();
  const horizontal = x < bounds.left + bounds.width / 3 ? "left" : x > bounds.left + bounds.width * 2 / 3 ? "right" : "center";
  const vertical = y < bounds.top + bounds.height / 3 ? "top" : y > bounds.top + bounds.height * 2 / 3 ? "bottom" : "middle";
  return `${vertical} ${horizontal}`;
}

async function primeSensors() {
  setBusy(true);
  addEvent("prime", "Requesting phone sensors");
  await Promise.allSettled([
    startCamera(),
    startMicrophone(),
    startLocation(),
    startMotion(),
    startBattery(),
    keepAwake()
  ]);
  tryStartSpeechRecognition();
  setBusy(false);
  renderCapabilities();
  renderMetrics();
}

async function startCamera() {
  if (!state.supported.camera || state.videoStream) return;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });
  state.videoStream = stream;
  els.cameraPreview.srcObject = stream;
  await els.cameraPreview.play();
  els.cameraPreview.classList.add("ready");
  els.cameraEmpty.classList.add("hidden");
  addEvent("camera", "Rear camera stream active");
}

async function startMicrophone() {
  if (!state.supported.microphone || state.audioStream) return;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });
  state.audioStream = stream;
  connectMicMeter(stream);
  addEvent("mic", "Microphone stream active");
}

function connectMicMeter(stream) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const sum = data.reduce((total, value) => total + value, 0);
    state.micLevel = Math.round(sum / data.length);
    renderMetrics();
    requestAnimationFrame(tick);
  };
  tick();
}

async function startLocation() {
  if (!state.supported.geolocation || state.locationWatchId) return;
  state.locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      state.location = {
        latitude: round(position.coords.latitude, 5),
        longitude: round(position.coords.longitude, 5),
        accuracy: Math.round(position.coords.accuracy || 0),
        altitude: nullableRound(position.coords.altitude, 1),
        heading: nullableRound(position.coords.heading, 0),
        speed: nullableRound(position.coords.speed, 1),
        at: new Date(position.timestamp).toISOString()
      };
      renderMetrics();
      renderCapabilities();
    },
    (error) => addEvent("location", error.message || "Location unavailable"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
  );
  addEvent("location", "Location watch requested");
}

async function startMotion() {
  const motionPermission = await requestSensorPermission(window.DeviceMotionEvent);
  const orientationPermission = await requestSensorPermission(window.DeviceOrientationEvent);

  if (motionPermission) {
    window.addEventListener("devicemotion", (event) => {
      const source = event.accelerationIncludingGravity || event.acceleration;
      if (!source) return;
      const x = source.x || 0;
      const y = source.y || 0;
      const z = source.z || 0;
      const magnitude = Math.hypot(x, y, z);
      state.motion = {
        x: round(x, 2),
        y: round(y, 2),
        z: round(z, 2),
        magnitude: round(magnitude, 2),
        interval: nullableRound(event.interval, 0)
      };
      if (magnitude > 24 && Date.now() - state.lastShakeAt > 1200) {
        state.lastShakeAt = Date.now();
        addGesture("shake", `${round(magnitude, 1)} m/s2`);
      }
      renderMetrics();
    }, { passive: true });
    addEvent("motion", "Motion sensor active");
  }

  if (orientationPermission) {
    window.addEventListener("deviceorientation", (event) => {
      state.orientation = {
        alpha: nullableRound(event.alpha, 1),
        beta: nullableRound(event.beta, 1),
        gamma: nullableRound(event.gamma, 1),
        absolute: !!event.absolute
      };
      renderMetrics();
    }, { passive: true });
    addEvent("tilt", "Orientation sensor active");
  }
}

async function requestSensorPermission(sensorEvent) {
  if (!sensorEvent) return false;
  if (typeof sensorEvent.requestPermission === "function") {
    try {
      return await sensorEvent.requestPermission() === "granted";
    } catch (error) {
      addEvent("sensor", error.message || "Sensor permission blocked");
      return false;
    }
  }
  return true;
}

async function startBattery() {
  if (!state.supported.battery || state.battery) return;
  try {
    const battery = await navigator.getBattery();
    const update = () => {
      state.battery = {
        level: `${Math.round(battery.level * 100)}%`,
        charging: battery.charging
      };
      renderCapabilities();
    };
    battery.addEventListener("levelchange", update);
    battery.addEventListener("chargingchange", update);
    update();
  } catch (error) {
    addEvent("battery", error.message || "Battery unavailable");
  }
}

async function keepAwake() {
  if (!state.supported.wakeLock || state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    addEvent("screen", "Wake lock active");
  } catch (error) {
    addEvent("screen", error.message || "Wake lock unavailable");
  }
}

function tryStartSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || state.recognitionStarted) return;
  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const parts = [];
      for (let index = 0; index < event.results.length; index += 1) {
        parts.push(event.results[index][0].transcript);
      }
      state.transcript = parts.join(" ").trim();
      if (state.transcript) {
        els.micMetric.textContent = "Voice";
      }
    };
    recognition.onerror = (event) => addEvent("speech", event.error || "Speech recognition paused");
    recognition.onend = () => {
      if (state.recognitionStarted) {
        window.setTimeout(() => recognition.start(), 600);
      }
    };
    recognition.start();
    state.recognitionStarted = true;
    state.recognition = recognition;
    addEvent("speech", "Browser speech recognition active");
  } catch (error) {
    addEvent("speech", error.message || "Speech recognition unavailable");
  }
}

async function toggleRecording() {
  if (state.mediaRecorder?.state === "recording") {
    stopRecording();
    return;
  }
  await startRecording();
}

async function startRecording(autoStopMs = 7000) {
  if (!state.audioStream) {
    await startMicrophone();
  }
  if (!state.audioStream || !window.MediaRecorder) {
    addEvent("record", "MediaRecorder unavailable");
    return null;
  }
  state.audioChunks = [];
  const mimeType = preferredAudioMimeType();
  const options = mimeType ? { mimeType } : undefined;
  state.mediaRecorder = new MediaRecorder(state.audioStream, options);
  const completed = new Promise((resolve) => {
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.audioChunks.push(event.data);
    };
    state.mediaRecorder.onstop = () => {
      const type = state.audioChunks[0]?.type || mimeType || "audio/webm";
      state.lastAudioBlob = new Blob(state.audioChunks, { type });
      state.lastAudioAt = Date.now();
      els.recordBtn.textContent = "Record voice";
      addEvent("record", `${Math.round(state.lastAudioBlob.size / 1024)} KB voice clip captured`);
      renderMetrics();
      resolve(state.lastAudioBlob);
    };
  });
  state.mediaRecorder.start();
  els.recordBtn.textContent = "Stop voice";
  addEvent("record", "Recording voice clip");
  if (autoStopMs) {
    window.setTimeout(() => {
      if (state.mediaRecorder?.state === "recording") stopRecording();
    }, autoStopMs);
  }
  return completed;
}

function stopRecording() {
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
  }
}

function preferredAudioMimeType() {
  if (!window.MediaRecorder) return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function runFusion() {
  setBusy(true);
  addEvent("fusion", "Building multimodal context");
  pulseStage();
  vibrate([18, 22, 18]);

  try {
    if (!state.videoStream && state.supported.camera) {
      await startCamera();
    }
    const frame = captureFrame();
    let transcript = state.transcript;

    if (state.audioStream && (!state.lastAudioBlob || Date.now() - state.lastAudioAt > 30000)) {
      const clip = await startRecording(3200);
      if (clip) {
        state.lastAudioBlob = clip;
      }
    }

    let audioInsight = "";
    if (state.apiKey && state.lastAudioBlob) {
      try {
        const sttText = await transcribeAudio(state.lastAudioBlob);
        if (sttText) {
          transcript = sttText;
          state.transcript = sttText;
          addEvent("openrouter", "Speech transcribed");
        }
      } catch (error) {
        addEvent("stt", cleanError(error));
      }

      try {
        audioInsight = await analyzeAudioWithModel(state.lastAudioBlob, transcript);
        state.latestAudioInsight = audioInsight;
        if (audioInsight) {
          addEvent("audio model", "Raw audio analyzed");
        }
      } catch (error) {
        state.latestAudioInsight = "";
        addEvent("audio model", cleanError(error));
      }
    }

    const context = collectContext(transcript, !!frame, audioInsight);
    const result = state.apiKey
      ? await askOpenRouter(context, frame)
      : makeLocalFusion(context);

    state.latestResult = result;
    renderResult(result);
    showPanel("result", true);
    addEvent(state.apiKey ? "openrouter" : "local", "Field card ready");
    vibrate([25, 20, 25]);
  } catch (error) {
    const message = `Fusion failed: ${cleanError(error)}`;
    state.latestResult = message;
    renderResult(message);
    addEvent("error", cleanError(error));
  } finally {
    setBusy(false);
    renderCapabilities();
    renderMetrics();
  }
}

function captureFrame() {
  if (!state.videoStream || !els.cameraPreview.videoWidth) return "";
  const canvas = els.snapshotCanvas;
  const video = els.cameraPreview;
  const maxSide = 960;
  const scale = Math.min(maxSide / video.videoWidth, maxSide / video.videoHeight, 1);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  addEvent("camera", `${canvas.width}x${canvas.height} frame captured`);
  return canvas.toDataURL("image/jpeg", 0.78);
}

async function transcribeAudio(blob) {
  const base64 = await blobToBase64Payload(blob);
  const response = await openRouterFetch("/audio/transcriptions", {
    model: state.sttModel,
    input_audio: {
      data: base64,
      format: audioFormat(blob.type)
    }
  });
  return response.text || "";
}

async function analyzeAudioWithModel(blob, transcript) {
  if (!state.audioModel) return "";
  const base64 = await blobToBase64Payload(blob);
  const response = await openRouterFetch("/chat/completions", {
    model: state.audioModel,
    messages: [
      {
        role: "system",
        content: "You are an audio reasoning model for a phone demo. Analyze only the provided audio and safe metadata. Do not identify the speaker or infer protected traits. Return concise notes on speech intent, audible environment, urgency, uncertainty, and any phone-action implications."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Analyze this raw phone microphone clip as an audio modality, not just text.",
              `Browser transcript if available: ${transcript || "none"}`,
              `Fusion mode: ${state.mode}`,
              "Return 4 compact bullets."
            ].join("\n")
          },
          {
            type: "input_audio",
            input_audio: {
              data: base64,
              format: audioFormat(blob.type)
            }
          }
        ]
      }
    ],
    temperature: 0.35,
    max_tokens: 350
  });
  return extractMessageText(response);
}

async function askOpenRouter(context, frameDataUrl) {
  const content = [
    {
      type: "text",
      text: buildPrompt(context)
    }
  ];
  if (frameDataUrl) {
    content.push({
      type: "image_url",
      image_url: {
        url: frameDataUrl
      }
    });
  }

  const data = await openRouterFetch("/chat/completions", {
    model: state.vlmModel,
    messages: [
      {
        role: "system",
        content: "You are Sensorium, a mobile multimodal field copilot. Fuse phone camera, speech, location, motion, orientation, touch gestures, and device state into one useful answer. Be specific about what evidence came from which phone signal. Do not claim certainty when a signal is missing. Return concise Markdown with: Read, Why this needed the phone, Action, Next gesture."
      },
      {
        role: "user",
        content
      }
    ],
    temperature: 0.55,
    max_tokens: 900
  });

  return extractMessageText(data);
}

function extractMessageText(data) {
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("OpenRouter returned no message");
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part) => part.text || "").filter(Boolean).join("\n");
  }
  return JSON.stringify(message.content, null, 2);
}

async function openRouterFetch(path, body) {
  const response = await fetch(`${OPENROUTER_BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${state.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-OpenRouter-Title": APP_TITLE
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 500)}`);
  }
  return response.json();
}

function buildPrompt(context) {
  return [
    "Make a field card for this live phone context.",
    `Fusion mode: ${state.mode}`,
    `User mission: ${context.userMission || "Infer the most useful next step."}`,
    "Use this sensor JSON as evidence:",
    JSON.stringify(context, null, 2),
    "The image, if attached, is the current camera frame. Use it with the sensor JSON. Keep the answer useful on a phone screen."
  ].join("\n\n");
}

function collectContext(transcript, frameIncluded, audioInsight = "") {
  const connection = navigator.connection ? {
    effectiveType: navigator.connection.effectiveType,
    downlink: navigator.connection.downlink,
    saveData: navigator.connection.saveData
  } : null;

  return {
    capturedAt: new Date().toISOString(),
    userMission: els.missionInput.value.trim(),
    mode: state.mode,
    camera: {
      frameIncluded,
      active: !!state.videoStream
    },
    microphone: {
      active: !!state.audioStream,
      level: state.micLevel,
      transcript: transcript || "",
      audioModel: state.audioModel,
      audioModelInsight: audioInsight,
      lastClipAgeSeconds: state.lastAudioAt ? Math.round((Date.now() - state.lastAudioAt) / 1000) : null
    },
    location: state.location,
    motion: state.motion,
    orientation: state.orientation,
    gestures: state.gestures.slice(-12),
    device: {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type || null,
      battery: state.battery,
      network: connection,
      online: navigator.onLine,
      language: navigator.language
    },
    availableActions: {
      vibration: state.supported.vibration,
      speech: state.supported.speech,
      share: state.supported.share,
      clipboard: state.supported.clipboard,
      wakeLock: !!state.wakeLock
    }
  };
}

function makeLocalFusion(context) {
  const latestGesture = context.gestures.at(-1);
  const locationText = context.location
    ? `${context.location.latitude}, ${context.location.longitude} within ${context.location.accuracy} m`
    : "location unavailable";
  const motionText = context.motion
    ? `${context.motion.magnitude} m/s2 with tilt ${context.orientation?.beta ?? "unknown"}/${context.orientation?.gamma ?? "unknown"}`
    : "motion unavailable";
  const transcript = context.microphone.transcript || "no voice transcript yet";
  const audioInsight = context.microphone.audioModelInsight || "no audio-model insight yet";
  return [
    "### Read",
    `Local preview fused ${context.camera.frameIncluded ? "a camera frame" : "no camera frame"}, ${locationText}, motion ${motionText}, mic level ${context.microphone.level}, and gesture ${latestGesture ? `${latestGesture.type} (${latestGesture.detail})` : "none"}.`,
    "",
    "### Why this needed the phone",
    "A normal web page could answer a typed question. This demo needs the phone because it combines live sight, nearby sound, physical movement, GPS, screen orientation, touch intent, haptics, and share/speech actions into one context packet.",
    "",
    "### Action",
    `Use ${state.mode} mode for: ${context.userMission || "an immediate situational suggestion"}. Voice clue: ${transcript}. Audio-model clue: ${audioInsight}. Move the phone slowly across the scene, then pinch on the important object and run fusion again with an OpenRouter key for live VLM reasoning.`,
    "",
    "### Next gesture",
    "Double tap the camera to mark priority, swipe up for urgency, pinch out to ask for detail, or shake to flag risk."
  ].join("\n");
}

function addGesture(type, detail) {
  const gesture = {
    type,
    detail,
    at: new Date().toISOString()
  };
  state.gestures.push(gesture);
  state.gestures = state.gestures.slice(-20);
  els.gestureReadout.textContent = `${type}: ${detail}`;
  addEvent("gesture", `${type} - ${detail}`);
  pulseStage();
  vibrate(12);
  renderMetrics();
}

function addEvent(type, text) {
  state.events.unshift({
    type,
    text,
    at: new Date()
  });
  state.events = state.events.slice(0, 32);
  renderEvents();
}

function renderCapabilities() {
  const latestGesture = state.gestures.at(-1);
  const items = [
    ["OpenRouter", state.apiKey ? "Ready" : "Local preview", state.apiKey ? "ok" : "warn"],
    ["Models", state.modelCatalogLoaded ? `${state.modelCatalog.length} loaded` : "Fallback list", state.modelCatalogLoaded ? "ok" : "warn"],
    ["Camera", state.videoStream ? "Active" : supportLabel("camera"), state.videoStream ? "ok" : state.supported.camera ? "warn" : "off"],
    ["Mic", state.audioStream ? "Active" : supportLabel("microphone"), state.audioStream ? "ok" : state.supported.microphone ? "warn" : "off"],
    ["Location", state.location ? `${state.location.accuracy} m` : supportLabel("geolocation"), state.location ? "ok" : state.supported.geolocation ? "warn" : "off"],
    ["Motion", state.motion ? `${state.motion.magnitude} m/s2` : supportLabel("motion"), state.motion ? "ok" : state.supported.motion ? "warn" : "off"],
    ["Tilt", state.orientation ? `${state.orientation.beta}/${state.orientation.gamma}` : supportLabel("orientation"), state.orientation ? "ok" : state.supported.orientation ? "warn" : "off"],
    ["Gesture", latestGesture ? latestGesture.type : "Waiting", latestGesture ? "ok" : "warn"]
  ];
  els.capabilityGrid.innerHTML = items.map(([label, value, status]) => (
    `<div class="capability ${status}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  )).join("");
}

function supportLabel(key) {
  return state.supported[key] ? "Available" : "Unavailable";
}

function renderMetrics() {
  els.locationMetric.textContent = state.location ? `${state.location.latitude}, ${state.location.longitude}` : "Waiting";
  els.motionMetric.textContent = state.motion ? `${state.motion.magnitude} m/s2` : "Still";
  els.micMetric.textContent = state.audioStream ? `${state.micLevel}` : "Off";
  const latestGesture = state.gestures.at(-1);
  els.gestureMetric.textContent = latestGesture ? latestGesture.type : "None";
}

function renderEvents() {
  if (!state.events.length) {
    els.eventLog.innerHTML = "<div class=\"event\"><span>Now</span><strong>No events yet</strong></div>";
    return;
  }
  els.eventLog.innerHTML = state.events.map((event) => {
    const time = event.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<div class="event"><span>${escapeHtml(time)}</span><strong>${escapeHtml(event.type)}</strong><div>${escapeHtml(event.text)}</div></div>`;
  }).join("");
}

function renderResult(markdown) {
  els.resultBody.innerHTML = markdownToSafeHtml(markdown);
}

function markdownToSafeHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (trimmed.startsWith("### ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
    } else {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function setBusy(isBusy) {
  state.busy = isBusy;
  els.busyDot.classList.toggle("busy", isBusy);
  els.busyDot.setAttribute("aria-label", isBusy ? "Busy" : "Idle");
  els.analyzeBtn.disabled = isBusy;
  els.armBtn.disabled = isBusy;
}

function pulseStage() {
  els.gestureSurface.classList.remove("transient-pulse");
  void els.gestureSurface.offsetWidth;
  els.gestureSurface.classList.add("transient-pulse");
}

function vibrate(pattern) {
  if (state.supported.vibration) navigator.vibrate(pattern);
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}

async function speakResult() {
  if (!state.latestResult) return;
  if (state.apiKey && state.audioVoiceModel) {
    setBusy(true);
    try {
      await speakWithOpenRouterAudio(stripMarkdown(state.latestResult));
      addEvent("voice model", "Audio reply played");
      return;
    } catch (error) {
      addEvent("voice model", cleanError(error));
    } finally {
      setBusy(false);
    }
  }
  if (!state.supported.speech || !state.latestResult) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(stripMarkdown(state.latestResult).slice(0, 1200));
  utterance.rate = 0.98;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function speakWithOpenRouterAudio(text) {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${state.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-OpenRouter-Title": APP_TITLE
    },
    body: JSON.stringify({
      model: state.audioVoiceModel,
      messages: [
        {
          role: "user",
          content: `Read this phone field card aloud in a calm, concise field-assistant voice:\n\n${text.slice(0, 1600)}`
        }
      ],
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "wav"
      },
      stream: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${errorText.slice(0, 500)}`);
  }
  if (!response.body) {
    throw new Error("Audio stream unavailable");
  }

  const audioBase64 = await readAudioFromSse(response.body);
  if (!audioBase64) {
    throw new Error("Audio model returned no audio data");
  }
  const audioBlob = new Blob([base64ToUint8Array(audioBase64)], { type: "audio/wav" });
  if (state.generatedVoiceUrl) {
    URL.revokeObjectURL(state.generatedVoiceUrl);
  }
  state.generatedVoiceUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(state.generatedVoiceUrl);
  await audio.play();
}

async function readAudioFromSse(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const audioChunks = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta || {};
        const audio = delta.audio || {};
        if (audio.data) {
          audioChunks.push(audio.data);
        }
      } catch {
        // Ignore malformed keepalive chunks.
      }
    }
  }

  return audioChunks.join("");
}

async function shareResult() {
  if (!state.latestResult) return;
  const text = stripMarkdown(state.latestResult);
  if (navigator.share) {
    await navigator.share({ title: APP_TITLE, text });
  } else {
    await copyText(text);
    addEvent("share", "Copied field card");
  }
}

async function copyResult() {
  if (!state.latestResult) return;
  await copyText(stripMarkdown(state.latestResult));
  addEvent("copy", "Field card copied");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

function stripMarkdown(text) {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function blobToBase64Payload(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Unable to read audio blob"));
    reader.readAsDataURL(blob);
  });
}

function audioFormat(mimeType) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function nullableRound(value, digits) {
  return typeof value === "number" && Number.isFinite(value) ? round(value, digits) : null;
}

function cleanError(error) {
  const message = error?.message || String(error);
  if (message === "Failed to fetch") {
    return "OpenRouter request was blocked or unreachable. Use HTTPS and check browser CORS/network access.";
  }
  return message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.isSecureContext) {
    try {
      await navigator.serviceWorker.register("service-worker.js");
    } catch (error) {
      addEvent("pwa", error.message || "Service worker unavailable");
    }
  }
}

function init() {
  bindElements();
  detectSupport();
  restoreSettings();
  wireEvents();
  showPanel(window.location.hash.replace("#", "") || "mission");
  populateModelSelectors();
  renderCapabilities();
  renderMetrics();
  renderEvents();
  registerServiceWorker();
  loadOpenRouterModels();
  addEvent("ready", window.isSecureContext ? "Secure browser context" : "Use HTTPS for phone sensors");
}

init();
