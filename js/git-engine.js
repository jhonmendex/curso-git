// Motor de simulación de Git en memoria para practicar todos los comandos de la Hoja de Trucos
class GitEngine {
  constructor() {
    this.resetEmpty();
  }

  // Inicializa un estado limpio (sin repositorio aún)
  resetEmpty() {
    this.initialized = false;
    this.repoName = "mi-proyecto";
    this.commits = {}; // id -> { id, hash, parents: [], message, author, email, date, files: {}, diffLines: [] }
    this.commitOrder = []; // orden cronológico de creación
    this.nextCommitNum = 0;
    this.branches = {}; // branchName -> commitId
    this.head = { type: "branch", ref: "main" }; // type: 'branch' | 'detached'
    this.tags = {}; // tagName -> commitId
    this.workingDir = {}; // filename -> { content, status: 'untracked'|'modified'|'clean' }
    this.staging = {}; // filename -> { content }
    this.config = {
      "user.name": "Dev Student",
      "user.email": "dev@example.com",
      "core.editor": "vim",
      aliases: {},
    };
    this.remotes = {}; // remoteName -> { url, branches: {}, commits: {}, tags: {} }
    this.remoteRefs = {}; // "origin/main" -> commitId
    this.reflog = []; // [{ headId, action, message, date }]
    this.commandHistory = [];
    this.lastEvent = null; // metadatos para animar en GitVisualizer
    this.pendingInteractiveRebase = null;
  }

  // Crea un repositorio listo con commits y estado opcional
  loadSnapshot(snapshot) {
    this.resetEmpty();
    if (!snapshot) return;

    this.initialized = snapshot.initialized !== false;
    this.repoName = snapshot.repoName || "mi-proyecto";
    if (snapshot.config) {
      this.config = {
        ...this.config,
        ...snapshot.config,
        aliases: { ...(snapshot.config.aliases || {}) },
      };
    }

    if (snapshot.commits) {
      for (const c of snapshot.commits) {
        this.commits[c.id] = {
          id: c.id,
          hash: c.hash || this.makeHash(c.id),
          parents: [...(c.parents || [])],
          message: c.message || "commit",
          author: c.author || this.config["user.name"],
          email: c.email || this.config["user.email"],
          date: c.date || "hace 2 horas",
          files: { ...(c.files || { "app.js": "console.log('v1');" }) },
          diffLines: c.diffLines || [`+ // ${c.message || c.id}`],
        };
        this.commitOrder.push(c.id);
        const num = parseInt(String(c.id).replace(/\D/g, ""), 10);
        if (!Number.isNaN(num) && num >= this.nextCommitNum) {
          this.nextCommitNum = num + 1;
        }
      }
    }

    this.branches = { ...(snapshot.branches || {}) };
    this.head = snapshot.head
      ? { ...snapshot.head }
      : { type: "branch", ref: "main" };
    this.tags = { ...(snapshot.tags || {}) };
    this.workingDir = {};
    if (snapshot.workingDir) {
      for (const [k, v] of Object.entries(snapshot.workingDir)) {
        this.workingDir[k] = { ...v };
      }
    }
    this.staging = {};
    if (snapshot.staging) {
      for (const [k, v] of Object.entries(snapshot.staging)) {
        this.staging[k] = { ...v };
      }
    }
    this.remotes = {};
    if (snapshot.remotes) {
      for (const [rName, rData] of Object.entries(snapshot.remotes)) {
        const clonedCommits = {};
        for (const c of rData.commits || []) {
          clonedCommits[c.id] = {
            id: c.id,
            hash: c.hash || this.makeHash(c.id),
            parents: [...(c.parents || [])],
            message: c.message || "remote commit",
            author: c.author || "Team Mate",
            email: c.email || "team@example.com",
            date: c.date || "hace 1 hora",
            files: { ...(c.files || { "app.js": "// remote" }) },
            diffLines: c.diffLines || [`+ // ${c.message || c.id}`],
          };
        }
        this.remotes[rName] = {
          url: rData.url || "https://github.com/equipo/repo.git",
          branches: { ...(rData.branches || {}) },
          commits: clonedCommits,
          tags: { ...(rData.tags || {}) },
        };
      }
    }
    this.remoteRefs = { ...(snapshot.remoteRefs || {}) };

    // Inicializar reflog base
    const headId = this.getHeadCommitId();
    if (headId) {
      this.reflog.unshift({
        headId,
        action: "commit (initial)",
        message: this.commits[headId]?.message || "Estado inicial",
        date: "hace 10 min",
      });
    }
  }

  makeHash(seed) {
    let h = 2166136261;
    const str = String(seed) + "_git";
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0).toString(16) + "a9f4c21").slice(0, 7);
  }

  getHeadCommitId() {
    if (!this.initialized) return null;
    if (this.head.type === "detached") return this.head.ref;
    return this.branches[this.head.ref] || null;
  }

  getCurrentBranchName() {
    return this.head.type === "branch" ? this.head.ref : null;
  }

  // Resuelve referencias como HEAD, HEAD~1, main, origin/main, C2, tag o hash
  resolveRef(refStr) {
    if (!refStr) return null;
    const tildeMatch = refStr.match(/^(.+)~(\d+)$/);
    if (tildeMatch) {
      const base = this.resolveRef(tildeMatch[1]);
      const steps = parseInt(tildeMatch[2], 10);
      let curr = base;
      for (let i = 0; i < steps && curr; i++) {
        curr = this.commits[curr]?.parents?.[0] || null;
      }
      return curr;
    }
    if (refStr.endsWith("^")) {
      const base = this.resolveRef(refStr.slice(0, -1));
      return base ? this.commits[base]?.parents?.[0] || null : null;
    }
    if (refStr === "HEAD") return this.getHeadCommitId();
    if (this.branches[refStr]) return this.branches[refStr];
    if (this.remoteRefs[refStr]) return this.remoteRefs[refStr];
    if (this.tags[refStr]) return this.tags[refStr];
    if (this.commits[refStr]) return refStr;
    const upper = refStr.toUpperCase();
    if (this.commits[upper]) return upper;
    for (const c of Object.values(this.commits)) {
      if (c.hash.startsWith(refStr)) return c.id;
    }
    return null;
  }

  // Devuelve el conjunto de commits alcanzables desde ramas, HEAD, tags o remoteRefs
  getReachableCommits() {
    const visited = new Set();
    const stack = [];
    const headId = this.getHeadCommitId();
    if (headId) stack.push(headId);
    Object.values(this.branches).forEach((id) => id && stack.push(id));
    Object.values(this.tags).forEach((id) => id && stack.push(id));
    Object.values(this.remoteRefs).forEach((id) => id && stack.push(id));
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || visited.has(id) || !this.commits[id]) continue;
      visited.add(id);
      for (const p of this.commits[id].parents) {
        if (p) stack.push(p);
      }
    }
    return visited;
  }

  // Verifica si ancId es ancestro de descId
  isAncestor(ancId, descId) {
    if (!ancId || !descId) return false;
    if (ancId === descId) return true;
    const visited = new Set();
    const stack = [descId];
    while (stack.length > 0) {
      const curr = stack.pop();
      if (curr === ancId) return true;
      if (visited.has(curr) || !this.commits[curr]) continue;
      visited.add(curr);
      for (const p of this.commits[curr].parents) {
        if (p) stack.push(p);
      }
    }
    return false;
  }

  // Lista commits en orden desde startId siguiendo el primer padre
  getAncestorsChain(startId, stopSet = new Set()) {
    const chain = [];
    let curr = startId;
    const guard = new Set();
    while (curr && !stopSet.has(curr) && !guard.has(curr) && this.commits[curr]) {
      guard.add(curr);
      chain.push(curr);
      curr = this.commits[curr].parents[0] || null;
    }
    return chain;
  }

  recordReflog(action, message) {
    const headId = this.getHeadCommitId();
    if (!headId) return;
    this.reflog.unshift({
      headId,
      action,
      message: message || this.commits[headId]?.message || "",
      date: "hace unos segundos",
    });
  }

  // Analizador de línea de comandos respetando comillas simples y dobles
  tokenize(input) {
    const tokens = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quote) {
        if (ch === quote) {
          quote = null;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += ch;
      }
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }

  // Punto de entrada principal para ejecutar cualquier comando
  execute(rawCommand) {
    const trimmed = String(rawCommand || "").trim();
    if (!trimmed) return { ok: true, output: "", type: "info", command: "" };

    this.lastEvent = null;
    const tokens = this.tokenize(trimmed);
    const bin = tokens[0];

    // Comandos auxiliares del entorno
    if (bin === "help") {
      return {
        ok: true,
        type: "info",
        command: trimmed,
        output:
          "Comandos disponibles:\n" +
          "  git init | clone | config | add | commit | status | log | diff\n" +
          "  git revert | reset | clean | commit --amend | rebase [-i] | reflog\n" +
          "  git branch | checkout [-b] | merge | tag\n" +
          "  git remote add | fetch | pull [--rebase] | push [--force|--all|--tags]\n" +
          "  Utilidades sandbox: touch <archivo> | edit <archivo> | clear",
      };
    }

    if (bin === "touch" && tokens[1]) {
      const file = tokens[1];
      this.workingDir[file] = {
        content: `// Nuevo archivo ${file}`,
        status: "untracked",
      };
      this.lastEvent = { type: "touch", file };
      return {
        ok: true,
        type: "ok",
        command: trimmed,
        output: `Archivo '${file}' creado en el Working Directory (untracked).`,
      };
    }

    if (bin === "edit" && tokens[1]) {
      const file = tokens[1];
      this.workingDir[file] = {
        content: `// Editado ${file} (${Date.now() % 1000})`,
        status: "modified",
      };
      this.lastEvent = { type: "edit", file };
      return {
        ok: true,
        type: "ok",
        command: trimmed,
        output: `Archivo '${file}' modificado en el Working Directory.`,
      };
    }

    if (bin !== "git") {
      return {
        ok: false,
        type: "err",
        command: trimmed,
        output: `Comando '${bin}' no reconocido. Prueba empezando con 'git ...' o escribe 'help'.`,
      };
    }

    let sub = tokens[1];
    let args = tokens.slice(2);

    if (!sub) {
      return {
        ok: false,
        type: "err",
        command: trimmed,
        output: "Uso: git <comando> [opciones]. Escribe 'help' para ver comandos.",
      };
    }

    // Expandir alias personalizados definidos con git config alias.<name>
    if (this.config.aliases[sub]) {
      const expanded = this.tokenize(this.config.aliases[sub]);
      sub = expanded[0];
      args = [...expanded.slice(1), ...args];
    }

    this.commandHistory.push(trimmed);

    // Comandos permitidos antes de git init
    if (sub === "init") return this.cmdInit(args, trimmed);
    if (sub === "clone") return this.cmdClone(args, trimmed);
    if (sub === "config") return this.cmdConfig(args, trimmed);

    if (!this.initialized) {
      return {
        ok: false,
        type: "err",
        command: trimmed,
        output:
          "fatal: no es un repositorio git (ni ninguno de los directorios superiores). Ejecuta 'git init' o 'git clone <repo>'.",
      };
    }

    switch (sub) {
      case "status":
        return this.cmdStatus(trimmed);
      case "add":
        return this.cmdAdd(args, trimmed);
      case "commit":
        return this.cmdCommit(args, trimmed);
      case "log":
        return this.cmdLog(args, trimmed);
      case "diff":
        return this.cmdDiff(args, trimmed);
      case "revert":
        return this.cmdRevert(args, trimmed);
      case "reset":
        return this.cmdReset(args, trimmed);
      case "clean":
        return this.cmdClean(args, trimmed);
      case "branch":
        return this.cmdBranch(args, trimmed);
      case "checkout":
      case "switch":
        return this.cmdCheckout(args, trimmed);
      case "merge":
        return this.cmdMerge(args, trimmed);
      case "rebase":
        return this.cmdRebase(args, trimmed);
      case "reflog":
        return this.cmdReflog(args, trimmed);
      case "remote":
        return this.cmdRemote(args, trimmed);
      case "fetch":
        return this.cmdFetch(args, trimmed);
      case "pull":
        return this.cmdPull(args, trimmed);
      case "push":
        return this.cmdPush(args, trimmed);
      case "tag":
        return this.cmdTag(args, trimmed);
      default:
        return {
          ok: false,
          type: "err",
          command: trimmed,
          output: `git: '${sub}' no es un comando de git soportado en este laboratorio.`,
        };
    }
  }

  cmdInit(args, raw) {
    const dir = args[0] || ".";
    this.initialized = true;
    this.repoName = dir === "." ? "mi-proyecto" : dir;
    if (!this.branches.main) {
      this.branches.main = null;
      this.head = { type: "branch", ref: "main" };
    }
    this.lastEvent = { type: "init", dir };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Repositorio Git vacío inicializado en ${this.repoName}/.git/`,
    };
  }

  cmdClone(args, raw) {
    const repoUrl = args[0];
    if (!repoUrl) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: "Uso: git clone <repo> (ej: git clone https://github.com/equipo/app.git)",
      };
    }
    const nameMatch = repoUrl.split("/").pop().replace(/\.git$/, "") || "repo";
    this.loadSnapshot({
      initialized: true,
      repoName: nameMatch,
      commits: [
        { id: "C0", parents: [], message: "chore: initial commit", files: { "README.md": "# " + nameMatch } },
        { id: "C1", parents: ["C0"], message: "feat: setup project", files: { "README.md": "# " + nameMatch, "app.js": "init();" } },
      ],
      branches: { main: "C1" },
      head: { type: "branch", ref: "main" },
      remotes: {
        origin: {
          url: repoUrl,
          branches: { main: "C1" },
          commits: [
            { id: "C0", parents: [], message: "chore: initial commit" },
            { id: "C1", parents: ["C0"], message: "feat: setup project" },
          ],
        },
      },
      remoteRefs: { "origin/main": "C1" },
    });
    this.lastEvent = { type: "clone", url: repoUrl };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Clonando en '${nameMatch}'...\nremote: Enumerando objetos: 6, listo.\nRecibiendo objetos: 100% (6/6), listo. Rama 'main' lista.`,
    };
  }

  cmdConfig(args, raw) {
    if (args.includes("--edit") || args.includes("-e")) {
      this.lastEvent = { type: "config", key: "edit" };
      const lines = [
        "[user]",
        `  name = ${this.config["user.name"]}`,
        `  email = ${this.config["user.email"]}`,
        "[core]",
        `  editor = ${this.config["core.editor"]}`,
      ];
      if (Object.keys(this.config.aliases).length > 0) {
        lines.push("[alias]");
        for (const [k, v] of Object.entries(this.config.aliases)) {
          lines.push(`  ${k} = ${v}`);
        }
      }
      return {
        ok: true,
        type: "info",
        command: raw,
        output: `Abriendo ~/.gitconfig en ${this.config["core.editor"]}:\n${lines.join("\n")}`,
      };
    }

    const filtered = args.filter((a) => !["--global", "--system", "--local"].includes(a));
    const key = filtered[0];
    const val = filtered.slice(1).join(" ");

    if (!key) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: "Uso: git config [--global|--system] <clave> <valor>",
      };
    }

    if (!val) {
      if (key.startsWith("alias.")) {
        const aName = key.slice(6);
        return {
          ok: true,
          type: "info",
          command: raw,
          output: this.config.aliases[aName] || "(sin definir)",
        };
      }
      return {
        ok: true,
        type: "info",
        command: raw,
        output: this.config[key] || "(sin definir)",
      };
    }

    if (key.startsWith("alias.")) {
      const aliasName = key.slice(6);
      this.config.aliases[aliasName] = val;
      this.lastEvent = { type: "config", key, val };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Alias creado: 'git ${aliasName}' ahora ejecutará 'git ${val}'.`,
      };
    }

    this.config[key] = val;
    this.lastEvent = { type: "config", key, val };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Configuración actualizada: ${key} = "${val}"`,
    };
  }

  cmdStatus(raw) {
    const branchLabel =
      this.head.type === "branch"
        ? `En la rama ${this.head.ref}`
        : `HEAD desacoplado en ${this.head.ref}`;
    const stagedFiles = Object.keys(this.staging);
    const modifiedFiles = Object.entries(this.workingDir)
      .filter(([, f]) => f.status === "modified")
      .map(([k]) => k);
    const untrackedFiles = Object.entries(this.workingDir)
      .filter(([, f]) => f.status === "untracked")
      .map(([k]) => k);

    const out = [branchLabel];
    if (stagedFiles.length) {
      out.push("\nCambios a ser confirmados (staging):");
      stagedFiles.forEach((f) => out.push(`  staged:     ${f}`));
    }
    if (modifiedFiles.length) {
      out.push("\nCambios no rastreados para el commit (working dir):");
      modifiedFiles.forEach((f) => out.push(`  modified:   ${f}`));
    }
    if (untrackedFiles.length) {
      out.push("\nArchivos sin seguimiento (untracked):");
      untrackedFiles.forEach((f) => out.push(`  untracked:  ${f}`));
    }
    if (!stagedFiles.length && !modifiedFiles.length && !untrackedFiles.length) {
      out.push("nada para hacer commit, el árbol de trabajo está limpio.");
    }
    this.lastEvent = { type: "status" };
    return { ok: true, type: "info", command: raw, output: out.join("\n") };
  }

  cmdAdd(args, raw) {
    const target = args[0];
    if (!target) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: "Especifica un archivo o directorio (ej: git add . o git add app.js).",
      };
    }

    const candidates = Object.entries(this.workingDir).filter(
      ([, f]) => f.status === "untracked" || f.status === "modified"
    );

    const added = [];
    if (target === "." || target === "-A" || target === "--all" || target === "src" || target === "src/") {
      for (const [name, f] of candidates) {
        if (target.startsWith("src") && !name.startsWith("src/")) continue;
        this.staging[name] = { content: f.content };
        this.workingDir[name].status = "clean";
        added.push(name);
      }
    } else if (this.workingDir[target]) {
      this.staging[target] = { content: this.workingDir[target].content };
      this.workingDir[target].status = "clean";
      added.push(target);
    } else {
      // Buscar por prefijo de directorio
      const prefix = target.endsWith("/") ? target : target + "/";
      for (const [name, f] of candidates) {
        if (name.startsWith(prefix)) {
          this.staging[name] = { content: f.content };
          this.workingDir[name].status = "clean";
          added.push(name);
        }
      }
    }

    if (added.length === 0) {
      return {
        ok: false,
        type: "warn",
        command: raw,
        output: `No se encontraron cambios pendientes para '${target}'.`,
      };
    }

    this.lastEvent = { type: "stage", files: added };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Añadido al Staging Area: ${added.join(", ")}`,
    };
  }

  cmdCommit(args, raw) {
    const isAmend = args.includes("--amend");
    let message = null;
    const mIdx = args.indexOf("-m");
    if (mIdx !== -1 && args[mIdx + 1]) {
      message = args[mIdx + 1];
    }

    const stagedKeys = Object.keys(this.staging);
    const parentId = this.getHeadCommitId();

    if (isAmend) {
      if (!parentId) {
        return {
          ok: false,
          type: "err",
          command: raw,
          output: "No existe un commit previo para enmendar.",
        };
      }
      const prev = this.commits[parentId];
      const newId = `C${this.nextCommitNum++}`;
      const newFiles = { ...prev.files };
      stagedKeys.forEach((k) => {
        newFiles[k] = this.staging[k].content;
      });
      this.commits[newId] = {
        id: newId,
        hash: this.makeHash(newId + Date.now()),
        parents: [...prev.parents],
        message: message || prev.message + " (enmendado)",
        author: this.config["user.name"],
        email: this.config["user.email"],
        date: "ahora",
        files: newFiles,
        diffLines: stagedKeys.length
          ? stagedKeys.map((k) => `+ ${k} (incluido en --amend)`)
          : prev.diffLines,
      };
      this.commitOrder.push(newId);
      this.staging = {};
      if (this.head.type === "branch") {
        this.branches[this.head.ref] = newId;
      } else {
        this.head.ref = newId;
      }
      this.recordReflog("commit (amend)", this.commits[newId].message);
      this.lastEvent = { type: "amend", newCommit: newId, oldCommit: parentId };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `[${this.head.ref} ${this.commits[newId].hash}] ${this.commits[newId].message}\n(Reemplazó a ${parentId} con el nuevo commit ${newId})`,
      };
    }

    // Permitir commit rápido en modo práctica si no hay archivos en staging pero sí mensaje (estilo learngitbranching)
    const allowEmptyQuick =
      stagedKeys.length === 0 &&
      Object.values(this.workingDir).every((f) => f.status === "clean");

    if (stagedKeys.length === 0 && !allowEmptyQuick) {
      return {
        ok: false,
        type: "warn",
        command: raw,
        output:
          "No hay cambios en el Staging Area. Usa 'git add <archivo>' o 'git add .' antes de confirmar.",
      };
    }

    const finalMsg = message || `chore: update snapshot ${this.nextCommitNum}`;
    const newId = `C${this.nextCommitNum++}`;
    const baseFiles = parentId ? { ...this.commits[parentId].files } : {};
    stagedKeys.forEach((k) => {
      baseFiles[k] = this.staging[k].content;
    });

    this.commits[newId] = {
      id: newId,
      hash: this.makeHash(newId),
      parents: parentId ? [parentId] : [],
      message: finalMsg,
      author: this.config["user.name"],
      email: this.config["user.email"],
      date: "ahora",
      files: baseFiles,
      diffLines: stagedKeys.length
        ? stagedKeys.map((k) => `+ ${k}: ${this.staging[k].content}`)
        : [`+ // ${finalMsg}`],
    };
    this.commitOrder.push(newId);
    this.staging = {};

    if (this.head.type === "branch") {
      this.branches[this.head.ref] = newId;
    } else {
      this.head.ref = newId;
    }

    this.recordReflog("commit", finalMsg);
    this.lastEvent = { type: "commit", commitId: newId };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `[${this.head.ref} ${this.commits[newId].hash}] ${finalMsg} (${newId})`,
    };
  }

  cmdLog(args, raw) {
    let limit = Infinity;
    let oneline = false;
    let showPatch = false;
    let showStat = false;
    let showGraph = false;
    let showDecorate = false;
    let authorFilter = null;
    let grepFilter = null;
    let fileFilter = null;
    let rangeStart = null;
    let rangeEnd = null;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-\d+$/.test(a)) {
        limit = parseInt(a.slice(1), 10);
      } else if (a === "--oneline") {
        oneline = true;
      } else if (a === "-p" || a === "--patch") {
        showPatch = true;
      } else if (a === "--stat") {
        showStat = true;
      } else if (a === "--graph") {
        showGraph = true;
      } else if (a === "--decorate") {
        showDecorate = true;
      } else if (a.startsWith("--author=")) {
        authorFilter = a.slice("--author=".length).toLowerCase();
      } else if (a === "--author" && args[i + 1]) {
        authorFilter = args[++i].toLowerCase();
      } else if (a.startsWith("--grep=")) {
        grepFilter = a.slice("--grep=".length).toLowerCase();
      } else if (a === "--grep" && args[i + 1]) {
        grepFilter = args[++i].toLowerCase();
      } else if (a === "--" && args[i + 1]) {
        fileFilter = args[++i];
      } else if (a.includes("..")) {
        const [since, until] = a.split("..");
        rangeStart = this.resolveRef(since);
        rangeEnd = this.resolveRef(until || "HEAD");
      }
    }

    const startId = rangeEnd || this.getHeadCommitId();
    if (!startId) {
      return { ok: false, type: "warn", command: raw, output: "La rama actual aún no tiene commits." };
    }

    // Recorrido BFS/orden topológico desde startId
    const excludeSet = new Set();
    if (rangeStart) {
      const exStack = [rangeStart];
      while (exStack.length) {
        const id = exStack.pop();
        if (!id || excludeSet.has(id) || !this.commits[id]) continue;
        excludeSet.add(id);
        this.commits[id].parents.forEach((p) => exStack.push(p));
      }
    }

    const list = [];
    const seen = new Set();
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id) || excludeSet.has(id) || !this.commits[id]) continue;
      seen.add(id);
      list.push(this.commits[id]);
      for (const p of this.commits[id].parents) {
        queue.push(p);
      }
    }

    let filtered = list;
    if (authorFilter) {
      filtered = filtered.filter((c) => c.author.toLowerCase().includes(authorFilter));
    }
    if (grepFilter) {
      filtered = filtered.filter((c) => c.message.toLowerCase().includes(grepFilter));
    }
    if (fileFilter) {
      filtered = filtered.filter(
        (c) =>
          Object.prototype.hasOwnProperty.call(c.files, fileFilter) ||
          c.diffLines.some((l) => l.includes(fileFilter))
      );
    }
    filtered = filtered.slice(0, limit);

    if (filtered.length === 0) {
      return { ok: true, type: "info", command: raw, output: "(sin commits que coincidan con el filtro)" };
    }

    const getDecorations = (id) => {
      const decs = [];
      if (this.head.type === "branch" && this.branches[this.head.ref] === id) {
        decs.push(`HEAD -> ${this.head.ref}`);
      } else if (this.head.type === "detached" && this.head.ref === id) {
        decs.push("HEAD");
      }
      for (const [b, cid] of Object.entries(this.branches)) {
        if (cid === id && !(this.head.type === "branch" && this.head.ref === b)) {
          decs.push(b);
        }
      }
      for (const [t, cid] of Object.entries(this.tags)) {
        if (cid === id) decs.push(`tag: ${t}`);
      }
      return decs.length ? ` (${decs.join(", ")})` : "";
    };

    const lines = filtered.map((c, idx) => {
      const graphPrefix = showGraph ? (c.parents.length > 1 ? "*\\ " : idx === filtered.length - 1 ? "* " : "* ") : "";
      const dec = showDecorate || showGraph ? getDecorations(c.id) : "";
      if (oneline) {
        return `${graphPrefix}${c.hash} [${c.id}]${dec} ${c.message}`;
      }
      let block = `${graphPrefix}commit ${c.hash} (${c.id})${dec}\nAuthor: ${c.author} <${c.email}>\nDate:   ${c.date}\n\n    ${c.message}`;
      if (showStat) {
        const fNames = Object.keys(c.files);
        block += `\n\n ${fNames.join(", ")} | ${c.diffLines.length} +++\n ${fNames.length} archivo(s) cambiado(s)`;
      }
      if (showPatch) {
        block += `\n\n${c.diffLines.join("\n")}`;
      }
      return block;
    });

    this.lastEvent = { type: "log", count: filtered.length };
    return { ok: true, type: "info", command: raw, output: lines.join(oneline ? "\n" : "\n\n") };
  }

  cmdDiff(args, raw) {
    const cached = args.includes("--cached") || args.includes("--staged");
    const againstHead = args.includes("HEAD");
    const out = [];

    if (cached) {
      const stagedEntries = Object.entries(this.staging);
      if (!stagedEntries.length) {
        return { ok: true, type: "info", command: raw, output: "(sin cambios en staging respecto al último commit)" };
      }
      for (const [file, data] of stagedEntries) {
        out.push(`diff --git a/${file} b/${file} (STAGED)`);
        out.push(`--- a/${file}`);
        out.push(`+++ b/${file}`);
        out.push(`+ ${data.content}`);
      }
    } else if (againstHead) {
      const allChanged = [
        ...Object.entries(this.staging).map(([k, v]) => [k, v.content, "staged"]),
        ...Object.entries(this.workingDir)
          .filter(([, f]) => f.status !== "clean")
          .map(([k, v]) => [k, v.content, v.status]),
      ];
      if (!allChanged.length) {
        return { ok: true, type: "info", command: raw, output: "(working directory idéntico a HEAD)" };
      }
      for (const [file, content, st] of allChanged) {
        out.push(`diff --git a/${file} b/${file} (${st} vs HEAD)`);
        out.push(`- // versión previa en HEAD`);
        out.push(`+ ${content}`);
      }
    } else {
      const unstaged = Object.entries(this.workingDir).filter(([, f]) => f.status === "modified");
      if (!unstaged.length) {
        return {
          ok: true,
          type: "info",
          command: raw,
          output: "(sin diferencias sin preparar entre Working Directory e Index)",
        };
      }
      for (const [file, f] of unstaged) {
        out.push(`diff --git a/${file} b/${file}`);
        out.push(`- // contenido anterior en index`);
        out.push(`+ ${f.content}`);
      }
    }

    this.lastEvent = { type: "diff", mode: cached ? "cached" : againstHead ? "head" : "working" };
    return { ok: true, type: "info", command: raw, output: out.join("\n") };
  }

  cmdRevert(args, raw) {
    const targetRef = args[0];
    const targetId = this.resolveRef(targetRef);
    if (!targetId || !this.commits[targetId]) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `No se encontró el commit '${targetRef || ""}'. Ejemplo: git revert C2`,
      };
    }
    const target = this.commits[targetId];
    const parentId = this.getHeadCommitId();
    const newId = `C${this.nextCommitNum++}`;
    this.commits[newId] = {
      id: newId,
      hash: this.makeHash(newId + "rev"),
      parents: parentId ? [parentId] : [],
      message: `Revert "${target.message}"`,
      author: this.config["user.name"],
      email: this.config["user.email"],
      date: "ahora",
      files: { ...(this.commits[parentId]?.files || {}) },
      diffLines: [`- // revertido ${target.id}: ${target.message}`],
    };
    this.commitOrder.push(newId);
    if (this.head.type === "branch") {
      this.branches[this.head.ref] = newId;
    } else {
      this.head.ref = newId;
    }
    this.recordReflog("revert", `Revert "${target.message}"`);
    this.lastEvent = { type: "revert", commitId: newId, reverted: targetId };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `[${this.head.ref} ${this.commits[newId].hash}] Revert "${target.message}" (${newId})\nHistorial preservado de forma segura.`,
    };
  }

  cmdReset(args, raw) {
    const isHard = args.includes("--hard");
    const positional = args.filter((a) => !a.startsWith("-"));
    const target = positional[0];

    // Caso 1: git reset <file> (sacar un archivo del staging)
    if (target && !isHard && this.staging[target]) {
      const content = this.staging[target].content;
      delete this.staging[target];
      this.workingDir[target] = { content, status: "modified" };
      this.lastEvent = { type: "unstage", file: target };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Archivo '${target}' retirado del Staging Area (los cambios siguen en tu Working Directory).`,
      };
    }

    // Caso 2: git reset (sin argumentos) -> limpia staging pero conserva workingDir
    if (!target && !isHard) {
      const keys = Object.keys(this.staging);
      for (const k of keys) {
        this.workingDir[k] = { content: this.staging[k].content, status: "modified" };
      }
      this.staging = {};
      this.lastEvent = { type: "reset", mode: "mixed" };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: keys.length
          ? `Staging Area reiniciado. Cambios sin preparar: ${keys.join(", ")}`
          : "Staging Area ya estaba limpio.",
      };
    }

    // Caso 3: git reset --hard (sin commit) -> borra staging y workingDir
    if (!target && isHard) {
      this.staging = {};
      for (const [k, f] of Object.entries(this.workingDir)) {
        if (f.status === "modified") {
          this.workingDir[k].status = "clean";
        }
      }
      const headId = this.getHeadCommitId();
      this.lastEvent = { type: "reset", mode: "hard", target: headId };
      return {
        ok: true,
        type: "warn",
        command: raw,
        output: `HEAD está ahora en ${headId}. Staging y Working Directory restaurados (cambios locales descartados).`,
      };
    }

    // Caso 4: git reset [--hard] <commit>
    const commitId = this.resolveRef(target);
    if (!commitId) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `Referencia o archivo '${target}' no encontrado.`,
      };
    }

    if (this.head.type === "branch") {
      this.branches[this.head.ref] = commitId;
    } else {
      this.head.ref = commitId;
    }

    this.staging = {};
    if (isHard) {
      for (const k of Object.keys(this.workingDir)) {
        if (this.workingDir[k].status === "modified") {
          this.workingDir[k].status = "clean";
        }
      }
    }

    this.recordReflog("reset", `moving to ${commitId}`);
    this.lastEvent = { type: "reset", mode: isHard ? "hard" : "mixed", target: commitId };
    return {
      ok: true,
      type: isHard ? "warn" : "ok",
      command: raw,
      output: isHard
        ? `HEAD movido con --hard a ${commitId} (${this.commits[commitId].message}). Cambios posteriores descartados.`
        : `Rama '${this.head.ref}' movida a ${commitId}. Staging reiniciado y Working Directory conservado.`,
    };
  }

  cmdClean(args, raw) {
    const dryRun = args.includes("-n") || args.includes("--dry-run");
    const force = args.includes("-f") || args.includes("--force");
    const untracked = Object.entries(this.workingDir)
      .filter(([, f]) => f.status === "untracked")
      .map(([k]) => k);

    if (!dryRun && !force) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: "fatal: git clean requiere -n (vista previa) o -f (forzar borrado).",
      };
    }

    if (!untracked.length) {
      return {
        ok: true,
        type: "info",
        command: raw,
        output: "No hay archivos sin seguimiento (untracked) para limpiar.",
      };
    }

    if (dryRun) {
      this.lastEvent = { type: "clean-preview", files: untracked };
      return {
        ok: true,
        type: "warn",
        command: raw,
        output: untracked.map((f) => `Se eliminaría ${f}`).join("\n"),
      };
    }

    untracked.forEach((f) => delete this.workingDir[f]);
    this.lastEvent = { type: "clean", files: untracked };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: untracked.map((f) => `Eliminando ${f}`).join("\n"),
    };
  }

  cmdBranch(args, raw) {
    if (args.length === 0) {
      const current = this.getCurrentBranchName();
      const lines = Object.keys(this.branches).map((b) =>
        b === current ? `* ${b}` : `  ${b}`
      );
      this.lastEvent = { type: "branch-list" };
      return { ok: true, type: "info", command: raw, output: lines.join("\n") || "(sin ramas)" };
    }

    const name = args[0];
    if (this.branches[name]) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `fatal: ya existe una rama llamada '${name}'.`,
      };
    }
    const headId = this.getHeadCommitId();
    this.branches[name] = headId;
    this.lastEvent = { type: "branch", branch: name, commitId: headId };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Rama '${name}' creada en ${headId || "HEAD"}.`,
    };
  }

  cmdCheckout(args, raw) {
    const createNew = args[0] === "-b" || args[0] === "-c";
    const target = createNew ? args[1] : args[0];

    if (!target) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: "Uso: git checkout <rama|commit> o git checkout -b <nueva-rama>",
      };
    }

    if (createNew) {
      if (this.branches[target]) {
        return {
          ok: false,
          type: "err",
          command: raw,
          output: `fatal: ya existe una rama llamada '${target}'.`,
        };
      }
      const headId = this.getHeadCommitId();
      this.branches[target] = headId;
      this.head = { type: "branch", ref: target };
      this.recordReflog("checkout", `moving to ${target}`);
      this.lastEvent = { type: "checkout-new", branch: target, commitId: headId };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Cambiado a una nueva rama '${target}'`,
      };
    }

    if (this.branches[target] !== undefined) {
      this.head = { type: "branch", ref: target };
      this.recordReflog("checkout", `moving to ${target}`);
      this.lastEvent = { type: "checkout", branch: target };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Cambiado a la rama '${target}'`,
      };
    }

    const commitId = this.resolveRef(target);
    if (commitId) {
      this.head = { type: "detached", ref: commitId };
      this.recordReflog("checkout", `detached at ${commitId}`);
      this.lastEvent = { type: "checkout-detached", commitId };
      return {
        ok: true,
        type: "warn",
        command: raw,
        output: `Nota: cambiando a '${commitId}'. Estás en estado 'detached HEAD'.`,
      };
    }

    return {
      ok: false,
      type: "err",
      command: raw,
      output: `error: pathspec '${target}' no coincide con ninguna rama ni commit.`,
    };
  }

  cmdMerge(args, raw) {
    const targetName = args[0];
    if (!targetName) {
      return { ok: false, type: "err", command: raw, output: "Uso: git merge <rama>" };
    }
    const targetId = this.resolveRef(targetName);
    if (!targetId) {
      return { ok: false, type: "err", command: raw, output: `merge: '${targetName}' no existe.` };
    }

    const headId = this.getHeadCommitId();
    if (headId === targetId || this.isAncestor(targetId, headId)) {
      return { ok: true, type: "info", command: raw, output: "Already up to date (ya está actualizado)." };
    }

    // Fast-forward si headId es ancestro de targetId
    if (this.isAncestor(headId, targetId)) {
      if (this.head.type === "branch") {
        this.branches[this.head.ref] = targetId;
      } else {
        this.head.ref = targetId;
      }
      this.recordReflog("merge", `Fast-forward to ${targetName}`);
      this.lastEvent = { type: "merge-ff", target: targetId };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Actualizando ${headId}..${targetId}\nFast-forward hacia '${targetName}'.`,
      };
    }

    // Merge commit de 3 vías
    const newId = `C${this.nextCommitNum++}`;
    this.commits[newId] = {
      id: newId,
      hash: this.makeHash(newId + "m"),
      parents: [headId, targetId],
      message: `Merge branch '${targetName}' into ${this.head.ref}`,
      author: this.config["user.name"],
      email: this.config["user.email"],
      date: "ahora",
      files: {
        ...(this.commits[headId]?.files || {}),
        ...(this.commits[targetId]?.files || {}),
      },
      diffLines: [`+ Merge de '${targetName}' (${targetId}) en '${this.head.ref}'`],
    };
    this.commitOrder.push(newId);
    if (this.head.type === "branch") {
      this.branches[this.head.ref] = newId;
    } else {
      this.head.ref = newId;
    }
    this.recordReflog("merge", `Merge ${targetName}`);
    this.lastEvent = { type: "merge", commitId: newId, from: targetId };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Merge realizado mediante la estrategia 'ort'. Nuevo commit de fusión: ${newId}.`,
    };
  }

  cmdRebase(args, raw) {
    const interactive = args.includes("-i") || args.includes("--interactive");
    const baseRef = args.find((a) => !a.startsWith("-"));
    if (!baseRef) {
      return { ok: false, type: "err", command: raw, output: "Uso: git rebase [-i] <base>" };
    }

    const baseId = this.resolveRef(baseRef);
    const headId = this.getHeadCommitId();
    if (!baseId) {
      return { ok: false, type: "err", command: raw, output: `No se encontró la base '${baseRef}'.` };
    }

    if (headId === baseId || this.isAncestor(headId, baseId)) {
      if (this.head.type === "branch") this.branches[this.head.ref] = baseId;
      else this.head.ref = baseId;
      this.lastEvent = { type: "rebase", base: baseId };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Fast-forward rebase de '${this.head.ref}' sobre '${baseRef}'.`,
      };
    }

    // Encontrar ancestros de baseId para saber qué commits copiar
    const baseAncestors = new Set(this.getAncestorsChain(baseId));
    const toReplay = this.getAncestorsChain(headId, baseAncestors).reverse();

    if (toReplay.length === 0) {
      return { ok: true, type: "info", command: raw, output: "La rama ya está actualizada sobre la base." };
    }

    if (interactive) {
      this.pendingInteractiveRebase = {
        baseRef,
        baseId,
        commits: toReplay.map((id) => ({
          id,
          action: "pick",
          message: this.commits[id].message,
        })),
      };
      this.lastEvent = { type: "rebase-interactive-open" };
      return {
        ok: true,
        type: "info",
        command: raw,
        interactiveRebase: this.pendingInteractiveRebase,
        output: `Abriendo editor interactivo para rebase de ${toReplay.length} commit(s) sobre ${baseRef}...`,
      };
    }

    return this.applyRebasePlan(baseId, toReplay.map((id) => ({ id, action: "pick" })), raw);
  }

  // Aplica el plan de rebase (tanto normal como interactivo)
  applyRebasePlan(baseId, plan, raw = "git rebase -i") {
    let currParent = baseId;
    const createdIds = [];

    for (const item of plan) {
      if (item.action === "drop") continue;
      const orig = this.commits[item.id];
      if (!orig) continue;

      if (item.action === "squash" && createdIds.length > 0) {
        const prevId = createdIds[createdIds.length - 1];
        this.commits[prevId].message += ` + ${orig.message}`;
        this.commits[prevId].files = { ...this.commits[prevId].files, ...orig.files };
        continue;
      }

      const newId = `C${this.nextCommitNum++}`;
      this.commits[newId] = {
        id: newId,
        hash: this.makeHash(newId + "rb"),
        parents: [currParent],
        message: orig.message,
        author: orig.author,
        email: orig.email,
        date: "ahora",
        files: { ...(this.commits[currParent]?.files || {}), ...orig.files },
        diffLines: [...orig.diffLines],
      };
      this.commitOrder.push(newId);
      currParent = newId;
      createdIds.push(newId);
    }

    if (this.head.type === "branch") {
      this.branches[this.head.ref] = currParent;
    } else {
      this.head.ref = currParent;
    }
    this.pendingInteractiveRebase = null;
    this.recordReflog("rebase", `rebased onto ${baseId}`);
    this.lastEvent = { type: "rebase", base: baseId, created: createdIds };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Rebase completado con éxito. ${createdIds.length} commit(s) reescritos sobre ${baseId} (${createdIds.join(" -> ") || baseId}).`,
    };
  }

  cmdReflog(args, raw) {
    const showRelDate = args.includes("--relative-date");
    const showAll = args.includes("--all");
    const lines = this.reflog.map((entry, idx) => {
      const refLabel = showRelDate ? `HEAD@{${entry.date}}` : `HEAD@{${idx}}`;
      const hash = this.commits[entry.headId]?.hash || "0000000";
      return `${hash} [${entry.headId}] ${refLabel}: ${entry.action}: ${entry.message}`;
    });
    if (showAll) {
      for (const [b, cid] of Object.entries(this.branches)) {
        if (cid) {
          lines.push(`${this.commits[cid].hash} [${cid}] refs/heads/${b}: tip`);
        }
      }
    }
    this.lastEvent = { type: "reflog" };
    return {
      ok: true,
      type: "info",
      command: raw,
      output: lines.join("\n") || "(reflog vacío)",
    };
  }

  cmdTag(args, raw) {
    if (!args[0]) {
      return {
        ok: true,
        type: "info",
        command: raw,
        output: Object.keys(this.tags).join("\n") || "(sin etiquetas)",
      };
    }
    const tagName = args[0];
    const headId = this.getHeadCommitId();
    this.tags[tagName] = headId;
    this.lastEvent = { type: "tag", tag: tagName, commitId: headId };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `Etiqueta '${tagName}' creada en ${headId}.`,
    };
  }

  cmdRemote(args, raw) {
    if (args[0] === "add" && args[1] && args[2]) {
      const [, name, url] = args;
      if (!this.remotes[name]) {
        const headId = this.getHeadCommitId();
        const remoteCommits = {};
        if (headId && this.commits[headId]) {
          // Copiar historial base al remoto simulado si estaba vacío
          for (const id of this.getAncestorsChain(headId)) {
            remoteCommits[id] = { ...this.commits[id] };
          }
        }
        this.remotes[name] = {
          url,
          branches: headId ? { main: headId } : {},
          commits: remoteCommits,
          tags: {},
        };
      } else {
        this.remotes[name].url = url;
      }
      this.lastEvent = { type: "remote-add", name, url };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Remoto '${name}' conectado a ${url}.`,
      };
    }

    const entries = Object.entries(this.remotes);
    if (!entries.length) {
      return { ok: true, type: "info", command: raw, output: "(no hay remotos configurados)" };
    }
    return {
      ok: true,
      type: "info",
      command: raw,
      output: entries.map(([n, r]) => `${n}\t${r.url} (fetch/push)`).join("\n"),
    };
  }

  cmdFetch(args, raw) {
    const remoteName = args[0] || "origin";
    const branchArg = args[1];
    const remote = this.remotes[remoteName];
    if (!remote) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `fatal: '${remoteName}' no parece ser un repositorio remoto configurado.`,
      };
    }

    // Copiar commits del remoto al almacenamiento local
    for (const [id, c] of Object.entries(remote.commits)) {
      if (!this.commits[id]) {
        this.commits[id] = { ...c, parents: [...c.parents], files: { ...c.files } };
        this.commitOrder.push(id);
      }
    }

    const updated = [];
    const targetBranches = branchArg ? [branchArg] : Object.keys(remote.branches);
    for (const b of targetBranches) {
      if (remote.branches[b]) {
        this.remoteRefs[`${remoteName}/${b}`] = remote.branches[b];
        updated.push(`${remoteName}/${b} -> ${remote.branches[b]}`);
      }
    }

    this.lastEvent = { type: "fetch", remote: remoteName, updated };
    return {
      ok: true,
      type: "ok",
      command: raw,
      output: `De ${remote.url}\n * [descargado] ${updated.join(", ") || "todo al día"}`,
    };
  }

  cmdPull(args, raw) {
    const useRebase = args.includes("--rebase");
    const positional = args.filter((a) => !a.startsWith("-"));
    const remoteName = positional[0] || "origin";
    const branchName = positional[1] || this.getCurrentBranchName() || "main";

    const fetchRes = this.cmdFetch([remoteName, branchName], raw);
    if (!fetchRes.ok) return fetchRes;

    const remoteRefName = `${remoteName}/${branchName}`;
    if (!this.remoteRefs[remoteRefName]) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `No se encontró la rama '${branchName}' en '${remoteName}'.`,
      };
    }

    const integrateRes = useRebase
      ? this.cmdRebase([remoteRefName], raw)
      : this.cmdMerge([remoteRefName], raw);

    this.lastEvent = { type: useRebase ? "pull-rebase" : "pull", remote: remoteName };
    return {
      ok: integrateRes.ok,
      type: integrateRes.type,
      command: raw,
      output: `${fetchRes.output}\n${integrateRes.output}`,
    };
  }

  cmdPush(args, raw) {
    const isForce = args.includes("--force") || args.includes("-f");
    const isAll = args.includes("--all");
    const isTags = args.includes("--tags");
    const positional = args.filter((a) => !a.startsWith("-"));
    const remoteName = positional[0] || "origin";
    const branchName = positional[1] || this.getCurrentBranchName() || "main";

    const remote = this.remotes[remoteName];
    if (!remote) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `fatal: el remoto '${remoteName}' no existe. Usa 'git remote add ${remoteName} <url>'.`,
      };
    }

    // Copiar commits alcanzables al remoto
    const syncCommitsFrom = (tipId) => {
      const stack = [tipId];
      while (stack.length) {
        const id = stack.pop();
        if (!id || !this.commits[id] || remote.commits[id]) continue;
        remote.commits[id] = {
          ...this.commits[id],
          parents: [...this.commits[id].parents],
          files: { ...this.commits[id].files },
        };
        this.commits[id].parents.forEach((p) => stack.push(p));
      }
    };

    if (isTags) {
      const pushedTags = [];
      for (const [t, cid] of Object.entries(this.tags)) {
        syncCommitsFrom(cid);
        remote.tags[t] = cid;
        pushedTags.push(t);
      }
      this.lastEvent = { type: "push-tags", remote: remoteName, tags: pushedTags };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: pushedTags.length
          ? `Hacia ${remote.url}\n * [nueva etiqueta] ${pushedTags.join(", ")}`
          : "No hay etiquetas locales para enviar.",
      };
    }

    if (isAll) {
      const pushed = [];
      for (const [b, cid] of Object.entries(this.branches)) {
        if (!cid) continue;
        syncCommitsFrom(cid);
        remote.branches[b] = cid;
        this.remoteRefs[`${remoteName}/${b}`] = cid;
        pushed.push(b);
      }
      this.lastEvent = { type: "push-all", remote: remoteName, branches: pushed };
      return {
        ok: true,
        type: "ok",
        command: raw,
        output: `Hacia ${remote.url}\nTodas las ramas enviadas: ${pushed.join(", ")}`,
      };
    }

    const localTip = this.branches[branchName];
    if (!localTip) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output: `error: la rama local '${branchName}' no existe o no tiene commits.`,
      };
    }

    const remoteTip = remote.branches[branchName];
    if (remoteTip && !this.isAncestor(remoteTip, localTip) && !isForce) {
      return {
        ok: false,
        type: "err",
        command: raw,
        output:
          `! [rechazado] ${branchName} -> ${branchName} (non-fast-forward)\n` +
          `Pista: el remoto tiene commits que no están en tu historia lineal. Usa 'git pull' o, si reescribiste tu propia rama a propósito, 'git push ${remoteName} --force'.`,
      };
    }

    syncCommitsFrom(localTip);
    remote.branches[branchName] = localTip;
    this.remoteRefs[`${remoteName}/${branchName}`] = localTip;
    this.lastEvent = { type: isForce ? "push-force" : "push", remote: remoteName, branch: branchName };
    return {
      ok: true,
      type: isForce ? "warn" : "ok",
      command: raw,
      output: isForce
        ? `Hacia ${remote.url}\n + ${remoteTip || "0000"}...${localTip} ${branchName} -> ${branchName} (actualización forzada)`
        : `Hacia ${remote.url}\n   ${remoteTip ? remoteTip + ".." : ""}${localTip}  ${branchName} -> ${branchName}`,
    };
  }
}
