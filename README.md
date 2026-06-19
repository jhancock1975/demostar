# Demostar Sensorium

A mobile browser demo that fuses camera, microphone, location, motion, device orientation, touch gestures, haptics, speech, share, and OpenRouter LLM/VLM calls into one live "field card."

## What It Does

Sensorium turns a phone into a multimodal AI instrument:

- The camera captures the current scene for a vision model.
- The microphone records a short voice clip, sends it through OpenRouter speech-to-text, and also sends the raw audio to an audio-capable chat model for sound/voice/environment reasoning.
- GPS, motion, tilt, battery, network, screen, and gesture telemetry are fused into the model prompt.
- Taps, double taps, long press, swipes, pinches, rotations, and shake gestures become intent signals.
- The result can be spoken aloud through browser speech or an OpenRouter audio-output model, copied, shared, and paired with haptic feedback.

Without an OpenRouter key, the app still runs a local fusion preview so the UI and phone sensors can be tested.

## Run Locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` on the same machine.

For a phone on the same private network, use HTTPS. Mobile browsers block camera, microphone, location, and motion APIs on a plain LAN `http://` origin.

The included `server.py` helper can serve the app over local HTTPS once you provide a certificate and key:

```bash
python3 server.py --lan-ip 10.0.0.196 --cert /tmp/demostar-certs/demostar-server.pem --key /tmp/demostar-certs/demostar-server.key --cert-dir /tmp/demostar-certs
```

On iPhone, install and trust the local CA from `http://10.0.0.196:8001/demostar-ca.crt`, then open `https://10.0.0.196:8443/`.

## OpenRouter Setup

1. Open the app on an HTTPS origin.
2. Paste an OpenRouter API key into the `OpenRouter` panel.
3. Keep or change the default models:
   - Vision/chat model: `google/gemini-2.5-flash`
   - Speech-to-text model: `openai/whisper-1`
   - Audio reasoning model: `google/gemini-2.5-flash`
   - Audio reply model: optional; set this to an OpenRouter model that supports audio output if you want model-generated speech
4. Tap `Prime sensors`, grant browser permissions, then tap `Fuse context`.

The API key is stored in `sessionStorage`, so it clears when the browser session ends. For production, put OpenRouter behind a server-side proxy instead of calling it from the browser.

## Supporting Files

| File | Purpose |
| --- | --- |
| [index.html](index.html) | Mobile-first app shell. |
| [styles.css](styles.css) | Responsive visual design for the sensor dashboard. |
| [app.js](app.js) | Sensor orchestration, gestures, OpenRouter calls, and result rendering. |
| [manifest.webmanifest](manifest.webmanifest) | PWA metadata. |
| [service-worker.js](service-worker.js) | Static asset cache for installable/offline behavior. |
| [server.py](server.py) | Local LAN HTTPS server helper. |
| [assets/icon.svg](assets/icon.svg) | App icon. |
| [LICENSE](LICENSE) | Apache License 2.0 terms. |
| [.gitignore](.gitignore) | Local file ignore rules for agents, IDEs, Python artifacts, and environment files. |

## Browser Feature Notes

Feature availability depends on the browser, OS, and permission policy. iOS requires a user gesture before granting motion/orientation access. Some desktop browsers do not expose battery or speech recognition APIs.
