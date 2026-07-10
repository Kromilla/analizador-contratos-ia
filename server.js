require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// ─── Configuración ────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "tu_api_key_aqui") {
  console.error("\n❌ ERROR: Falta la GEMINI_API_KEY en el archivo .env");
  process.exit(1);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Usaremos el modelo flash-lite como antes, o el que prefieras
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;
const GEMINI_FILES_URL = `https://generativelanguage.googleapis.com/v1beta/`;

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const rateLimit = require("express-rate-limit");
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Demasiadas peticiones, intenta de nuevo más tarde." }
});

app.use("/api", apiLimiter);

// ─── Almacenamiento en Memoria (Vercel-Ready) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máx
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Solo se aceptan archivos PDF"), false);
  },
});

// ─── Prompt de análisis ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un abogado experto en análisis de contratos. Analiza el documento proporcionado y devuelve EXCLUSIVAMENTE un JSON con esta estructura:
{
  "nombre_descriptivo": "Un título corto (máx 5 palabras) que identifique específicamente al contrato (ej: Arrendamiento Local Centro)",
  "resumen": "Un párrafo claro y conciso explicando de qué trata el contrato, las partes involucradas y el propósito principal.",
  "clausulas": [
    {
      "titulo": "Nombre de la cláusula",
      "descripcion": "Explicación breve de qué establece esta cláusula y su importancia.",
      "pagina": "Número de página o sección exacta",
      "texto_original": "Extracto literal de la cláusula en el documento original"
    }
  ],
  "riesgos": [
    {
      "nivel": "alto|medio|bajo",
      "titulo": "Nombre del riesgo",
      "descripcion": "Explicación del riesgo potencial y por qué podría ser problemático.",
      "pagina": "Número de página o sección exacta donde se encuentra",
      "texto_original": "Extracto literal de la parte riesgosa en el documento original"
    }
  ],
  "tipo_contrato": "Tipo de contrato detectado (ej: Contrato de trabajo, Arrendamiento, etc.)",
  "partes": ["Nombre parte 1", "Nombre parte 2"]
}
Identifica mínimo 3 cláusulas importantes y evalúa todos los riesgos relevantes.`;

// ─── Endpoints ────────────────────────────────────────────────────────────────

// 1. Analizar Contrato (Sube a Gemini File API y luego analiza)
app.post("/api/analyze", upload.single("contrato"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo PDF." });

    // PASO 1: Subir el archivo a Gemini File API usando protocolo RAW
    const uploadRes = await fetch(GEMINI_UPLOAD_URL, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "raw",
        "X-Goog-Upload-File-Name": req.file.originalname,
        "X-Goog-Upload-Header-Content-Length": req.file.size.toString(),
        "Content-Type": req.file.mimetype,
      },
      body: req.file.buffer
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.json().catch(() => ({}));
      console.error("Gemini Upload API error:", uploadRes.status, errBody);
      throw new Error("Error al subir el archivo a Google Gemini para su análisis.");
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file.uri;
    const fileName = uploadData.file.name; // ID interno de Gemini (ej: files/12345)

    // PASO 2: Analizar el contrato referenciando el fileUri
    const geminiRes = await fetch(GEMINI_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          parts: [
            { fileData: { mimeType: "application/pdf", fileUri: fileUri } },
            { text: "Analiza este contrato según las instrucciones." }
          ]
        }],
        generationConfig: { 
          temperature: 0.1, 
          responseMimeType: "application/json" 
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error("Gemini Generate API error:", geminiRes.status, errBody);
      throw new Error(errBody?.error?.message || geminiRes.statusText);
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let analysis = JSON.parse(responseText);

    const recordId = crypto.randomUUID();
    const clientRecord = {
      id: recordId,
      geminiFileUri: fileUri,
      geminiFileName: fileName,
      metadata: {
        nombre_archivo: req.file.originalname,
        tamaño: req.file.size,
        analizado_en: new Date().toISOString()
      },
      analysis
    };
    
    res.json({ success: true, data: clientRecord });

  } catch (err) {
    console.error("Error en análisis:", err);
    res.status(500).json({ error: "Error interno al procesar el contrato: " + err.message });
  }
});

// 2. Chat con el Contrato (usando el fileUri guardado en el cliente)
app.post("/api/chat", express.json(), async (req, res) => {
  try {
    const { geminiFileUri, message, chatHistory = [] } = req.body;
    
    if (!geminiFileUri || !message) return res.status(400).json({ error: "Faltan parámetros (geminiFileUri, message)" });
    
    const contents = [
      {
        role: "user",
        parts: [
          { fileData: { mimeType: "application/pdf", fileUri: geminiFileUri } },
          { text: "Este es el documento del contrato. Por favor, responde a mis siguientes preguntas basándote únicamente en este documento." }
        ]
      },
      {
        role: "model",
        parts: [{ text: "Entendido. He leído el contrato. ¿Qué deseas saber?" }]
      }
    ];

    chatHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    });

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const geminiRes = await fetch(GEMINI_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Eres un asistente legal amigable que ayuda a entender el contrato proporcionado. Responde de forma clara, profesional y concisa, basándote SOLO en la información del documento adjunto." }] },
        contents: contents,
        generationConfig: { temperature: 0.3 }
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || geminiRes.statusText);
    }

    const geminiData = await geminiRes.json();
    const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    res.json({ success: true, reply: replyText });

  } catch (err) {
    console.error("Error en chat:", err);
    res.status(500).json({ error: "Error en el chat: " + err.message });
  }
});

// 3. Borrar el archivo de los servidores de Google (Privacidad)
app.post("/api/delete", express.json(), async (req, res) => {
  try {
    const { geminiFileName } = req.body;
    if (!geminiFileName) return res.status(400).json({ error: "Falta geminiFileName" });

    // La URL de borrado necesita el ID que viene en "name" (ej: files/xyz123)
    const deleteUrl = `${GEMINI_FILES_URL}${geminiFileName}?key=${GEMINI_API_KEY}`;
    
    const delRes = await fetch(deleteUrl, { method: "DELETE" });
    if (!delRes.ok) {
      const errBody = await delRes.json().catch(() => ({}));
      console.error("Gemini Delete API error:", delRes.status, errBody);
      throw new Error("No se pudo borrar el archivo de Gemini.");
    }

    res.json({ success: true, message: "Archivo eliminado permanentemente." });
  } catch (err) {
    console.error("Error al borrar:", err);
    res.status(500).json({ error: "Error al borrar el archivo." });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "3.0.0" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`\n✅ Analizador de Contratos IA v3 (Serverless-Ready) corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
