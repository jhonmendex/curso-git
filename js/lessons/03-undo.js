// Sección 03: Deshacer cambios y Git Reset (Undoing Changes & Git Reset)
const MODULE_03_UNDO = {
  id: "mod-03",
  title: "03. Deshacer y Reset",
  color: "#f43f5e",
  open: false,
  lessons: [
    {
      slug: "l7-revert",
      num: "07",
      title: "Deshacer sin romper historia: git revert",
      subtitle: "Crea un commit inverso seguro para ramas compartidas.",
      level: "Undoing Changes",
      steps: [
        {
          title: "Revierte un commit con errores",
          body: "<p>A diferencia de <code>reset</code>, <strong>git revert</strong> NO borra commits del historial. En su lugar, crea un <strong>nuevo commit</strong> que aplica exactamente los cambios inversos del commit elegido.</p>",
          syntax: "git revert <commit>",
          mission: "El commit <code>C2</code> introdujo un bug en producción. Ejecuta <code>git revert C2</code> y observa cómo se crea <code>C3</code> preservando toda la historia.",
          demoCommand: "git revert C2",
          hints: ["git revert C2"],
          tip: "Usa siempre git revert en ramas públicas (como main) donde otros compañeros ya descargaron el historial.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: carrito de compras" },
              { id: "C2", parents: ["C1"], message: "bug: cobro duplicado" },
            ],
            branches: { main: "C2" },
            head: { type: "branch", ref: "main" },
          },
          validate: (engine, res) =>
            res.ok && res.command.startsWith("git revert") && Object.keys(engine.commits).length >= 4,
        },
      ],
    },
    {
      slug: "l8-unstage-clean",
      num: "08",
      title: "Quitar de staging y limpiar archivos",
      subtitle: "Usa git reset <file> para desmarcar archivos y git clean -n / -f para eliminar basura temporal.",
      level: "Undoing Changes",
      steps: [
        {
          title: "Saca un archivo del Staging Area",
          body: "<p>Si agregaste un archivo por error con <code>git add</code>, <code>git reset &lt;file&gt;</code> lo saca del Staging Area pero <strong>mantiene tus ediciones intactas</strong> en el Working Directory.</p>",
          syntax: "git reset <file>",
          mission: "Retira <code>secrets.tmp</code> del Staging Area ejecutando <code>git reset secrets.tmp</code>.",
          demoCommand: "git reset secrets.tmp",
          hints: ["git reset secrets.tmp"],
          tip: "Observa cómo el archivo regresa de la caja verde (Staging) a la caja amarilla (Working Directory).",
          setup: {
            initialized: true,
            commits: [{ id: "C0", parents: [], message: "chore: init" }],
            branches: { main: "C0" },
            head: { type: "branch", ref: "main" },
            staging: {
              "app.js": { content: "run();" },
              "secrets.tmp": { content: "temp=123" },
            },
            workingDir: {
              "debug.log": { content: "error trace...", status: "untracked" },
              "cache.tmp": { content: "tmp", status: "untracked" },
            },
          },
          validate: (engine, res) =>
            res.ok && res.command.includes("secrets.tmp") && !engine.staging["secrets.tmp"],
        },
        {
          title: "Previsualiza la limpieza con git clean -n",
          body: "<p>Antes de borrar archivos <strong>untracked</strong> (temporales, logs, compilados), siempre usa <code>git clean -n</code> (dry run) para ver qué se eliminaría.</p>",
          syntax: "git clean -n",
          mission: "Ejecuta <code>git clean -n</code> para listar los archivos que serían eliminados sin borrarlos todavía.",
          demoCommand: "git clean -n",
          hints: ["git clean -n"],
          tip: "La bandera -n nunca borra nada; es tu red de seguridad.",
          validate: (_engine, res) => res.ok && res.command.includes("git clean") && res.command.includes("-n"),
        },
        {
          title: "Ejecuta la limpieza real con git clean -f",
          body: "<p>Una vez confirmaste que los archivos listados son temporales y no los necesitas, cambia <code>-n</code> por <code>-f</code> para eliminarlos definitivamente.</p>",
          syntax: "git clean -f",
          mission: "Ejecuta <code>git clean -f</code> y observa cómo desaparecen los archivos untracked del Working Directory.",
          demoCommand: "git clean -f",
          hints: ["git clean -f"],
          tip: "git clean -f solo elimina archivos untracked; no toca archivos rastreados por Git.",
          validate: (engine, res) =>
            res.ok &&
            res.command.includes("-f") &&
            Object.values(engine.workingDir).every((f) => f.status !== "untracked"),
        },
      ],
    },
    {
      slug: "l9-reset-modes",
      num: "09",
      title: "Dominando los modos de git reset",
      subtitle: "Compara git reset, git reset --hard y cómo retroceder la rama a un commit previo.",
      level: "Git Reset",
      steps: [
        {
          title: "Reinicia el Staging Area completo",
          body: "<p><code>git reset</code> sin argumentos vacía todo el Staging Area para que coincida con el último commit, dejando intactos tus cambios en el Working Directory.</p>",
          syntax: "git reset",
          mission: "Ejecuta <code>git reset</code> para vaciar el Staging Area sin perder tus modificaciones.",
          demoCommand: "git reset",
          hints: ["git reset"],
          tip: "Útil cuando hiciste 'git add .' demasiado pronto y prefieres elegir archivos uno a uno.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: perfil usuario" },
              { id: "C2", parents: ["C1"], message: "wip: prueba experimental" },
            ],
            branches: { main: "C2" },
            head: { type: "branch", ref: "main" },
            staging: { "perfil.js": { content: "// draft" } },
            workingDir: { "ui.css": { content: ".btn { color: red; }", status: "modified" } },
          },
          validate: (engine, res) =>
            res.ok && res.command.trim() === "git reset" && Object.keys(engine.staging).length === 0,
        },
        {
          title: "Retrocede la rama conservando cambios: git reset <commit>",
          body: "<p>Pasar un commit como argumento mueve el puntero de la rama hacia atrás. Observa cómo el commit anterior (<code>C2</code>) queda <strong>atenuado (huérfano)</strong> en el grafo, pero tus archivos locales se conservan.</p>",
          syntax: "git reset <commit>",
          mission: "Mueve <code>main</code> hacia atrás ejecutando <code>git reset C1</code>.",
          demoCommand: "git reset C1",
          hints: ["git reset C1", "git reset HEAD~1"],
          tip: "Los commits huérfanos no se borran al instante: Git los conserva temporalmente y puedes verlos con git reflog.",
          validate: (engine, res) => res.ok && engine.branches.main === "C1",
        },
        {
          title: "Reinicio total destructivo: git reset --hard <commit>",
          body: "<p><code>git reset --hard</code> mueve el puntero de la rama Y además <strong>sobrescribe</strong> Staging y Working Directory descartando cualquier cambio local no guardado.</p>",
          syntax: "git reset --hard <commit>",
          mission: "Ejecuta <code>git reset --hard C0</code> para regresar por completo al estado inicial.",
          demoCommand: "git reset --hard C0",
          hints: ["git reset --hard C0", "git reset --hard"],
          tip: "¡Precaución! Los cambios no confirmados en el Working Directory no se pueden recuperar tras un --hard.",
          validate: (engine, res) =>
            res.ok && res.command.includes("--hard") && engine.branches.main === "C0",
        },
      ],
    },
  ],
};
