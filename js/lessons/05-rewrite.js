// Sección 05: Reescribir Historial (Amend, Rebase, Rebase -i y Reflog)
const MODULE_05_REWRITE = {
  id: "mod-05",
  title: "05. Reescribir Historial",
  color: "#f7a800",
  open: false,
  lessons: [
    {
      slug: "l12-amend",
      num: "12",
      title: "Corregir el último commit (--amend)",
      subtitle: "Agrega un archivo olvidado o edita el mensaje del último commit sin crear ruido.",
      level: "Rewriting History",
      steps: [
        {
          title: "Prepara el archivo olvidado",
          body: "<p>Acabas de hacer el commit <code>C1</code>, pero olvidaste incluir <code>tests.js</code>. Primero agrégalo al Staging Area para combinarlo con el último commit.</p>",
          syntax: "git add <file>",
          mission: "Ejecuta <code>git add tests.js</code> para poner el archivo olvidado en Staging.",
          demoCommand: "git add tests.js",
          hints: ["git add tests.js"],
          tip: "Si solo quieres cambiar el mensaje del commit, no necesitas tener nada en Staging.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: calcuadora (typo)" },
            ],
            branches: { main: "C1" },
            head: { type: "branch", ref: "main" },
            workingDir: {
              "tests.js": { content: "assert(2+2 === 4);", status: "untracked" },
            },
          },
          validate: (engine, res) => res.ok && Boolean(engine.staging["tests.js"]),
        },
        {
          title: "Enmienda el commit con --amend",
          body: "<p><code>git commit --amend</code> crea un <strong>nuevo commit</strong> que reemplaza al anterior combinando los cambios en Staging y el nuevo mensaje. Observa que el commit viejo (<code>C1</code>) queda atenuado.</p>",
          syntax: 'git commit --amend -m "<message>"',
          mission: 'Ejecuta <code>git commit --amend -m "feat: calculadora con tests"</code> y mira el reemplazo en el grafo.',
          demoCommand: 'git commit --amend -m "feat: calculadora con tests"',
          hints: ['git commit --amend -m "feat: calculadora con tests"', "git commit --amend"],
          tip: "Evita usar --amend sobre commits que ya enviaste a una rama compartida con tu equipo.",
          validate: (engine, res) =>
            res.ok && res.command.includes("--amend") && engine.branches.main !== "C1",
        },
      ],
    },
    {
      slug: "l13-rebase",
      num: "13",
      title: "Historia lineal con git rebase",
      subtitle: "Mueve toda una rama encima de otra base para mantener un historial limpio.",
      level: "Rewriting History",
      steps: [
        {
          title: "Rebasa feature sobre main",
          body: "<p>Estás en la rama <code>feature</code> (<code>C2</code>, <code>C3</code>), pero <code>main</code> avanzó hasta <code>C4</code>. Con <strong>git rebase main</strong>, Git toma tus commits de <code>feature</code> y los reaplica uno por uno encima de <code>C4</code>.</p>",
          syntax: "git rebase <base>",
          mission: "Ejecuta <code>git rebase main</code> y observa cómo tus commits se copian en línea recta sobre <code>C4</code> mientras los viejos se atenúan.",
          demoCommand: "git rebase main",
          hints: ["git rebase main"],
          tip: "La gran regla de oro del rebase: nunca hagas rebase de commits que ya son públicos y compartidos.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: base" },
              { id: "C2", parents: ["C1"], message: "feat: login UI" },
              { id: "C3", parents: ["C2"], message: "feat: login validation" },
              { id: "C4", parents: ["C1"], message: "fix: security patch" },
            ],
            branches: { main: "C4", feature: "C3" },
            head: { type: "branch", ref: "feature" },
          },
          validate: (engine, res) =>
            res.ok &&
            res.command.startsWith("git rebase") &&
            engine.isAncestor(engine.branches.main, engine.branches.feature),
        },
      ],
    },
    {
      slug: "l14-rebase-reflog",
      num: "14",
      title: "Rebase interactivo (-i) y rescate con reflog",
      subtitle: "Limpia commits con git rebase -i y recupera cualquier estado pasado con git reflog.",
      level: "Rewriting History +",
      steps: [
        {
          title: "Lanza un rebase interactivo",
          body: "<p><code>git rebase -i &lt;base&gt;</code> abre un editor donde puedes decidir qué hacer con cada commit: conservar (<code>pick</code>), fusionar con el anterior (<code>squash</code>) o descartar (<code>drop</code>).</p>",
          syntax: "git rebase -i <base>",
          mission: "Ejecuta <code>git rebase -i C1</code>, elige <code>squash</code> o <code>drop</code> en el modal interactivo y pulsa <strong>Aplicar Rebase</strong>.",
          demoCommand: "git rebase -i C1",
          hints: ["git rebase -i C1", "git rebase -i main"],
          tip: "Es la herramienta favorita para convertir varios commits 'wip' en un solo commit limpio antes de un Pull Request.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: base" },
              { id: "C2", parents: ["C1"], message: "feat: boton pago" },
              { id: "C3", parents: ["C2"], message: "wip: fix estilo" },
              { id: "C4", parents: ["C3"], message: "wip: quitar console.log" },
            ],
            branches: { main: "C1", feature: "C4" },
            head: { type: "branch", ref: "feature" },
          },
          validate: (engine, res) =>
            res.ok && engine.lastEvent && engine.lastEvent.type === "rebase",
        },
        {
          title: "Inspecciona el historial local de HEAD con git reflog",
          body: "<p>¿Te arrepentiste de un <code>reset</code> o un <code>rebase</code>? <strong>git reflog</strong> registra cada movimiento de tu <code>HEAD</code> local. Incluso los commits atenuados siguen accesibles por su ID.</p>",
          syntax: "git reflog [--relative-date | --all]",
          mission: "Ejecuta <code>git reflog --relative-date</code> para ver todos los movimientos recientes de HEAD.",
          demoCommand: "git reflog --relative-date",
          hints: ["git reflog --relative-date", "git reflog", "git reflog --all"],
          tip: "Desde reflog puedes rescatar cualquier estado anterior con 'git reset --hard <id>'.",
          validate: (_engine, res) => res.ok && res.command.startsWith("git reflog"),
        },
      ],
    },
  ],
};
