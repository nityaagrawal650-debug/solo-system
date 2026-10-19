
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "12mb" }));
app.use("/api/", rateLimit({
  windowMs: 60000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
const VOICE = process.env.OPENAI_VOICE || "marin";

function requireKey(res) {
  if (!API_KEY) {
    res.status(503).json({ error: "Backend API key is not configured." });
    return false;
  }
  return true;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, chatConfigured: !!API_KEY, voiceConfigured: !!API_KEY });
});

app.post("/api/chat", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const { message, imageData, history = [], instructions = "You are a helpful tutor." } = req.body || {};
    if (typeof message !== "string" || message.length > 12000) {
      return res.status(400).json({ error: "Message missing or too long." });
    }

    const content = [{
      type: "input_text",
      text: message || "Explain the uploaded question step by step."
    }];

    if (imageData) {
      if (typeof imageData !== "string" ||
          !/^data:image\/(png|jpeg|webp);base64,/.test(imageData) ||
          imageData.length > 11000000) {
        return res.status(400).json({ error: "Use a smaller PNG, JPG or WEBP image." });
      }
      content.push({ type: "input_image", image_url: imageData, detail: "high" });
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-16)
          .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
          .map(m => ({ role: m.role, content: m.content.slice(0, 5000) }))
      : [];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        instructions: String(instructions).slice(0, 5000),
        input: [...safeHistory, { role: "user", content }],
        max_output_tokens: 1200
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || "AI request failed." });
    }

    const text = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(c => c.type === "output_text")
      .map(c => c.text).join("\n").trim();

    res.json({ text: text || "Please try asking again." });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Unexpected server error." });
  }
});

app.post("/api/realtime-token", async (req, res) => {
  if (!requireKey(res)) return;
  try {
    const instructions = typeof req.body?.instructions === "string"
      ? req.body.instructions.slice(0, 5000)
      : "You are a helpful study tutor. Explain clearly and naturally.";

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          instructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              turn_detection: { type: "server_vad" },
              transcription: { model: "gpt-4o-mini-transcribe", language: "en" }
            },
            output: { voice: VOICE }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data?.error?.message || "Voice session could not start." });
    }

    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (error) {
    console.error("Voice token error:", error);
    res.status(500).json({ error: "Could not create temporary voice token." });
  }
});

app.listen(PORT, () => console.log(`Solo System AI backend running on ${PORT}`));
        
