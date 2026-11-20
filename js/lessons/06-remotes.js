// Sección 06: Repositorios Remotos (Remote, Fetch, Pull, Pull --rebase, Push)
const MODULE_06_REMOTES = {
  id: "mod-06",
  title: "06. Repositorios Remotos",
  color: "#fb923c",
  open: false,
  lessons: [
    {
      slug: "l15-remote-fetch",
      num: "15",
      title: "Conectar remotos y usar git fetch",
      subtitle: "Vincula un repositorio remoto con git remote add y descarga novedades sin alterar tu rama local.",
      level: "Remote Repositories",
      steps: [
        {
          title: "Agrega un repositorio remoto",
          body: "<p>Si inicializaste tu repositorio localmente, usa <code>git remote add &lt;name&gt; &lt;url&gt;</code> para vincularlo a un servidor. Por convención, el remoto principal se llama <code>origin</code>.</p>",
          syntax: "git remote add <name> <url>",
          mission: "Conecta el remoto ejecutando <code>git remote add origin https://github.com/equipo/api.git</code>.",
          demoCommand: "git remote add origin https://github.com/equipo/api.git",
          hints: ["git remote add origin https://github.com/equipo/api.git"],
          tip: "Una vez agregado, puedes usar 'origin' como atajo en fetch, pull y push.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: api v1" },
            ],
            branches: { main: "C1" },
            head: { type: "branch", ref: "main" },
          },
          validate: (engine, res) => res.ok && Boolean(engine.remotes.origin),
        },
        {
          title: "Descarga commits remotos sin fusionar (git fetch)",
          body: "<p>Un compañero subió <code>C2</code> al servidor remoto. <strong>git fetch</strong> descarga los commits nuevos y actualiza la referencia <code>origin/main</code>, pero <strong>NO toca</strong> tu rama local <code>main</code>.</p>",
          syntax: "git fetch <remote> [branch]",
          mission: "Ejecuta <code>git fetch origin main</code> (o <code>git fetch origin</code>) y observa cómo aparece <code>C2</code> y <code>origin/main</code> en tu grafo local.",
          demoCommand: "git fetch origin main",
          hints: ["git fetch origin main", "git fetch origin"],
          tip: "git fetch es 100% seguro: te permite inspeccionar qué cambió en el remoto antes de integrar.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: api v1" },
            ],
            branches: { main: "C1" },
            head: { type: "branch", ref: "main" },
            remoteRefs: { "origin/main": "C1" },
            remotes: {
              origin: {
                url: "https://github.com/equipo/api.git",
                branches: { main: "C2" },
                commits: [
                  { id: "C0", parents: [], message: "chore: init" },
                  { id: "C1", parents: ["C0"], message: "feat: api v1" },
                  { id: "C2", parents: ["C1"], message: "feat: endpoint salud (equipo)" },
                ],
              },
            },
          },
          validate: (engine, res) =>
            res.ok && res.command.startsWith("git fetch") && engine.remoteRefs["origin/main"] === "C2",
        },
      ],
    },
    {
      slug: "l16-pull-rebase",
      num: "16",
      title: "Sincronizar con git pull y pull --rebase",
      subtitle: "Compara integrar cambios remotos mediante merge automático o rebase lineal.",
      level: "Remote Repositories +",
      steps: [
        {
          title: "Descarga e integra con git pull",
          body: "<p><code>git pull &lt;remote&gt;</code> combina dos comandos en uno: primero hace <code>git fetch</code> y luego <code>git merge</code> de la rama remota en tu rama local.</p>",
          syntax: "git pull <remote>",
          mission: "Ejecuta <code>git pull origin</code> para traer <code>C2</code> desde el remoto y fusionarlo con tu commit local <code>C3</code>.",
          demoCommand: "git pull origin",
          hints: ["git pull origin"],
          tip: "Observa cómo se crea un Merge Commit al combinar tu trabajo local (C3) con el remoto (C2).",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: base" },
              { id: "C3", parents: ["C1"], message: "feat: mi cambio local" },
            ],
            branches: { main: "C3" },
            head: { type: "branch", ref: "main" },
            remoteRefs: { "origin/main": "C1" },
            remotes: {
              origin: {
                url: "https://github.com/equipo/app.git",
                branches: { main: "C2" },
                commits: [
                  { id: "C0", parents: [], message: "chore: init" },
                  { id: "C1", parents: ["C0"], message: "feat: base" },
                  { id: "C2", parents: ["C1"], message: "fix: cambio remoto" },
                ],
              },
            },
          },
          validate: (engine, res) =>
            res.ok && res.command.startsWith("git pull") && engine.isAncestor("C2", engine.branches.main),
        },
        {
          title: "Integra sin merge commits: git pull --rebase",
          body: "<p>Si prefieres evitar merge commits innecesarios, <code>git pull --rebase origin</code> descarga los cambios del remoto y <strong>reaplica tus commits locales encima</strong> formando una línea recta limpia.</p>",
          syntax: "git pull --rebase <remote>",
          mission: "Ejecuta <code>git pull --rebase origin</code> y compara el resultado lineal frente al paso anterior.",
          demoCommand: "git pull --rebase origin",
          hints: ["git pull --rebase origin"],
          tip: "Muchos equipos prefieren pull --rebase para mantener un historial fácil de leer.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: base" },
              { id: "C3", parents: ["C1"], message: "feat: mi cambio local" },
            ],
            branches: { main: "C3" },
            head: { type: "branch", ref: "main" },
            remoteRefs: { "origin/main": "C1" },
            remotes: {
              origin: {
                url: "https://github.com/equipo/app.git",
                branches: { main: "C2" },
                commits: [
                  { id: "C0", parents: [], message: "chore: init" },
                  { id: "C1", parents: ["C0"], message: "feat: base" },
                  { id: "C2", parents: ["C1"], message: "fix: cambio remoto" },
                ],
              },
            },
          },
          validate: (engine, res) =>
            res.ok &&
            res.command.includes("--rebase") &&
            engine.isAncestor("C2", engine.branches.main) &&
            engine.commits[engine.branches.main].parents.length === 1,
        },
      ],
    },
    {
      slug: "l17-push-options",
      num: "17",
      title: "Publicar con git push, --all, --tags y --force",
      subtitle: "Envía ramas, etiquetas y entiende cuándo (y cuándo NO) usar --force.",
      level: "Git Push",
      steps: [
        {
          title: "Envía tu rama al remoto",
          body: "<p><code>git push &lt;remote&gt; &lt;branch&gt;</code> sube tus commits locales al servidor y actualiza la rama remota (o la crea si aún no existía).</p>",
          syntax: "git push <remote> <branch>",
          mission: "Publica <code>main</code> ejecutando <code>git push origin main</code> y observa cómo se sincroniza el panel derecho.",
          demoCommand: "git push origin main",
          hints: ["git push origin main"],
          tip: "También puedes enviar todas tus ramas locales a la vez con 'git push origin --all'.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: release 1.0" },
              { id: "C2", parents: ["C1"], message: "feat: dark mode" },
            ],
            branches: { main: "C1", feature: "C2" },
            tags: { "v1.0": "C1" },
            head: { type: "branch", ref: "main" },
            remoteRefs: { "origin/main": "C0" },
            remotes: {
              origin: {
                url: "https://github.com/equipo/app.git",
                branches: { main: "C0" },
                commits: [{ id: "C0", parents: [], message: "chore: init" }],
                tags: {},
              },
            },
          },
          validate: (engine, res) =>
            res.ok && engine.remotes.origin.branches.main === "C1",
        },
        {
          title: "Envía todas las ramas (--all) y etiquetas (--tags)",
          body: "<p>Por defecto <code>git push</code> no envía etiquetas locales ni ramas distintas a la actual. Usa <code>--all</code> para subir todas tus ramas y <code>--tags</code> para publicar tus etiquetas (como <code>v1.0</code>).</p>",
          syntax: "git push <remote> --all  |  git push <remote> --tags",
          mission: "Publica tu etiqueta local ejecutando <code>git push origin --tags</code> (y prueba <code>git push origin --all</code>).",
          demoCommand: "git push origin --tags",
          hints: ["git push origin --tags", "git push origin --all"],
          tip: "Verás aparecer la etiqueta 🏷 v1.0 dentro del repositorio remoto en el panel derecho.",
          validate: (engine, res) =>
            res.ok &&
            (Boolean(engine.remotes.origin.tags["v1.0"]) || Boolean(engine.remotes.origin.branches.feature)),
        },
        {
          title: "Push forzado tras reescribir tu propia rama (--force)",
          body: "<p>Si reescribiste tu rama con <code>--amend</code> o <code>rebase</code>, Git rechazará un push normal por ser <em>non-fast-forward</em>. En ramas personales puedes usar <code>git push origin --force</code>.</p>",
          syntax: "git push <remote> --force",
          mission: "El remoto apunta a <code>C1</code>, pero tu rama local fue enmendada a <code>C2</code>. Ejecuta <code>git push origin main --force</code> para sobrescribir la referencia remota.",
          demoCommand: "git push origin main --force",
          hints: ["git push origin main --force", "git push origin --force"],
          tip: "¡Regla de oro! Nunca uses --force en main o ramas compartidas sin aprobación del equipo.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: borrador viejo" },
              { id: "C2", parents: ["C0"], message: "feat: borrador enmendado" },
            ],
            branches: { main: "C2" },
            head: { type: "branch", ref: "main" },
            remoteRefs: { "origin/main": "C1" },
            remotes: {
              origin: {
                url: "https://github.com/equipo/app.git",
                branches: { main: "C1" },
                commits: [
                  { id: "C0", parents: [], message: "chore: init" },
                  { id: "C1", parents: ["C0"], message: "feat: borrador viejo" },
                ],
                tags: {},
              },
            },
          },
          validate: (engine, res) =>
            res.ok && res.command.includes("--force") && engine.remotes.origin.branches.main === "C2",
        },
      ],
    },
  ],
};
