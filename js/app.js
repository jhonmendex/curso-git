// Controlador principal de Git Lab Interactivo
const MODULES = [
  MODULE_01_BASICS,
  MODULE_02_INSPECT,
  MODULE_03_UNDO,
  MODULE_04_BRANCHES,
  MODULE_05_REWRITE,
  MODULE_06_REMOTES,
];

const STORAGE_KEY = "git_lab_completed_lessons_v1";

const state = {
  view: "lessons", // 'lessons' | 'sandbox' | 'cheatsheet'
  modIdx: 0,
  lessonIdx: 0,
  stepIdx: 0,
  theme: "dark", // 'dark' | 'light'
  completedLessons: new Set(),
  completedSteps: new Set(), // key: `${slug}:${stepIdx}`
  termLogs: [],
  inputHistory: [],
  historyCursor: -1,
  demoTimer: null,
  csQuery: "",
};

const engine = new GitEngine();
let visualizer = null;
let rebasePlanDraft = [];

// Cargar progreso guardado en localStorage
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      saved.forEach((slug) => state.completedLessons.add(slug));
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.completedLessons]));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

function getFlatLessons() {
  const flat = [];
  MODULES.forEach((mod, mIdx) => {
    mod.lessons.forEach((lesson, lIdx) => {
      flat.push({ mod, lesson, mIdx, lIdx });
    });
  });
  return flat;
}

function getCurrentLesson() {
  return MODULES[state.modIdx].lessons[state.lessonIdx];
}

function getCurrentStep() {
  return getCurrentLesson().steps[state.stepIdx];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTerminalOutput(text) {
  return escapeHtml(text)
    .split("\n")
    .map((line) => {
      if (line.startsWith("+ ") || line.startsWith("+++")) {
        return `<span class="term-out--diff-add">${line}</span>`;
      }
      if (line.startsWith("- ") || line.startsWith("---")) {
        return `<span class="term-out--diff-del">${line}</span>`;
      }
      return line;
    })
    .join("\n");
}

/* ==========================================================================
   SIDEBAR Y PROGRESO
   ========================================================================== */
function renderSidebar() {
  const treeEl = document.getElementById("course-tree");
  if (!treeEl) return;

  treeEl.innerHTML = MODULES.map((mod, mIdx) => {
    const doneInMod = mod.lessons.filter((l) => state.completedLessons.has(l.slug)).length;
    return `
      <section class="mod ${mod.open ? "is-open" : ""}">
        <button class="mod__head" type="button" onclick="toggleModule(${mIdx})">
          <svg class="mod__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <path d="m9 18 6-6-6-6"></path>
          </svg>
          <span class="mod__dot" style="background:${mod.color}"></span>
          <span>${mod.title}</span>
          <span class="mod__count">${doneInMod}/${mod.lessons.length}</span>
        </button>
        <ul class="mod__lessons">
          ${mod.lessons
            .map((l, lIdx) => {
              const isSel =
                state.view === "lessons" &&
                state.modIdx === mIdx &&
                state.lessonIdx === lIdx;
              const isDone = state.completedLessons.has(l.slug);
              return `
                <li>
                  <button class="lesson-btn ${isSel ? "is-selected" : ""}" type="button" onclick="selectLesson(${mIdx}, ${lIdx})">
                    ${
                      isDone
                        ? `<svg class="lesson-btn__mark--done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"></circle><path d="m16 9-5.5 5.5L8 12"></path></svg>`
                        : `<svg class="lesson-btn__mark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle></svg>`
                    }
                    <span><strong style="font-family:var(--mono);opacity:0.75;">${l.num}</strong> · ${l.title}</span>
                  </button>
                </li>
              `;
            })
            .join("")}
        </ul>
      </section>
    `;
  }).join("");

  const total = getFlatLessons().length;
  const done = state.completedLessons.size;
  const countEl = document.getElementById("lessons-count");
  if (countEl) countEl.textContent = `${total} lecciones`;
  const progText = document.getElementById("progress-text");
  if (progText) progText.textContent = `${done} / ${total}`;
  const progFill = document.getElementById("progress-fill");
  if (progFill) progFill.style.width = `${Math.round((done / total) * 100)}%`;
}

function toggleModule(mIdx) {
  MODULES[mIdx].open = !MODULES[mIdx].open;
  renderSidebar();
}

function selectLesson(mIdx, lIdx, stepIdx = 0) {
  stopDemo();
  state.view = "lessons";
  state.modIdx = mIdx;
  state.lessonIdx = lIdx;
  state.stepIdx = stepIdx;
  MODULES[mIdx].open = true;
  state.termLogs = [];
  loadStepState(true);
  updateTopTabs();
  renderSidebar();
  renderMain();
}

function jumpToLessonBySlug(slug) {
  const flat = getFlatLessons();
  const match = flat.find((item) => item.lesson.slug === slug);
  if (match) {
    selectLesson(match.mIdx, match.lIdx, 0);
  }
}

// Carga el estado del motor Git correspondiente al paso actual
function loadStepState(forceSetup = false) {
  const lesson = getCurrentLesson();
  const step = lesson.steps[state.stepIdx];
  if (step.setup) {
    engine.loadSnapshot(step.setup);
    return;
  }
  // Si el paso no define setup propio y se fuerza reinicio, buscar el último setup anterior
  if (forceSetup) {
    let lastSetup = null;
    for (let i = 0; i <= state.stepIdx; i++) {
      if (lesson.steps[i].setup) lastSetup = lesson.steps[i].setup;
    }
    if (lastSetup) engine.loadSnapshot(lastSetup);
  }
}

/* ==========================================================================
   RENDERIZADO DE VISTAS PRINCIPALES
   ========================================================================== */
function renderMain() {
  const mount = document.getElementById("main-mount");
  if (!mount) return;

  if (state.view === "lessons") {
    renderLessonView(mount);
  } else if (state.view === "sandbox") {
    renderSandboxView(mount);
  } else if (state.view === "cheatsheet") {
    renderCheatsheetView(mount);
  }
}

function renderLessonView(mount) {
  const lesson = getCurrentLesson();
  const step = getCurrentStep();
  const stepKey = `${lesson.slug}:${state.stepIdx}`;
  const isStepDone = state.completedSteps.has(stepKey);
  const flat = getFlatLessons();
  const flatIdx = flat.findIndex((f) => f.lesson.slug === lesson.slug);
  const hasNextStep = state.stepIdx < lesson.steps.length - 1;
  const hasNextLesson = flatIdx < flat.length - 1;

  mount.innerHTML = `
    <div class="lesson-shell">
      <div class="lesson-header">
        <div>
          <div class="lesson-header__meta">
            <span class="lesson-pill">${lesson.level}</span>
            <span class="lesson-subtitle">Lección ${lesson.num} · Paso ${state.stepIdx + 1} de ${lesson.steps.length}</span>
          </div>
          <div class="lesson-title">${lesson.title}</div>
        </div>
        <div class="lesson-actions">
          <button class="btn btn--primary" type="button" id="btn-demo" title="Ver animación paso a paso">
            ▶ Ver Demo Animada
          </button>
          <button class="btn btn--ghost" type="button" id="btn-reset-step" title="Reiniciar estado de este paso">
            ↺ Reiniciar
          </button>
        </div>
      </div>

      <div class="stage-col">
        <div class="git-canvas-wrap">
          <div class="canvas-toolbar">
            <div class="canvas-badges" id="canvas-badges"></div>
          </div>
          <svg class="git-svg" id="git-svg"></svg>
          <div class="commit-tooltip" id="commit-tooltip"></div>
        </div>

        <div class="trees-strip" id="trees-strip"></div>

        <div class="terminal-panel">
          <div class="terminal-panel__head">
            <div class="terminal-dots"><span></span><span></span><span></span></div>
            <span>Terminal Git Interactiva · escribe un comando y pulsa Enter</span>
            <button class="icon-btn" style="height:20px;font-size:10px;" type="button" id="btn-clear-term">Limpiar</button>
          </div>
          <div class="terminal-output" id="terminal-output"></div>
          <div class="terminal-input-row">
            <span class="terminal-prompt" id="terminal-prompt">${getPromptLabel()}</span>
            <input
              class="terminal-input"
              id="terminal-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="Ej: ${escapeHtml(step.demoCommand)}"
            />
          </div>
        </div>
      </div>

      <aside class="guide-panel">
        <div class="guide-panel__scroll">
          <div class="step-indicator">
            <span>Paso ${state.stepIdx + 1} / ${lesson.steps.length}</span>
            <div class="step-dots">
              ${lesson.steps
                .map((_, i) => {
                  const done = state.completedSteps.has(`${lesson.slug}:${i}`);
                  return `<button class="step-dot ${i === state.stepIdx ? "is-current" : ""} ${
                    done ? "is-done" : ""
                  }" type="button" title="Ir al paso ${i + 1}" onclick="goToStep(${i})"></button>`;
                })
                .join("")}
            </div>
          </div>

          <h2 class="guide-title">${step.title}</h2>
          <div class="guide-body">${step.body}</div>

          <div class="syntax-card">
            <div class="syntax-card__label">Sintaxis (Hoja de Trucos)</div>
            <div class="syntax-card__code">${escapeHtml(step.syntax)}</div>
          </div>

          <div class="mission-box ${isStepDone ? "is-completed" : ""}">
            <div class="mission-box__head">
              <span>${isStepDone ? "✓ ¡Misión completada!" : "🎯 Tu misión ahora"}</span>
            </div>
            <div class="mission-box__text">${step.mission}</div>
            <div class="hint-chips">
              ${(step.hints || [])
                .map(
                  (h) =>
                    `<button class="hint-chip" type="button" title="Clic para rellenar en terminal" onclick="fillTerminal('${h.replace(/'/g, "\\'")}')">${escapeHtml(h)}</button>`
                )
                .join("")}
            </div>
          </div>

          <div class="callout-tip">
            <strong>💡 Consejo práctico</strong>
            ${step.tip}
          </div>
        </div>

        <div class="guide-footer">
          <button class="btn btn--ghost" type="button" ${state.stepIdx === 0 ? "disabled" : ""} onclick="prevStep()">
            ← Anterior
          </button>
          ${
            hasNextStep
              ? `<button class="btn ${isStepDone ? "btn--ok" : "btn--primary"}" type="button" onclick="nextStep()">
                   Siguiente paso →
                 </button>`
              : hasNextLesson
              ? `<button class="btn ${isStepDone ? "btn--ok" : "btn--primary"}" type="button" onclick="nextLesson()">
                   Siguiente lección →
                 </button>`
              : `<button class="btn btn--ok" type="button" onclick="switchView('sandbox')">
                   Ir al Sandbox Libre →
                 </button>`
          }
        </div>
      </aside>

      <div class="stepper-bar">
        <span class="stepper-bar__hint">
          Pasa el ratón sobre cualquier nodo <strong>C0, C1…</strong> para inspeccionar su hash y mensaje · Usa <code>↑</code>/<code>↓</code> para historial
        </span>
        <span class="stepper-bar__hint" style="font-family:var(--mono);">
          ${lesson.num} / ${flat.length}
        </span>
      </div>
    </div>
  `;

  initCanvasAndTerminal();
  document.getElementById("btn-demo")?.addEventListener("click", runStepDemo);
  document.getElementById("btn-reset-step")?.addEventListener("click", () => {
    stopDemo();
    loadStepState(true);
    state.termLogs.push({
      cmd: "",
      output: "↺ Estado del paso reiniciado.",
      type: "warn",
    });
    refreshVisuals();
  });
}

function renderSandboxView(mount) {
  mount.innerHTML = `
    <div class="lesson-shell" style="grid-template-columns: 1fr 310px;">
      <div class="lesson-header">
        <div>
          <div class="lesson-header__meta">
            <span class="lesson-pill">SANDBOX LIBRE</span>
            <span class="lesson-subtitle">Practica cualquier combinación de comandos de la hoja de trucos</span>
          </div>
          <div class="lesson-title">Laboratorio Libre de Git</div>
        </div>
        <div class="lesson-actions">
          <button class="btn btn--ghost" type="button" onclick="sandboxPreset('branches')">Escenario Ramas</button>
          <button class="btn btn--ghost" type="button" onclick="sandboxPreset('remotes')">Escenario Remotos</button>
          <button class="btn btn--ghost" type="button" onclick="sandboxPreset('clean')">↺ Reiniciar</button>
        </div>
      </div>

      <div class="stage-col">
        <div class="git-canvas-wrap">
          <div class="canvas-toolbar">
            <div class="canvas-badges" id="canvas-badges"></div>
          </div>
          <svg class="git-svg" id="git-svg"></svg>
          <div class="commit-tooltip" id="commit-tooltip"></div>
        </div>

        <div class="trees-strip" id="trees-strip"></div>

        <div class="terminal-panel">
          <div class="terminal-panel__head">
            <div class="terminal-dots"><span></span><span></span><span></span></div>
            <span>Sandbox Git · escribe 'help' para ver todos los comandos</span>
            <button class="icon-btn" style="height:20px;font-size:10px;" type="button" id="btn-clear-term">Limpiar</button>
          </div>
          <div class="terminal-output" id="terminal-output"></div>
          <div class="terminal-input-row">
            <span class="terminal-prompt" id="terminal-prompt">${getPromptLabel()}</span>
            <input
              class="terminal-input"
              id="terminal-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="Ej: git checkout -b feat && git commit -m 'hola'"
            />
          </div>
        </div>
      </div>

      <aside class="guide-panel">
        <div class="guide-panel__scroll">
          <h2 class="guide-title">Atajos rápidos del Sandbox</h2>
          <div class="guide-body">
            <p>Haz clic en cualquier chip para ejecutar o probar rápidamente en el grafo:</p>
          </div>
          <div class="hint-chips">
            <button class="hint-chip" type="button" onclick="runQuickCommand('touch app.js')">touch app.js</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git add .')">git add .</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git commit -m \\'feat: nuevo cambio\\'')">git commit</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git checkout -b feature')">checkout -b feature</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git checkout main')">checkout main</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git merge feature')">git merge feature</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git rebase main')">git rebase main</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git tag v1.0')">git tag v1.0</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git reflog')">git reflog</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git fetch origin')">git fetch origin</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git pull --rebase origin')">pull --rebase</button>
            <button class="hint-chip" type="button" onclick="runQuickCommand('git push origin main')">push origin main</button>
          </div>
          <div class="callout-tip">
            <strong>Experimenta sin miedo</strong>
            Todo corre en memoria dentro del navegador. Puedes probar <code>git reset --hard</code>, <code>git rebase -i</code> o <code>git push --force</code> y observar el efecto en vivo.
          </div>
        </div>
      </aside>

      <div class="stepper-bar">
        <span class="stepper-bar__hint">Tip: usa <code>touch archivo.js</code> y <code>edit archivo.js</code> para simular cambios en el Working Directory.</span>
      </div>
    </div>
  `;

  initCanvasAndTerminal();
}

function sandboxPreset(kind) {
  state.termLogs = [];
  if (kind === "remotes") {
    engine.loadSnapshot({
      initialized: true,
      commits: [
        { id: "C0", parents: [], message: "chore: init" },
        { id: "C1", parents: ["C0"], message: "feat: base" },
        { id: "C3", parents: ["C1"], message: "feat: trabajo local" },
      ],
      branches: { main: "C3" },
      head: { type: "branch", ref: "main" },
      remoteRefs: { "origin/main": "C1" },
      remotes: {
        origin: {
          url: "https://github.com/equipo/sandbox.git",
          branches: { main: "C2" },
          commits: [
            { id: "C0", parents: [], message: "chore: init" },
            { id: "C1", parents: ["C0"], message: "feat: base" },
            { id: "C2", parents: ["C1"], message: "fix: cambio remoto" },
          ],
          tags: {},
        },
      },
    });
  } else if (kind === "branches") {
    engine.loadSnapshot({
      initialized: true,
      commits: [
        { id: "C0", parents: [], message: "chore: init" },
        { id: "C1", parents: ["C0"], message: "feat: core" },
        { id: "C2", parents: ["C1"], message: "feat: ui" },
        { id: "C3", parents: ["C1"], message: "fix: hotfix" },
      ],
      branches: { main: "C3", feature: "C2" },
      head: { type: "branch", ref: "feature" },
    });
  } else {
    engine.loadSnapshot({
      initialized: true,
      commits: [{ id: "C0", parents: [], message: "chore: initial commit" }],
      branches: { main: "C0" },
      head: { type: "branch", ref: "main" },
    });
  }
  refreshVisuals();
}

function renderCheatsheetView(mount) {
  const q = state.csQuery.trim().toLowerCase();
  const filteredSections = CHEATSHEET_SECTIONS.map((sec) => ({
    title: sec.title,
    items: sec.items.filter(
      (it) =>
        !q ||
        it.cmd.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q) ||
        sec.title.toLowerCase().includes(q)
    ),
  })).filter((sec) => sec.items.length > 0);

  mount.innerHTML = `
    <div class="cheatsheet-view">
      <div class="cheatsheet-header">
        <div>
          <h1>Hoja de Trucos de Git (Atlassian Cheat Sheet)</h1>
          <p>Todos los comandos de las páginas 1 y 2 de <code>trucosGIt.pdf</code> con acceso directo a su lección práctica.</p>
        </div>
        <input
          class="cheatsheet-filter"
          id="cs-filter-input"
          type="text"
          value="${escapeHtml(state.csQuery)}"
          placeholder="Filtrar comando (ej: rebase, reset, log)..."
        />
      </div>
      <div class="cheatsheet-grid">
        ${filteredSections
          .map(
            (sec) => `
            <article class="cs-card">
              <div class="cs-card__head">${sec.title}</div>
              ${sec.items
                .map(
                  (it) => `
                  <div class="cs-row">
                    <div class="cs-row__top">
                      <span class="cs-row__cmd">${escapeHtml(it.cmd)}</span>
                      <button class="cs-practice-btn" type="button" onclick="jumpToLessonBySlug('${it.lessonSlug}')">
                        Practicar →
                      </button>
                    </div>
                    <div class="cs-row__desc">${it.desc}</div>
                  </div>
                `
                )
                .join("")}
            </article>
          `
          )
          .join("")}
      </div>
    </div>
  `;

  const filterInput = document.getElementById("cs-filter-input");
  if (filterInput) {
    filterInput.focus();
    filterInput.setSelectionRange(filterInput.value.length, filterInput.value.length);
    filterInput.addEventListener("input", (e) => {
      state.csQuery = e.target.value;
      renderCheatsheetView(mount);
    });
  }
}

/* ==========================================================================
   TERMINAL Y ACTUALIZACIÓN DEL VISUALIZADOR
   ========================================================================== */
function getPromptLabel() {
  if (!engine.initialized) return "dev@git-lab:~$";
  const ref =
    engine.head.type === "branch" ? engine.head.ref : `detached:${engine.head.ref}`;
  return `dev@git-lab (${ref})$`;
}

function initCanvasAndTerminal() {
  visualizer = new GitVisualizer(
    document.getElementById("git-svg"),
    document.getElementById("trees-strip"),
    document.getElementById("canvas-badges"),
    document.getElementById("commit-tooltip")
  );
  refreshVisuals();

  const inputEl = document.getElementById("terminal-input");
  if (inputEl) {
    inputEl.focus();
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const cmd = inputEl.value.trim();
        inputEl.value = "";
        if (cmd) handleCommand(cmd);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.inputHistory.length > 0) {
          state.historyCursor = Math.max(0, state.historyCursor - 1);
          inputEl.value = state.inputHistory[state.historyCursor] || "";
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.historyCursor < state.inputHistory.length - 1) {
          state.historyCursor++;
          inputEl.value = state.inputHistory[state.historyCursor] || "";
        } else {
          state.historyCursor = state.inputHistory.length;
          inputEl.value = "";
        }
      }
    });
  }

  document.getElementById("btn-clear-term")?.addEventListener("click", () => {
    state.termLogs = [];
    renderTerminalLogs();
  });
}

function refreshVisuals() {
  if (visualizer) visualizer.render(engine);
  const promptEl = document.getElementById("terminal-prompt");
  if (promptEl) promptEl.textContent = getPromptLabel();
  renderTerminalLogs();
}

function renderTerminalLogs() {
  const outEl = document.getElementById("terminal-output");
  if (!outEl) return;
  if (state.termLogs.length === 0) {
    outEl.innerHTML = `<div class="term-out--info">Listo. Escribe un comando Git abajo o haz clic en un chip de pista para rellenarlo.</div>`;
    return;
  }
  outEl.innerHTML = state.termLogs
    .map((entry) => {
      const cmdHtml = entry.cmd
        ? `<div class="term-cmd"><span class="term-cmd__prompt">$</span>${escapeHtml(entry.cmd)}</div>`
        : "";
      const outHtml = entry.output
        ? `<div class="term-out--${entry.type || "info"}">${formatTerminalOutput(entry.output)}</div>`
        : "";
      return `<div class="term-entry">${cmdHtml}${outHtml}</div>`;
    })
    .join("");
  outEl.scrollTop = outEl.scrollHeight;
}

function fillTerminal(cmd) {
  const inputEl = document.getElementById("terminal-input");
  if (inputEl) {
    inputEl.value = cmd;
    inputEl.focus();
  }
}

function runQuickCommand(cmd) {
  handleCommand(cmd);
}

function handleCommand(rawCmd) {
  if (rawCmd === "clear") {
    state.termLogs = [];
    renderTerminalLogs();
    return;
  }

  state.inputHistory.push(rawCmd);
  state.historyCursor = state.inputHistory.length;

  const res = engine.execute(rawCmd);
  state.termLogs.push({ cmd: rawCmd, output: res.output, type: res.type });

  if (res.interactiveRebase) {
    openRebaseModal(res.interactiveRebase);
  }

  refreshVisuals();

  if (state.view === "lessons") {
    checkStepCompletion(res);
  }
}

function checkStepCompletion(res) {
  const lesson = getCurrentLesson();
  const step = getCurrentStep();
  const stepKey = `${lesson.slug}:${state.stepIdx}`;

  if (step.validate && step.validate(engine, res)) {
    const wasAlreadyDone = state.completedSteps.has(stepKey);
    state.completedSteps.add(stepKey);

    // Verificar si se completaron todos los pasos de la lección
    const allDone = lesson.steps.every((_, i) =>
      state.completedSteps.has(`${lesson.slug}:${i}`)
    );
    if (allDone) {
      state.completedLessons.add(lesson.slug);
      saveProgress();
    }

    if (!wasAlreadyDone) {
      state.termLogs.push({
        cmd: "",
        output: "✓ ¡Excelente! Paso completado correctamente.",
        type: "ok",
      });
    }
    renderSidebar();
    renderMain();
  }
}

/* ==========================================================================
   DEMO ANIMADA (ESCRIBE Y EJECUTA EL COMANDO AUTOMÁTICAMENTE)
   ========================================================================== */
function stopDemo() {
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
  }
}

function runStepDemo() {
  stopDemo();
  const step = getCurrentStep();
  const inputEl = document.getElementById("terminal-input");
  if (!step || !step.demoCommand || !inputEl) return;

  const target = step.demoCommand;
  let idx = 0;
  inputEl.value = "";
  inputEl.focus();

  state.demoTimer = setInterval(() => {
    idx++;
    inputEl.value = target.slice(0, idx);
    if (idx >= target.length) {
      stopDemo();
      setTimeout(() => {
        inputEl.value = "";
        handleCommand(target);
      }, 280);
    }
  }, 42);
}

/* ==========================================================================
   NAVEGACIÓN DE PASOS Y LECCIONES
   ========================================================================== */
function goToStep(idx) {
  stopDemo();
  state.stepIdx = idx;
  loadStepState(false);
  renderMain();
}

function prevStep() {
  if (state.stepIdx > 0) {
    goToStep(state.stepIdx - 1);
  }
}

function nextStep() {
  const lesson = getCurrentLesson();
  if (state.stepIdx < lesson.steps.length - 1) {
    goToStep(state.stepIdx + 1);
  }
}

function nextLesson() {
  const flat = getFlatLessons();
  const curIdx = flat.findIndex((f) => f.lesson.slug === getCurrentLesson().slug);
  if (curIdx >= 0 && curIdx < flat.length - 1) {
    const next = flat[curIdx + 1];
    selectLesson(next.mIdx, next.lIdx, 0);
  }
}

/* ==========================================================================
   MODAL DE REBASE INTERACTIVO (git rebase -i)
   ========================================================================== */
function openRebaseModal(info) {
  rebasePlanDraft = info.commits.map((c) => ({ ...c }));
  const subEl = document.getElementById("rebase-modal-sub");
  if (subEl) subEl.textContent = `Rebase interactivo sobre ${info.baseRef} (${info.baseId})`;
  renderRebaseDraft();
  document.getElementById("rebase-modal")?.classList.add("is-open");
}

function renderRebaseDraft() {
  const listEl = document.getElementById("rebase-list");
  if (!listEl) return;
  listEl.innerHTML = rebasePlanDraft
    .map(
      (item, idx) => `
      <div class="rebase-item">
        <select onchange="updateRebaseAction(${idx}, this.value)">
          <option value="pick" ${item.action === "pick" ? "selected" : ""}>pick</option>
          <option value="squash" ${item.action === "squash" ? "selected" : ""} ${idx === 0 ? "disabled" : ""}>squash</option>
          <option value="drop" ${item.action === "drop" ? "selected" : ""}>drop</option>
        </select>
        <strong style="color:var(--info);">${item.id}</strong>
        <span class="rebase-item__msg">${escapeHtml(item.message)}</span>
        <button class="icon-btn" type="button" ${idx === 0 ? "disabled" : ""} onclick="moveRebaseItem(${idx}, -1)">↑</button>
        <button class="icon-btn" type="button" ${idx === rebasePlanDraft.length - 1 ? "disabled" : ""} onclick="moveRebaseItem(${idx}, 1)">↓</button>
      </div>
    `
    )
    .join("");
}

function updateRebaseAction(idx, action) {
  rebasePlanDraft[idx].action = action;
}

function moveRebaseItem(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= rebasePlanDraft.length) return;
  const tmp = rebasePlanDraft[idx];
  rebasePlanDraft[idx] = rebasePlanDraft[target];
  rebasePlanDraft[target] = tmp;
  if (rebasePlanDraft[0].action === "squash") rebasePlanDraft[0].action = "pick";
  renderRebaseDraft();
}

function closeRebaseModal() {
  document.getElementById("rebase-modal")?.classList.remove("is-open");
  engine.pendingInteractiveRebase = null;
}

function confirmInteractiveRebase() {
  if (!engine.pendingInteractiveRebase) return closeRebaseModal();
  const baseId = engine.pendingInteractiveRebase.baseId;
  const res = engine.applyRebasePlan(baseId, rebasePlanDraft, "git rebase -i");
  document.getElementById("rebase-modal")?.classList.remove("is-open");
  state.termLogs.push({ cmd: "(rebase -i aplicado)", output: res.output, type: res.type });
  refreshVisuals();
  if (state.view === "lessons") {
    checkStepCompletion(res);
  }
}

/* ==========================================================================
   VISTAS, TEMA Y BUSCADOR (⌘K / Ctrl+K)
   ========================================================================== */
function updateTopTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === state.view);
  });
}

function switchView(view) {
  stopDemo();
  state.view = view;
  if (view === "sandbox") {
    state.termLogs = [];
    sandboxPreset("branches");
  } else if (view === "lessons") {
    loadStepState(true);
  }
  updateTopTabs();
  renderSidebar();
  renderMain();
}

function openSearchModal() {
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  if (!modal || !input) return;
  modal.classList.add("is-open");
  input.value = "";
  renderSearchResults("");
  input.focus();
}

function closeSearchModal() {
  document.getElementById("search-modal")?.classList.remove("is-open");
}

function renderSearchResults(query) {
  const resEl = document.getElementById("search-results");
  if (!resEl) return;
  const q = query.trim().toLowerCase();
  const matches = [];

  CHEATSHEET_SECTIONS.forEach((sec) => {
    sec.items.forEach((it) => {
      if (!q || it.cmd.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)) {
        matches.push({ cmd: it.cmd, desc: it.desc, slug: it.lessonSlug });
      }
    });
  });

  resEl.innerHTML =
    matches
      .slice(0, 12)
      .map(
        (m) => `
      <button class="search-item" type="button" onclick="closeSearchModal(); jumpToLessonBySlug('${m.slug}')">
        <span class="search-item__cmd">${escapeHtml(m.cmd)}</span>
        <span class="search-item__sub">${m.desc}</span>
      </button>
    `
      )
      .join("") || `<div class="search-item__sub" style="padding:12px;">Sin coincidencias para "${escapeHtml(query)}".</div>`;
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "");
  const iconEl = document.getElementById("theme-icon");
  if (iconEl) iconEl.textContent = state.theme === "dark" ? "🌙" : "☀️";
}

/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  loadProgress();

  // Botones de navegación superior
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    const ws = document.getElementById("workspace");
    if (window.innerWidth <= 1020) {
      ws?.classList.toggle("sidebar-open-mobile");
    } else {
      ws?.classList.toggle("sidebar-collapsed");
    }
  });

  document.getElementById("btn-theme")?.addEventListener("click", toggleTheme);
  document.getElementById("btn-open-search")?.addEventListener("click", openSearchModal);
  document.getElementById("search-close")?.addEventListener("click", closeSearchModal);
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    renderSearchResults(e.target.value);
  });
  document.getElementById("search-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "search-modal") closeSearchModal();
  });

  // Eventos del modal de rebase interactivo
  document.getElementById("rebase-cancel")?.addEventListener("click", closeRebaseModal);
  document.getElementById("rebase-cancel-btn")?.addEventListener("click", closeRebaseModal);
  document.getElementById("rebase-confirm-btn")?.addEventListener("click", confirmInteractiveRebase);

  // Atajos de teclado globales
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === "Escape") {
      closeSearchModal();
      closeRebaseModal();
    }
  });

  // Iniciar en la primera lección
  loadStepState(true);
  renderSidebar();
  renderMain();
});
