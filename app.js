/* ══════════════════════════════════════════════════════════════════════════
   ContractAI 3.0 — Frontend Logic (Serverless & Privacy Focused)
   ══════════════════════════════════════════════════════════════════════════ */

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const panelUpload    = $("panelUpload");
const panelProgress  = $("panelProgress");
const panelResults   = $("panelResults");

// Upload
const dropZone       = $("dropZone");
const fileInput      = $("fileInput");
const dropIcon       = $("dropIcon");
const dropTexts      = $("dropTexts");
const fileInfo       = $("fileInfo");
const fileName       = $("fileName");
const fileMeta       = $("fileMeta");
const btnChoose      = $("btnChoose");
const uploadForm     = $("uploadForm");
const analyzeBtn     = $("analyzeBtn");

// Progress
const progressFill   = $("progressFill");
const progressStep   = $("progressStep");

// Results
const resultsSub     = $("resultsSub");
const metaBar        = $("metaBar");
const contractType   = $("contractType");
const summaryText    = $("summaryText");
const partesChips    = $("partesChips");
const clausesCount   = $("clausesCount");
const clauseList     = $("clauseList");
const risksCount     = $("risksCount");
const riskList       = $("riskList");
const toggleChatBtn  = $("toggleChatBtn");
const printBtn       = $("printBtn");
const resetBtn       = $("resetBtn");
const deleteBtn      = $("deleteBtn"); // Nuevo botón de privacidad

// Sidebar
const navAnalizar    = $("navAnalizar");
const historyList    = $("historyList");
const themeToggle    = $("themeToggle");

// Chat
const chatMessages   = $("chatMessages");
const chatForm       = $("chatForm");
const chatInput      = $("chatInput");
const chatSendBtn    = $("chatSendBtn");

// Toast
const toast          = $("toast");
const toastMsg       = $("toastMsg");
const toastClose     = $("toastClose");

// Modals (Privacy)
const modalPrivacy   = $("modalPrivacy");
const modalTerms     = $("modalTerms");

// ─── State ────────────────────────────────────────────────────────────────────
let selectedFile = null;
let currentContractRecord = null;
let chatHistory = [];
let toastTimer = null;

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = {
  bytes: (b) => b < 1048576 ? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(1)+" MB",
  date:  (iso) => new Date(iso).toLocaleString("es-MX", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }),
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toast.removeAttribute("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  toastTimer = setTimeout(dismissToast, 6000);
}
function dismissToast() {
  toast.classList.remove("show");
  setTimeout(() => toast.setAttribute("hidden", ""), 300);
}
toastClose?.addEventListener("click", dismissToast);

// ─── Theme ────────────────────────────────────────────────────────────────────
let isDark = localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);

function applyTheme() {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  themeToggle.innerHTML = isDark 
    ? '<span class="theme-icon">☀️</span><span class="theme-label">Modo Claro</span>'
    : '<span class="theme-icon">🌙</span><span class="theme-label">Modo Oscuro</span>';
}
themeToggle.addEventListener("click", () => {
  isDark = !isDark;
  localStorage.setItem("theme", isDark ? "dark" : "light");
  applyTheme();
});
applyTheme();

// ─── UI Panel Switcher ────────────────────────────────────────────────────────
function showPanel(name) {
  panelUpload.setAttribute("hidden", "");
  panelProgress.setAttribute("hidden", "");
  panelResults.setAttribute("hidden", "");
  navAnalizar.classList.remove("nav-item--active");

  document.querySelectorAll('.history-item').forEach(el => el.style.backgroundColor = '');

  if (name === "upload") {
    panelUpload.removeAttribute("hidden");
    navAnalizar.classList.add("nav-item--active");
    currentContractRecord = null;
    chatHistory = [];
  } else if (name === "progress") {
    panelProgress.removeAttribute("hidden");
  } else if (name === "results") {
    panelResults.removeAttribute("hidden");
    if (currentContractRecord) {
      const el = document.querySelector(`[data-id="${currentContractRecord.id}"]`);
      if (el) el.style.backgroundColor = "var(--bg-active)";
    }
  }
}

navAnalizar.addEventListener("click", (e) => {
  e.preventDefault();
  showPanel("upload");
  resetFile();
});
resetBtn.addEventListener("click", () => {
  showPanel("upload");
  resetFile();
});
printBtn.addEventListener("click", () => window.print());

// Delete Data (Privacy)
deleteBtn?.addEventListener("click", async () => {
  if (!currentContractRecord || !currentContractRecord.geminiFileName) return;
  
  if (!confirm("¿Estás seguro de que deseas borrar este contrato y su historial permanentemente? Los datos se eliminarán de los servidores de Google y de tu navegador.")) return;

  deleteBtn.disabled = true;
  deleteBtn.textContent = "Borrando...";

  try {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiFileName: currentContractRecord.geminiFileName })
    });
    
    // Lo borramos de localStorage de todos modos (por si falla la API pero queremos olvidarlo localmente)
    let history = JSON.parse(localStorage.getItem("contractHistory") || "[]");
    history = history.filter(r => r.id !== currentContractRecord.id);
    localStorage.setItem("contractHistory", JSON.stringify(history));

    showToast("Contrato eliminado permanentemente.");
    showPanel("upload");
    resetFile();
    loadHistory();
  } catch(e) {
    showToast("Error al borrar el contrato del servidor.");
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.innerHTML = "🗑️ Borrar Mis Datos";
  }
});

let isChatHidden = false;
toggleChatBtn.addEventListener("click", () => {
  isChatHidden = !isChatHidden;
  const layout = document.querySelector(".results-layout");
  if (isChatHidden) {
    layout.classList.add("chat-hidden");
    toggleChatBtn.textContent = "💬 Mostrar Chat";
  } else {
    layout.classList.remove("chat-hidden");
    toggleChatBtn.textContent = "💬 Ocultar Chat";
  }
});

// ─── File Handling ────────────────────────────────────────────────────────────
function setFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf") { showToast("Solo se aceptan archivos PDF."); return; }
  if (file.size > 20 * 1024 * 1024)   { showToast("El archivo excede el límite de 20 MB."); return; }

  selectedFile = file;
  dropIcon.textContent   = "✅";
  dropTexts.setAttribute("hidden", "");
  fileInfo.removeAttribute("hidden");
  fileName.textContent   = file.name;
  fileMeta.textContent   = fmt.bytes(file.size) + " · PDF";
  dropZone.classList.add("has-file");
  analyzeBtn.disabled    = false;
}

function resetFile() {
  selectedFile           = null;
  fileInput.value        = "";
  dropIcon.textContent   = "📄";
  dropTexts.removeAttribute("hidden");
  fileInfo.setAttribute("hidden", "");
  fileName.textContent   = "";
  fileMeta.textContent   = "";
  dropZone.classList.remove("has-file", "drag-active");
  analyzeBtn.disabled    = true;
}

btnChoose.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", (e) => { if (e.target === dropZone) fileInput.click(); });
fileInput.addEventListener("change", () => selectedFile || setFile(fileInput.files[0]));
document.addEventListener("dragover", (e) => e.preventDefault());
dropZone.addEventListener("dragover",  (e) => { e.preventDefault(); dropZone.classList.add("drag-active"); });
dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("drag-active"));
dropZone.addEventListener("drop",      (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");
  setFile(e.dataTransfer.files[0]);
});

// ─── Progress Animation ───────────────────────────────────────────────────────
async function simulateProgress() {
  showPanel("progress");
  const steps = [
    { el: $("ps0"), p: 20, msg: "Cifrando y subiendo PDF a Google Gemini..." },
    { el: $("ps1"), p: 50, msg: "Procesando documento con IA..." },
    { el: $("ps2"), p: 80, msg: "Detectando cláusulas y riesgos..." },
    { el: $("ps3"), p: 95, msg: "Generando reporte JSON..." },
  ];
  progressFill.style.width = "0%";
  
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    progressStep.textContent = s.msg;
    progressFill.style.width = s.p + "%";
    s.el.classList.add("active");
    await new Promise(r => setTimeout(r, 1200)); // Visual delay
  }
}

// ─── History (Local Storage) ──────────────────────────────────────────────────
function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("contractHistory") || "[]");
    renderHistoryList(history);
  } catch (e) {
    console.error("Error loading history from local storage", e);
  }
}

function saveToHistory(record) {
  try {
    const history = JSON.parse(localStorage.getItem("contractHistory") || "[]");
    history.unshift(record); // Add to beginning
    if (history.length > 50) history.pop(); // Keep only last 50
    localStorage.setItem("contractHistory", JSON.stringify(history));
    loadHistory();
  } catch(e) {
    console.error("Error saving to local storage", e);
  }
}

function fetchContractData(id) {
  try {
    const history = JSON.parse(localStorage.getItem("contractHistory") || "[]");
    const record = history.find(r => r.id === id);
    if (record) {
      renderResults(record);
    } else {
      showToast("Contrato no encontrado.");
    }
  } catch (error) {
    showToast("Error al cargar datos del contrato.");
  }
}

function renderHistoryList(items) {
  historyList.innerHTML = "";
  if (!items.length) {
    historyList.innerHTML = "<div style='font-size:12px;color:var(--text-muted);padding:0 12px;'>No hay análisis previos</div>";
    return;
  }
  
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.dataset.id = item.id;
    div.title = item.metadata.nombre_archivo;
    const titleText = item.analysis.nombre_descriptivo || item.analysis.tipo_contrato || "Contrato";
    div.innerHTML = `📄 ${titleText} <br><small style="color:var(--text-muted); font-size:11px;">${fmt.date(item.metadata.analizado_en)}</small>`;
    div.addEventListener("click", () => fetchContractData(item.id));
    historyList.appendChild(div);
  });
}

// ─── Rendering Results ────────────────────────────────────────────────────────
function renderResults(record) {
  currentContractRecord = record;
  const analysis = record.analysis;
  const meta = record.metadata;

  resultsSub.textContent = `Archivo: ${meta.nombre_archivo} · Tamaño: ${fmt.bytes(meta.tamaño)}`;
  contractType.textContent = analysis.tipo_contrato || "Contrato no especificado";
  summaryText.textContent = analysis.resumen || "Sin resumen disponible.";

  // Chips
  partesChips.innerHTML = (analysis.partes || []).map(p => `<span class="chip">${p}</span>`).join("");
  
  // Cláusulas
  const clauses = analysis.clausulas || [];
  clausesCount.textContent = clauses.length;
  clauseList.innerHTML = clauses.map((c, i) => `
    <li class="c-item">
      <div class="trace-header">
        <h4 class="c-title">${c.titulo}</h4>
        ${c.pagina ? `<span class="page-badge">📄 ${c.pagina}</span>` : ''}
      </div>
      <p class="c-desc">${c.descripcion}</p>
      ${c.texto_original ? `
        <button class="btn-toggle-text" onclick="document.getElementById('c-orig-${i}').classList.toggle('show')">
          🔍 Ver texto original
        </button>
        <div id="c-orig-${i}" class="original-text-box">${c.texto_original}</div>
      ` : ''}
    </li>
  `).join("");

  // Riesgos
  const risks = analysis.riesgos || [];
  risksCount.textContent = risks.length;
  riskList.innerHTML = risks.map((r, i) => {
    const lvl = (r.nivel || "bajo").toLowerCase();
    return `
      <li class="r-item r-item--${lvl}">
        <div class="trace-header">
          <h4 class="r-title"><span class="r-badge badge-${lvl}">${lvl}</span>${r.titulo}</h4>
          ${r.pagina ? `<span class="page-badge">📄 ${r.pagina}</span>` : ''}
        </div>
        <p class="r-desc">${r.descripcion}</p>
        ${r.texto_original ? `
          <button class="btn-toggle-text" onclick="document.getElementById('r-orig-${i}').classList.toggle('show')">
            🔍 Ver texto original
          </button>
          <div id="r-orig-${i}" class="original-text-box">${r.texto_original}</div>
        ` : ''}
      </li>
    `;
  }).join("");

  // Meta bar
  metaBar.innerHTML = `
    <div class="meta-item"><strong>Analizado:</strong> ${fmt.date(meta.analizado_en)}</div>
    <div class="meta-item"><strong>Tamaño:</strong> ${fmt.bytes(meta.tamaño)}</div>
    <div class="meta-item" style="color: var(--color-success)"><strong>Privacidad:</strong> Temporal (Autodestrucción)</div>
  `;

  // Init Chat
  chatMessages.innerHTML = `
    <div class="chat-msg chat-msg--bot">
      ¡Hola! He leído el contrato "${meta.nombre_archivo}". ¿Qué deseas saber sobre él?
    </div>
  `;
  chatHistory = [];
  chatInput.value = "";
  chatSendBtn.disabled = false;

  showPanel("results");
  loadHistory(); // refresh sidebar highlight
}

// ─── API Calls ────────────────────────────────────────────────────────────────
async function analyzeFile(file) {
  analyzeBtn.disabled = true;
  $("btnText").textContent = "Analizando...";
  
  const formData = new FormData();
  formData.append("contrato", file);

  try {
    const reqPromise = fetch("/api/analyze", { method: "POST", body: formData });
    await simulateProgress(); // min visual wait
    
    const res = await reqPromise;
    const json = await res.json();
    
    if (json.success) {
      saveToHistory(json.data);
      renderResults(json.data);
    } else {
      showPanel("upload");
      showToast(json.error || "Error desconocido");
    }
  } catch (error) {
    showPanel("upload");
    showToast("Error de conexión con el servidor.");
  } finally {
    $("btnText").textContent = "Analizar con IA";
    analyzeBtn.disabled = false;
    document.querySelectorAll(".ps-item").forEach(el => el.classList.remove("active"));
  }
}

// ─── Chat Logic ───────────────────────────────────────────────────────────────
chatInput.addEventListener("input", (e) => {
  chatSendBtn.disabled = e.target.value.trim() === "";
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentContractRecord) return;

  // Add User msg to UI
  const userDiv = document.createElement("div");
  userDiv.className = "chat-msg chat-msg--user";
  userDiv.textContent = text;
  chatMessages.appendChild(userDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Loading indicator
  const botLoading = document.createElement("div");
  botLoading.className = "chat-msg chat-msg--bot";
  botLoading.innerHTML = `<span style="opacity:0.5">Pensando...</span>`;
  chatMessages.appendChild(botLoading);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  chatInput.value = "";
  chatSendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        geminiFileUri: currentContractRecord.geminiFileUri,
        message: text,
        chatHistory: chatHistory
      })
    });
    
    const json = await res.json();
    botLoading.remove();

    if (json.success) {
      const botDiv = document.createElement("div");
      botDiv.className = "chat-msg chat-msg--bot";
      botDiv.innerHTML = json.reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      chatMessages.appendChild(botDiv);
      
      chatHistory.push({ role: "user", text });
      chatHistory.push({ role: "model", text: json.reply });
    } else {
      showToast(json.error || "Error en el chat. Puede que el archivo haya expirado en Google.");
    }
  } catch (error) {
    botLoading.remove();
    showToast("Error de conexión en el chat.");
  } finally {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
});

// ─── Modals Logic ─────────────────────────────────────────────────────────────
document.querySelectorAll('.open-modal').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const modalId = btn.getAttribute('data-modal');
    $(modalId).style.display = 'flex';
  });
});

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').style.display = 'none';
  });
});

// Close modal when clicking outside
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
uploadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (selectedFile) analyzeFile(selectedFile);
});

// Start
loadHistory();
