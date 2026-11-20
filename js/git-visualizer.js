// Visualizador animado del grafo de commits estilo LearnGitBranching + Árbol de Trabajo y Remotos
class GitVisualizer {
  constructor(svgEl, treesEl, badgesEl, tooltipEl) {
    this.svgEl = svgEl;
    this.treesEl = treesEl;
    this.badgesEl = badgesEl;
    this.tooltipEl = tooltipEl;
    this.prevCommitIds = new Set();
  }

  // Paleta consistente por carril de rama
  getLaneColor(lane) {
    const palette = ["#38bdf8", "#f7a800", "#a78bfa", "#22c55e", "#f43f5e", "#fb923c"];
    return palette[lane % palette.length];
  }

  // Calcula coordenadas (x, y) limpias para cada commit del DAG
  computeLayout(commitsMap, orderIds, originX = 72, originY = 145, stepX = 92, stepY = 74) {
    const positions = {};
    const laneOccupied = {}; // col -> Set(lane)
    const childCount = {};

    // Contar hijos para detectar bifurcaciones
    for (const id of orderIds) {
      const c = commitsMap[id];
      if (!c) continue;
      for (const p of c.parents) {
        childCount[p] = (childCount[p] || 0) + 1;
      }
    }

    const parentAssignedBranch = {}; // parentId -> count of children placed

    for (const id of orderIds) {
      const c = commitsMap[id];
      if (!c) continue;

      let col = 0;
      let lane = 0;

      if (c.parents.length === 0) {
        col = 0;
        lane = 0;
      } else {
        const primaryParent = c.parents[0];
        const pPos = positions[primaryParent];
        // Columna = max(columna de padres) + 1
        let maxParentCol = 0;
        for (const p of c.parents) {
          if (positions[p] && positions[p].col > maxParentCol) {
            maxParentCol = positions[p].col;
          }
        }
        col = maxParentCol + 1;

        const siblingIdx = parentAssignedBranch[primaryParent] || 0;
        parentAssignedBranch[primaryParent] = siblingIdx + 1;

        if (c.parents.length > 1) {
          // Merge commit regresa al carril de su primer padre
          lane = pPos ? pPos.lane : 0;
        } else if (siblingIdx === 0) {
          lane = pPos ? pPos.lane : 0;
        } else {
          // Nueva bifurcación ocupa un carril libre
          lane = (pPos ? pPos.lane : 0) + siblingIdx;
        }
      }

      if (!laneOccupied[col]) laneOccupied[col] = new Set();
      while (laneOccupied[col].has(lane)) {
        lane++;
      }
      laneOccupied[col].add(lane);

      // Alternar carriles arriba/abajo para mantener el grafo centrado
      const yOffset = lane === 0 ? 0 : lane % 2 === 1 ? -Math.ceil(lane / 2) * stepY : Math.ceil(lane / 2) * stepY;

      positions[id] = {
        col,
        lane,
        x: originX + col * stepX,
        y: originY + yOffset,
        color: this.getLaneColor(lane),
      };
    }

    return positions;
  }

  render(engine) {
    if (!this.svgEl) return;
    this.renderBadges(engine);
    this.renderTrees(engine);

    if (!engine.initialized) {
      this.svgEl.setAttribute("viewBox", "0 0 820 290");
      this.svgEl.innerHTML = `
        <g transform="translate(410, 145)" text-anchor="middle">
          <rect x="-195" y="-44" width="390" height="88" rx="14" fill="var(--surface)" stroke="var(--border)" stroke-dasharray="6 4" stroke-width="1.8"></rect>
          <text y="-8" fill="var(--ink)" font-size="14" font-weight="800">Directorio sin repositorio Git</text>
          <text y="16" fill="var(--muted)" font-size="12" font-family="var(--mono)">Ejecuta "git init" o "git clone &lt;repo&gt;" para comenzar</text>
        </g>
      `;
      this.prevCommitIds.clear();
      return;
    }

    const hasRemotes = Object.keys(engine.remotes).length > 0;
    const localIds = engine.commitOrder.filter((id) => engine.commits[id]);
    const reachable = engine.getReachableCommits();

    // Calcular ancho dinámico del lienzo
    const localStepX = hasRemotes ? 76 : 94;
    const localPos = this.computeLayout(engine.commits, localIds, 64, 152, localStepX, 68);
    const maxLocalX = Object.values(localPos).reduce((m, p) => Math.max(m, p.x), 180);

    let viewWidth = Math.max(820, maxLocalX + 140);
    let remoteSvg = "";

    if (hasRemotes) {
      const remoteName = Object.keys(engine.remotes)[0];
      const remote = engine.remotes[remoteName];
      const remoteOrder = Object.keys(remote.commits);
      const dividerX = Math.max(460, maxLocalX + 95);
      const remotePos = this.computeLayout(remote.commits, remoteOrder, dividerX + 75, 152, 74, 68);
      const maxRemoteX = Object.values(remotePos).reduce((m, p) => Math.max(m, p.x), dividerX + 200);
      viewWidth = Math.max(860, maxRemoteX + 120);

      // Panel visual de repositorio remoto
      const isSyncing = ["fetch", "pull", "pull-rebase", "push", "push-force", "push-all", "push-tags", "clone"].includes(
        engine.lastEvent?.type
      );
      const syncArrow = isSyncing
        ? `<g class="git-sync-packet">
             <line x1="${dividerX - 28}" y1="152" x2="${dividerX + 28}" y2="152" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"></line>
             <circle cx="${dividerX}" cy="152" r="6" fill="var(--accent)"></circle>
           </g>`
        : "";

      remoteSvg = `
        <line x1="${dividerX}" y1="26" x2="${dividerX}" y2="274" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="6 5"></line>
        <rect x="${dividerX + 16}" y="22" width="160" height="24" rx="6" fill="var(--surface-2)" stroke="var(--border)"></rect>
        <text x="${dividerX + 96}" y="38" text-anchor="middle" fill="var(--accent)" font-size="11" font-weight="800" font-family="var(--mono)">REMOTO (${remoteName})</text>
        ${syncArrow}
        ${this.renderGraphLayer(remote.commits, remoteOrder, remotePos, {
          branches: remote.branches,
          tags: remote.tags,
          head: null,
          reachable: new Set(remoteOrder),
          isRemote: true,
        })}
      `;
    }

    const localLabel = hasRemotes
      ? `<rect x="16" y="22" width="136" height="24" rx="6" fill="var(--surface-2)" stroke="var(--border)"></rect>
         <text x="84" y="38" text-anchor="middle" fill="var(--info)" font-size="11" font-weight="800" font-family="var(--mono)">REPOSITORIO LOCAL</text>`
      : "";

    const localLayer =
      localIds.length === 0
        ? `<g transform="translate(410, 152)" text-anchor="middle">
             <circle cx="0" cy="0" r="26" fill="var(--surface)" stroke="var(--accent)" stroke-dasharray="5 4" stroke-width="2"></circle>
             <text y="4" fill="var(--accent)" font-size="11" font-weight="800" font-family="var(--mono)">VACÍO</text>
             <text y="48" fill="var(--muted)" font-size="12" font-family="var(--mono)">Rama 'main' lista · Haz tu primer git add + git commit</text>
           </g>`
        : this.renderGraphLayer(engine.commits, localIds, localPos, {
            branches: engine.branches,
            remoteRefs: engine.remoteRefs,
            tags: engine.tags,
            head: engine.head,
            reachable,
            isRemote: false,
          });

    this.svgEl.setAttribute("viewBox", `0 0 ${viewWidth} 296`);
    this.svgEl.innerHTML = `
      <defs>
        <marker id="git-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--muted)"></path>
        </marker>
      </defs>
      ${localLabel}
      ${localLayer}
      ${remoteSvg}
    `;

    // Vincular tooltips a cada nodo commit
    this.bindTooltips(engine);

    // Actualizar conjunto de commits vistos para detectar nuevos en el próximo render
    this.prevCommitIds = new Set(localIds);
  }

  renderGraphLayer(commitsMap, orderIds, positions, opts) {
    const edges = [];
    const nodes = [];
    const labels = [];

    // 1. Aristas (curvas suaves de hijo -> padre)
    for (const id of orderIds) {
      const c = commitsMap[id];
      const pos = positions[id];
      if (!c || !pos) continue;
      const isOrphan = !opts.reachable.has(id);
      const isNew = !opts.isRemote && !this.prevCommitIds.has(id);

      for (const pId of c.parents) {
        const pPos = positions[pId];
        if (!pPos) continue;
        const dx = (pos.x - pPos.x) * 0.5;
        const d = `M ${pPos.x + 20} ${pPos.y} C ${pPos.x + dx} ${pPos.y}, ${pos.x - dx} ${pos.y}, ${pos.x - 20} ${pos.y}`;
        edges.push(
          `<path class="git-edge ${isNew ? "git-edge--new" : ""}" d="${d}" stroke="${
            isOrphan ? "var(--muted)" : pos.color
          }" stroke-width="${isOrphan ? 2 : 3}" opacity="${isOrphan ? 0.35 : 0.85}"></path>`
        );
      }
    }

    // 2. Nodos de commits
    for (const id of orderIds) {
      const c = commitsMap[id];
      const pos = positions[id];
      if (!c || !pos) continue;
      const isOrphan = !opts.reachable.has(id);
      const isNew = !opts.isRemote && !this.prevCommitIds.has(id);
      const isMerge = c.parents.length > 1;

      nodes.push(`
        <g class="git-commit-group ${isNew ? "is-new" : ""} ${isOrphan ? "is-orphaned" : ""}"
           transform="translate(${pos.x}, ${pos.y})"
           data-commit-id="${id}"
           data-is-remote="${opts.isRemote ? "1" : "0"}">
          ${isMerge ? `<circle r="24" fill="none" stroke="${pos.color}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7"></circle>` : ""}
          <circle class="git-commit-circle" r="19" fill="var(--surface)" stroke="${pos.color}" stroke-width="3.2"></circle>
          <text text-anchor="middle" y="4" fill="var(--ink)" font-size="11.5" font-weight="800" font-family="var(--mono)">${id}</text>
        </g>
      `);
    }

    // 3. Etiquetas de ramas, remoteRefs, tags y HEAD*
    const badgesByCommit = {};
    const addBadge = (cid, badge) => {
      if (!cid || !positions[cid]) return;
      if (!badgesByCommit[cid]) badgesByCommit[cid] = [];
      badgesByCommit[cid].push(badge);
    };

    if (opts.branches) {
      for (const [bName, cid] of Object.entries(opts.branches)) {
        const isHeadBranch = opts.head && opts.head.type === "branch" && opts.head.ref === bName;
        addBadge(cid, {
          text: isHeadBranch ? `${bName}*` : bName,
          kind: isHeadBranch ? "head-branch" : "branch",
        });
      }
    }

    if (opts.head && opts.head.type === "detached") {
      addBadge(opts.head.ref, { text: "HEAD*", kind: "detached" });
    }

    if (opts.remoteRefs) {
      for (const [rName, cid] of Object.entries(opts.remoteRefs)) {
        addBadge(cid, { text: rName, kind: "remote" });
      }
    }

    if (opts.tags) {
      for (const [tName, cid] of Object.entries(opts.tags)) {
        addBadge(cid, { text: `🏷 ${tName}`, kind: "tag" });
      }
    }

    for (const [cid, list] of Object.entries(badgesByCommit)) {
      const pos = positions[cid];
      list.forEach((b, idx) => {
        const w = Math.max(54, b.text.length * 7.6 + 16);
        const y = pos.y - 44 - idx * 25;
        let fill = "var(--surface-2)";
        let stroke = "var(--info)";
        let textFill = "var(--ink)";

        if (b.kind === "head-branch") {
          fill = "var(--accent)";
          stroke = "var(--accent)";
          textFill = "var(--accent-ink)";
        } else if (b.kind === "detached") {
          fill = "var(--danger)";
          stroke = "var(--danger)";
          textFill = "#ffffff";
        } else if (b.kind === "remote") {
          fill = "var(--surface)";
          stroke = "var(--purple)";
          textFill = "var(--purple)";
        } else if (b.kind === "tag") {
          fill = "var(--ok-soft)";
          stroke = "var(--ok)";
          textFill = "var(--ok)";
        }

        labels.push(`
          <g class="git-label-group" transform="translate(${pos.x}, ${y})">
            ${idx === 0 ? `<line x1="0" y1="11" x2="0" y2="25" stroke="${stroke}" stroke-width="1.5" opacity="0.75"></line>` : ""}
            <rect x="${-w / 2}" y="-11" width="${w}" height="21" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></rect>
            <text text-anchor="middle" y="3.5" fill="${textFill}" font-size="10.5" font-weight="800" font-family="var(--mono)">${b.text}</text>
          </g>
        `);
      });
    }

    return `${edges.join("")}${nodes.join("")}${labels.join("")}`;
  }

  renderBadges(engine) {
    if (!this.badgesEl) return;
    const headText = !engine.initialized
      ? "Sin repo"
      : engine.head.type === "branch"
      ? `HEAD → ${engine.head.ref}`
      : `HEAD desacoplado (${engine.head.ref})`;

    const eventLabels = {
      commit: "✓ Nuevo commit creado",
      stage: "→ Movido al Staging Area",
      unstage: "← Retirado del Staging Area",
      branch: "⎇ Rama creada",
      "checkout-new": "⎇ Rama creada y activada",
      checkout: "⇄ Cambio de rama",
      "checkout-detached": "⚠ Detached HEAD",
      merge: "⑂ Merge commit creado",
      "merge-ff": "⏩ Fast-forward merge",
      rebase: "↻ Historial reescrito (rebase)",
      amend: "✎ Último commit enmendado",
      revert: "↩ Commit revertido",
      reset: "↺ Puntero reiniciado (reset)",
      clean: "🧹 Working directory limpiado",
      fetch: "⬇ Fetch desde remoto",
      pull: "⬇ Pull completado",
      "pull-rebase": "⬇ Pull con rebase completado",
      push: "⬆ Push enviado al remoto",
      "push-force": "⚠ Push forzado (--force)",
      "push-all": "⬆ Todas las ramas enviadas",
      "push-tags": "🏷 Etiquetas enviadas",
      config: "⚙ Configuración actualizada",
      clone: "⬇ Repositorio clonado",
      init: "★ Repositorio inicializado",
    };

    const eventBadge =
      engine.lastEvent && eventLabels[engine.lastEvent.type]
        ? `<span class="canvas-badge canvas-badge--event">${eventLabels[engine.lastEvent.type]}</span>`
        : "";

    this.badgesEl.innerHTML = `
      <span class="canvas-badge canvas-badge--head">${headText}</span>
      <span class="canvas-badge">${Object.keys(engine.commits).length} commits</span>
      ${eventBadge}
    `;
  }

  renderTrees(engine) {
    if (!this.treesEl) return;
    const workingChips = Object.entries(engine.workingDir)
      .filter(([, f]) => f.status !== "clean")
      .map(
        ([name, f]) =>
          `<span class="file-chip file-chip--${f.status}" title="${f.status}">${name} (${
            f.status === "untracked" ? "?" : "M"
          })</span>`
      )
      .join("");

    const stagingChips = Object.keys(engine.staging)
      .map((name) => `<span class="file-chip file-chip--staged">${name} (A)</span>`)
      .join("");

    const aliasCount = Object.keys(engine.config.aliases).length;
    const configChips = `
      <span class="file-chip file-chip--config">${engine.config["user.name"]}</span>
      ${aliasCount ? `<span class="file-chip file-chip--config">${aliasCount} alias</span>` : ""}
    `;

    this.treesEl.innerHTML = `
      <div class="tree-box">
        <div class="tree-box__head">
          <span>1. Working Directory</span>
          <span>Local</span>
        </div>
        <div class="tree-box__files">
          ${workingChips || '<span class="tree-empty">Árbol de trabajo limpio</span>'}
        </div>
      </div>
      <div class="tree-box">
        <div class="tree-box__head">
          <span>2. Staging Area (Index)</span>
          <span>git add</span>
        </div>
        <div class="tree-box__files">
          ${stagingChips || '<span class="tree-empty">Sin cambios preparados</span>'}
        </div>
      </div>
      <div class="tree-box">
        <div class="tree-box__head">
          <span>Configuración</span>
          <span>git config</span>
        </div>
        <div class="tree-box__files">${configChips}</div>
      </div>
    `;
  }

  bindTooltips(engine) {
    if (!this.tooltipEl) return;
    const nodes = this.svgEl.querySelectorAll(".git-commit-group");
    const container = this.svgEl.parentElement;

    nodes.forEach((node) => {
      node.addEventListener("mouseenter", (e) => {
        const id = node.getAttribute("data-commit-id");
        const isRemote = node.getAttribute("data-is-remote") === "1";
        let commit = engine.commits[id];
        if (isRemote) {
          const rName = Object.keys(engine.remotes)[0];
          commit = engine.remotes[rName]?.commits[id];
        }
        if (!commit) return;

        this.tooltipEl.innerHTML = `
          <div class="commit-tooltip__id">${commit.id} · ${commit.hash}</div>
          <div class="commit-tooltip__msg">${commit.message}</div>
          <div class="commit-tooltip__meta">${commit.author} · padres: ${
          commit.parents.length ? commit.parents.join(", ") : "ninguno"
        }</div>
        `;
        this.tooltipEl.style.display = "block";
        const rect = container.getBoundingClientRect();
        this.tooltipEl.style.left = `${Math.min(rect.width - 250, Math.max(10, e.clientX - rect.left + 12))}px`;
        this.tooltipEl.style.top = `${Math.max(10, e.clientY - rect.top - 10)}px`;
      });

      node.addEventListener("mouseleave", () => {
        this.tooltipEl.style.display = "none";
      });
    });
  }
}
