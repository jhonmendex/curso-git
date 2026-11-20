// Sección 04: Ramas y Fusiones (Git Branches & Merge)
const MODULE_04_BRANCHES = {
  id: "mod-04",
  title: "04. Ramas y Merge",
  color: "#22c55e",
  open: false,
  lessons: [
    {
      slug: "l10-branches",
      num: "10",
      title: "Crear y navegar ramas",
      subtitle: "Aísla nuevas funcionalidades con git branch y git checkout -b.",
      level: "Git Branches",
      steps: [
        {
          title: "Lista las ramas existentes",
          body: "<p>Las ramas en Git son punteros livianos a un commit. Ejecutar <code>git branch</code> sin argumentos muestra todas tus ramas locales y marca la activa con un asterisco <code>*</code>.</p>",
          syntax: "git branch",
          mission: "Ejecuta <code>git branch</code> para ver en qué rama te encuentras.",
          demoCommand: "git branch",
          hints: ["git branch"],
          tip: "En el visualizador, la rama activa (HEAD) siempre aparece resaltada en amarillo con un asterisco (*).",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: landing page" },
            ],
            branches: { main: "C1" },
            head: { type: "branch", ref: "main" },
          },
          validate: (_engine, res) => res.ok && res.command.trim() === "git branch",
        },
        {
          title: "Crea y cambia a una rama en un paso",
          body: "<p><code>git checkout -b &lt;branch&gt;</code> crea una nueva rama apuntando al commit actual y mueve <code>HEAD</code> hacia ella inmediatamente.</p>",
          syntax: "git checkout -b <branch>",
          mission: "Crea y activa la rama <code>feature</code> ejecutando <code>git checkout -b feature</code>.",
          demoCommand: "git checkout -b feature",
          hints: ["git checkout -b feature"],
          tip: "Equivale a ejecutar 'git branch feature' seguido de 'git checkout feature'.",
          validate: (engine, res) =>
            res.ok && engine.getCurrentBranchName() === "feature",
        },
        {
          title: "Haz un commit en tu nueva rama",
          body: "<p>Ahora que <code>HEAD</code> apunta a <code>feature</code>, cada nuevo commit hará avanzar solo a <code>feature</code> mientras <code>main</code> permanece estable en <code>C1</code>.</p>",
          syntax: 'git commit -m "<message>"',
          mission: 'Ejecuta <code>git commit -m "feat: login form"</code> y observa cómo <code>feature</code> avanza respecto a <code>main</code>.',
          demoCommand: 'git commit -m "feat: login form"',
          hints: ['git commit -m "feat: login form"'],
          tip: "En este laboratorio puedes confirmar directo cuando el árbol está limpio para practicar ramificación al estilo LearnGitBranching.",
          validate: (engine, res) =>
            res.ok && engine.branches.feature !== engine.branches.main,
        },
        {
          title: "Regresa a la rama main",
          body: "<p>Sin la bandera <code>-b</code>, <code>git checkout &lt;branch&gt;</code> cambia a una rama que ya existe.</p>",
          syntax: "git checkout <branch>",
          mission: "Vuelve a la rama principal ejecutando <code>git checkout main</code>.",
          demoCommand: "git checkout main",
          hints: ["git checkout main"],
          tip: "Observa cómo la etiqueta amarilla con el asterisco (*) salta de vuelta a main.",
          validate: (engine, res) => res.ok && engine.getCurrentBranchName() === "main",
        },
      ],
    },
    {
      slug: "l11-merge",
      num: "11",
      title: "Fusionar ramas con git merge",
      subtitle: "Integra el trabajo de una rama en otra y observa cómo se forma un Merge Commit.",
      level: "Git Branches",
      steps: [
        {
          title: "Crea divergencia en main",
          body: "<p>Tienes una rama <code>feature</code> en <code>C2</code> y estás en <code>main</code> en <code>C1</code>. Hagamos un commit en <code>main</code> para que ambas ramas diverjan y necesiten un <strong>merge de 3 vías</strong>.</p>",
          syntax: 'git commit -m "<message>"',
          mission: 'Ejecuta <code>git commit -m "fix: hotfix header"</code> en <code>main</code> para ver la bifurcación en el grafo.',
          demoCommand: 'git commit -m "fix: hotfix header"',
          hints: ['git commit -m "fix: hotfix header"'],
          tip: "Cuando ambas ramas tienen commits propios desde su ancestro común, Git creará un commit con 2 padres.",
          setup: {
            initialized: true,
            commits: [
              { id: "C0", parents: [], message: "chore: init" },
              { id: "C1", parents: ["C0"], message: "feat: base" },
              { id: "C2", parents: ["C1"], message: "feat: buscador" },
            ],
            branches: { main: "C1", feature: "C2" },
            head: { type: "branch", ref: "main" },
          },
          validate: (engine, res) =>
            res.ok && engine.branches.main !== "C1" && engine.branches.main !== "C2",
        },
        {
          title: "Fusiona feature dentro de main",
          body: "<p><code>git merge &lt;branch&gt;</code> toma los cambios de la rama indicada y los integra en tu rama actual (<code>main</code>), creando un <strong>Merge Commit</strong> que une ambas líneas.</p>",
          syntax: "git merge <branch>",
          mission: "Ejecuta <code>git merge feature</code> y observa el nuevo commit con doble línea de padres.",
          demoCommand: "git merge feature",
          hints: ["git merge feature"],
          tip: "El anillo punteado alrededor del nodo indica que es un Merge Commit con dos padres.",
          validate: (engine, res) => {
            const headId = engine.getHeadCommitId();
            return res.ok && headId && engine.commits[headId].parents.length === 2;
          },
        },
      ],
    },
  ],
};
