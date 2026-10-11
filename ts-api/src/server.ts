import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { converter, FORMATOS, type Formato, type Modo } from "./converter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pastaFront = path.resolve(__dirname, "../../frontend");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Original-Size, X-New-Size, X-Engine, X-Time-Ms");
  next();
});

app.options("/api/convert", (_req, res) => res.sendStatus(204));

app.post("/api/convert", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo não enviado" });
  const formato = String(req.body.format ?? "webp").toLowerCase() as Formato;
  const modo = (req.body.mode ?? "lossless") as Modo;
  const qualidade = Number(req.body.quality ?? 90);
  try {
    const inicio = performance.now();
    const { buffer, mime } = await converter(req.file.buffer, formato, modo, qualidade);
    const tempoMs = performance.now() - inicio;
    res.setHeader("Content-Type", mime);
    res.setHeader("X-Original-Size", String(req.file.size));
    res.setHeader("X-New-Size", String(buffer.length));
    res.setHeader("X-Time-Ms", tempoMs.toFixed(0));
    res.setHeader("X-Engine", "TypeScript (sharp)");
    res.send(buffer);
  } catch (e) {
    res.status(422).json({ error: (e as Error).message });
  }
});

app.get("/api/formats", (_req, res) => res.json(Object.keys(FORMATOS)));

app.use(express.static(pastaFront));

app.listen(8002, () => console.log("API TypeScript em http://localhost:8002"));
