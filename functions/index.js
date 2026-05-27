import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import textToSpeech from '@google-cloud/text-to-speech';

// ------------------------------
// Secrets
// ------------------------------
const ROBOFLOW_KEY = defineSecret('ROBOFLOW_KEY');

// ------------------------------
// Google TTS Client
// (Service Account is auto-used)
// ------------------------------
const ttsClient = new textToSpeech.TextToSpeechClient();

// ------------------------------
// Farm Animal Detection
// ------------------------------
export const runFarmAnimalDetection = onRequest(
  {
    region: 'us-central1',
    secrets: [ROBOFLOW_KEY],
  },
  async (req, res) => {
    // ---------- CORS ----------
    res.set('Access-Control-Allow-Origin', 'https://klhinnovation-6eac7.web.app');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POST only' });
    }

    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64' });
      }

      const rfResponse = await fetch(
        'https://serverless.roboflow.com/klhinnovation/workflows/detect-and-classify-3',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: ROBOFLOW_KEY.value(),
            inputs: {
              image: {
                type: 'base64',
                value: imageBase64,
              },
            },
          }),
        }
      );

      const data = await rfResponse.json();
      logger.info('Roboflow response', data);

      return res.status(200).json(data);
    } catch (err) {
      logger.error('Detection failed', err);
      return res.status(500).json({
        error: 'Detection failed',
        details: err.message,
      });
    }
  }
);

// ------------------------------
// Google Cloud Text-to-Speech
// ------------------------------
export const runGoogleTTS = onRequest(
  {
    region: 'us-central1',
  },
  async (req, res) => {
    // ---------- CORS ----------
    res.set('Access-Control-Allow-Origin', 'https://klhinnovation-6eac7.web.app');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POST only' });
    }

    try {
      const {
        text,
        voice = 'en-US-Neural2-D',
        speakingRate = 1,
        pitch = 0,
      } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Missing text' });
      }

      const request = {
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: voice,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch,
        },
      };

      const [response] = await ttsClient.synthesizeSpeech(request);

      return res.status(200).json({
        audioBase64: response.audioContent.toString('base64'),
      });
    } catch (err) {
      logger.error('TTS failed', err);
      return res.status(500).json({
        error: 'TTS failed',
        details: err.message,
      });
    }
  }
);
