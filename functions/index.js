const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");

const textToSpeech = require("@google-cloud/text-to-speech");
const {GoogleGenerativeAI} = require("@google/generative-ai");

const fs = require("fs");
const path = require("path");

// ------------------------------
// SAFE LOAD models.json
// ------------------------------
const modelsConfigPath = path.join(__dirname, "models.json");

let modelsConfig = {models: []};

try {
  const raw = fs.readFileSync(modelsConfigPath, "utf8");
  modelsConfig = JSON.parse(raw);
} catch (err) {
  logger.error("Failed to load models.json", err);
}

// ------------------------------
// Secrets
// ------------------------------
const ROBOFLOW_KEY = defineSecret("ROBOFLOW_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ------------------------------
// Clients
// ------------------------------
const ttsClient = new textToSpeech.TextToSpeechClient();

// ------------------------------
// CORS (safe + emulator friendly)
// ------------------------------
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  const allowed =
    origin &&
    (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("web.app") ||
      origin.includes("firebaseapp.com")
    );

  if (allowed) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ------------------------------
// Gemini CLASSIFIER
// ------------------------------
async function classifyImageWithGemini(imageBase64, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const prompt =
    "Pick best model ID:\n" +
    modelsConfig.models.map((m) => `- ${m.id}: ${m.description}`).join("\n") +
    "\nReturn ONLY model ID or gemini-general.";

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg",
      },
    },
  ]);

  const text = (result.response.text() || "").trim();

  const match = modelsConfig.models.find((m) => m.id === text);
  return match ? match.id : "gemini-general";
}

// ------------------------------
// Gemini DETECTION (safe JSON parsing)
// ------------------------------
async function runGeminiDetection(imageBase64, apiKey, threshold = 0.4) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt =
    "Return ONLY a JSON array of detections. " +
    "Each item must include class, confidence, box_2d. " +
    "Only include confidence > " + threshold;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg",
      },
    },
  ]);

  try {
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error("Gemini JSON parse failed", err);
    return [];
  }
}

// ------------------------------
// Roboflow fallback parser
// ------------------------------
function extractPredictions(data) {
  return (
    data?.outputs?.[0]?.predictions ||
    data?.predictions ||
    []
  );
}

// ------------------------------
// GET MODELS
// ------------------------------
exports.getAvailableModels = onRequest(
    {region: "us-central1"},
    async (req, res) => {
      setCorsHeaders(req, res);
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "GET") return res.status(405).send("GET only");

      return res.json(modelsConfig);
    },
);

// ------------------------------
// MAIN DETECTION ENDPOINT
// ------------------------------
exports.runDetection = onRequest(
    {
      region: "us-central1",
      secrets: [ROBOFLOW_KEY, GEMINI_API_KEY],
      timeoutSeconds: 60,
    },
    async (req, res) => {
      setCorsHeaders(req, res);

      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).send("POST only");

      try {
        const {imageBase64, modelId = "auto"} = req.body || {};

        if (!imageBase64) {
          return res.status(400).json({error: "Missing imageBase64"});
        }

        let selectedModel = modelId;

        // AUTO ROUTING
        if (modelId === "auto") {
          const apiKey = GEMINI_API_KEY.value();
          selectedModel = await classifyImageWithGemini(imageBase64, apiKey);
        }

        const model =
        modelsConfig.models.find((m) => m.id === selectedModel) ||
        modelsConfig.models[0];

        let predictions = [];

        // GEMINI MODEL
        if (model.type === "gemini-detect") {
          const apiKey = GEMINI_API_KEY.value();
          predictions = await runGeminiDetection(imageBase64, apiKey);
        } else {
        // ROBOFLOW MODEL
          const rfKey = ROBOFLOW_KEY.value();

          const url = model.endpoint + "?api_key=" + rfKey;

          const rfRes = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({image: imageBase64}),
          });

          const data = await rfRes.json();
          predictions = extractPredictions(data);
        }

        return res.json({
          success: true,
          modelUsed: model.id,
          predictions,
        });
      } catch (err) {
        logger.error("runDetection failed", err);

        return res.status(500).json({
          success: false,
          error: err.message,
        });
      }
    },
);

// ------------------------------
// TTS ENDPOINT
// ------------------------------
exports.runGoogleTTS = onRequest(
    {region: "us-central1"},
    async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).send("POST only");

      try {
        const {text} = req.body || {};

        if (!text) {
          return res.status(400).json({error: "Missing text"});
        }

        const request = {
          input: {text},
          voice: {
            languageCode: "en-US",
            name: "en-US-Neural2-D",
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);

        return res.json({
          audioBase64: response.audioContent.toString("base64"),
        });
      } catch (err) {
        logger.error("TTS failed", err);

        return res.status(500).json({
          error: err.message,
        });
      }
    },
);
