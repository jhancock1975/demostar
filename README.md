# Demostar Sensorium

A mobile browser demo that fuses camera, microphone, location, motion, device orientation, touch gestures, haptics, speech, share, and OpenRouter LLM/VLM calls into one live "field card."

## What It Does

Sensorium turns a phone into a multimodal AI instrument:

- The camera captures the current scene for a vision model.
- The microphone records a short voice clip, down-samples it to a browser-generated WAV payload, sends it through OpenRouter speech-to-text, and can also send the raw audio to an audio-capable chat model for sound/voice/environment reasoning.
- GPS, motion, tilt, battery, network, screen, gestures, recent events, and derived phone-state signals are fused into the model prompt.
- Taps, double taps, long press, swipes, pinches, rotations, and shake gestures become intent signals.
- The result can be spoken aloud through browser speech or an OpenRouter audio-output model, copied, shared, and paired with haptic feedback.
- The result includes payload sizes and debug detail when an agent or coordinator call fails.

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

## GitHub Pages

The public demo is deployed to GitHub Pages:

```text
https://jhancock1975.github.io/demostar/
```

## OpenRouter Setup

1. Open the app on an HTTPS origin.
2. Enter an OpenRouter API key on the first screen.
3. If the key is valid, the sensor app appears. If it is invalid, the app shows the OpenRouter error message.
4. Keep or change the default models:
   - Vision/chat model: `google/gemini-2.5-flash`
   - Speech-to-text model: `openai/whisper-large-v3`
   - Audio reasoning model: `google/gemini-2.5-flash`
   - Audio reply model: optional; set this to an OpenRouter model that supports audio output if you want model-generated speech
5. Enter a mission, then tap `Send to AI`.

The model dropdowns are populated from OpenRouter's `/api/v1/models` endpoint on page load and filtered by each component's modality needs.

The `Send to AI` action sends the mission, camera frame, audio, location, motion, orientation, gesture state, and device state to a council of OpenRouter-powered specialist agents:

- `Scene Scout`: camera and visual context.
- `Sound Scout`: microphone audio and speech.
- `Motion Navigator`: location, movement, and orientation.
- `Action Planner`: mission, gestures, interaction intent, and next phone action.
- `Safety Officer`: risk, privacy, and uncertainty checks.

The agent council runs with limited concurrency for mobile reliability. The coordinator model then fuses those specialist reports into the final result. The result panel shows a short summary of what was sent, payload sizes, any partial failures, and the model response.

The API key is kept only in page memory. It is not written to `localStorage`, `sessionStorage`, cookies, IndexedDB, or the service worker cache, so the user must enter it again after every reload or new tab. For production, put OpenRouter behind a server-side proxy instead of calling it from the browser.

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
| [.github/workflows/pages.yml](.github/workflows/pages.yml) | GitHub Pages deployment workflow. |
| [LICENSE](LICENSE) | Apache License 2.0 terms. |
| [.gitignore](.gitignore) | Local file ignore rules for agents, IDEs, Python artifacts, and environment files. |

## Browser Feature Notes

Feature availability depends on the browser, OS, and permission policy. iOS requires a user gesture before granting motion/orientation access. Some desktop browsers do not expose battery or speech recognition APIs.
