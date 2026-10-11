const $ = (id) => document.getElementById(id);

// Cada motor expõe a mesma API (POST /api/convert), em portas diferentes.
const ENGINES = { python: "http://localhost:8001", ts: "http://localhost:8002" };
const HINTS = {
  lossless: {
    webp: "WebP lossless: pixels idênticos ao original.",
    png: "PNG sempre é sem perdas; apenas recompressão otimizada.",
    avif: "AVIF lossless: pixels idênticos (pode ser lento).",
    jpeg: "JPEG não tem modo lossless real; usa qualidade 95 sem subamostragem de cor.",
  },
  lossy: {},
};

const state = { engine: "python", format: "webp", mode: "lossless", file: null, url: null };

function fmt(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(2) + " MB";
}

function select(container, attr, value, cb) {
  container.forEach((el) => el.classList.toggle("active", el.dataset[attr] === value));
  cb(value);
}

function updateHint() {
  $("hint").textContent = state.mode === "lossless"
    ? HINTS.lossless[state.format]
    : state.format === "png" ? "PNG não possui modo com perdas; será usado o modo sem perdas." : "Menor qualidade = arquivo menor, com perda visual.";
  $("qualityWrap").classList.toggle("hidden", state.mode !== "lossy" || state.format === "png");
}

document.querySelectorAll("[data-engine]").forEach((b) =>
  b.addEventListener("click", () => select(document.querySelectorAll("[data-engine]"), "engine", b.dataset.engine, (v) => (state.engine = v))));
document.querySelectorAll("[data-format]").forEach((b) =>
  b.addEventListener("click", () => { select(document.querySelectorAll("[data-format]"), "format", b.dataset.format, (v) => (state.format = v)); updateHint(); }));
document.querySelectorAll("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => { select(document.querySelectorAll("[data-mode]"), "mode", b.dataset.mode, (v) => (state.mode = v)); updateHint(); }));
$("quality").addEventListener("input", (e) => ($("qVal").textContent = e.target.value));

// Seleção de arquivo (clique ou arrastar e soltar)
const drop = $("drop");
drop.addEventListener("click", () => $("file").click());
drop.addEventListener("keydown", (e) => e.key === "Enter" && $("file").click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); setFile(e.dataTransfer.files[0]); });
$("file").addEventListener("change", (e) => setFile(e.target.files[0]));

function setFile(file) {
  if (!file || !file.type.startsWith("image/")) return showError("Selecione um arquivo de imagem válido.");
  showError("");
  state.file = file;
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(file);
  $("preOriginal").src = state.url;
  $("fileName").textContent = file.name;
  $("fileMeta").textContent = file.type;
  $("origSize").textContent = fmt(file.size);
  $("dropContent").classList.add("hidden");
  $("fileInfo").classList.remove("hidden");
  $("options").classList.remove("hidden");
  $("result").classList.add("hidden");
  updateHint();
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").classList.toggle("hidden", !msg);
}

$("go").addEventListener("click", async () => {
  if (!state.file) return;
  showError("");
  const btn = $("go");
  btn.disabled = true;
  btn.textContent = "Convertendo…";
  const body = new FormData();
  body.append("file", state.file);
  body.append("format", state.format);
  body.append("mode", state.mode);
  body.append("quality", $("quality").value);
  try {
    const res = await fetch(ENGINES[state.engine] + "/api/convert", { method: "POST", body });
    if (!res.ok) throw new Error((await res.json()).error || "Falha na conversão");
    const blob = await res.blob();
    const orig = Number(res.headers.get("X-Original-Size"));
    const novo = Number(res.headers.get("X-New-Size"));
    showResult(blob, orig, novo, res.headers.get("X-Engine"));
  } catch (err) {
    showError(err.message === "Failed to fetch"
      ? "Não foi possível conectar ao servidor. Verifique se a API selecionada está rodando."
      : err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Converter";
  }
});

function showResult(blob, orig, novo, engine) {
  const diff = ((orig - novo) / orig) * 100;
  const worse = diff < 0;
  $("rOrig").textContent = fmt(orig);
  $("rNew").textContent = fmt(novo);
  $("rSave").textContent = (worse ? "+" : "−") + Math.abs(diff).toFixed(1) + "%";
  $("rLabel").textContent = worse ? "Aumento" : "Economia";
  document.querySelector(".stat.highlight").classList.toggle("worse", worse);
  $("bar").style.width = Math.min(100, (novo / orig) * 100) + "%";
  $("rEngine").textContent = "Processado por: " + engine;
  $("imgA").src = state.url;
  const out = URL.createObjectURL(blob);
  $("imgB").src = out;
  const ext = state.format === "jpeg" ? "jpg" : state.format;
  $("download").href = out;
  $("download").download = state.file.name.replace(/\.[^.]+$/, "") + "." + ext;
  $("result").classList.remove("hidden");
  $("result").scrollIntoView({ behavior: "smooth" });
}

updateHint();

// Esconde painéis antigos ao iniciar uma nova conversão
$("go").addEventListener("click", () => $("comparison").classList.add("hidden"));

// Executa as duas rotinas (uma por vez, para não disputarem CPU) e compara
async function runEngine(engine) {
  const body = new FormData();
  body.append("file", state.file);
  body.append("format", state.format);
  body.append("mode", state.mode);
  body.append("quality", $("quality").value);
  const res = await fetch(ENGINES[engine] + "/api/convert", { method: "POST", body });
  if (!res.ok) throw new Error(engine + ": " + ((await res.json()).error || "falha na conversão"));
  const blob = await res.blob();
  return { blob, size: Number(res.headers.get("X-New-Size")), time: Number(res.headers.get("X-Time-Ms")) };
}

$("compare").addEventListener("click", async () => {
  if (!state.file) return;
  showError("");
  const btn = $("compare");
  btn.disabled = true;
  $("go").disabled = true;
  btn.textContent = "Comparando…";
  $("result").classList.add("hidden");
  try {
    const py = await runEngine("python");
    const ts = await runEngine("ts");
    showComparison(py, ts);
  } catch (err) {
    showError(err.message.includes("Failed to fetch")
      ? "Não foi possível conectar. Para comparar, as duas APIs (portas 8001 e 8002) precisam estar rodando."
      : err.message);
  } finally {
    btn.disabled = false;
    $("go").disabled = false;
    btn.textContent = "Comparar Python × TypeScript";
  }
});

function showComparison(py, ts) {
  const orig = state.file.size;
  const save = (n) => {
    const d = ((orig - n) / orig) * 100;
    return (d < 0 ? "+" : "−") + Math.abs(d).toFixed(1) + "%";
  };
  const mark = (a, b, idA, idB) => {
    $(idA).classList.toggle("win", a < b);
    $(idB).classList.toggle("win", b < a);
  };
  const label = state.format.toUpperCase() + " · " + (state.mode === "lossless" || state.format === "png" ? "sem perdas" : "qualidade " + $("quality").value);
  $("cmpInfo").textContent = `${state.file.name} (${fmt(orig)}) → ${label}. Tempo medido no servidor.`;
  $("cmpPySize").textContent = fmt(py.size);
  $("cmpTsSize").textContent = fmt(ts.size);
  $("cmpPySave").textContent = save(py.size);
  $("cmpTsSave").textContent = save(ts.size);
  $("cmpPyTime").textContent = py.time + " ms";
  $("cmpTsTime").textContent = ts.time + " ms";
  mark(py.size, ts.size, "cmpPySize", "cmpTsSize");
  mark(py.size, ts.size, "cmpPySave", "cmpTsSave");
  mark(py.time, ts.time, "cmpPyTime", "cmpTsTime");

  const menor = py.size === ts.size ? "empate no tamanho" : (py.size < ts.size ? "Python gerou o menor arquivo" : "TypeScript gerou o menor arquivo");
  const rapido = py.time === ts.time ? "empate no tempo" : (py.time < ts.time ? "Python foi mais rápido" : "TypeScript foi mais rápido");
  $("cmpVerdict").textContent = `${menor[0].toUpperCase() + menor.slice(1)}; ${rapido}.`;

  if (state.cmpUrls) state.cmpUrls.forEach((u) => URL.revokeObjectURL(u));
  state.cmpUrls = [URL.createObjectURL(py.blob), URL.createObjectURL(ts.blob)];
  $("cmpImgPy").src = state.cmpUrls[0];
  $("cmpImgTs").src = state.cmpUrls[1];
  $("comparison").classList.remove("hidden");
  $("comparison").scrollIntoView({ behavior: "smooth" });
}

// Botão de refresh: limpa tudo e volta ao início
$("reset").addEventListener("click", () => {
  [state.url, ...(state.cmpUrls || [])].forEach((u) => u && URL.revokeObjectURL(u));
  state.file = null; state.url = null; state.cmpUrls = null;
  $("file").value = "";
  ["preOriginal", "imgA", "imgB", "cmpImgPy", "cmpImgTs"].forEach((id) => $(id).removeAttribute("src"));
  ["fileInfo", "options", "result", "comparison"].forEach((id) => $(id).classList.add("hidden"));
  $("dropContent").classList.remove("hidden");
  showError("");
  // volta as opções padrão
  document.querySelector('[data-engine="python"]').click();
  document.querySelector('[data-format="webp"]').click();
  document.querySelector('[data-mode="lossless"]').click();
  $("quality").value = 80;
  $("qVal").textContent = "80";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
