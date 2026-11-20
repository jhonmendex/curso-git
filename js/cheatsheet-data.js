// Datos estructurados de toda la Hoja de Trucos de Atlassian (trucosGIt.pdf, páginas 1 y 2)
const CHEATSHEET_SECTIONS = [
  {
    title: "Git Basics (Fundamentos)",
    items: [
      { cmd: "git init <directory>", desc: "Crea un repositorio Git vacío en el directorio indicado (o en el actual si se omite).", lessonSlug: "l1-init-clone" },
      { cmd: "git clone <repo>", desc: "Clona un repositorio remoto o local en tu máquina.", lessonSlug: "l1-init-clone" },
      { cmd: "git config user.name <name>", desc: "Define el nombre de autor para los commits del repositorio (usa --global para tu usuario).", lessonSlug: "l3-config" },
      { cmd: "git add <directory|file>", desc: "Prepara (stage) los cambios de un archivo o directorio para el siguiente commit.", lessonSlug: "l2-stage-commit" },
      { cmd: "git commit -m \"<message>\"", desc: "Confirma el snapshot en staging usando un mensaje en línea.", lessonSlug: "l2-stage-commit" },
      { cmd: "git status", desc: "Lista los archivos en staging, modificados sin preparar y sin seguimiento (untracked).", lessonSlug: "l2-stage-commit" },
      { cmd: "git log", desc: "Muestra el historial completo de commits en el formato por defecto.", lessonSlug: "l4-log-basics" },
      { cmd: "git diff", desc: "Muestra las diferencias sin preparar entre el Index y el Working Directory.", lessonSlug: "l6-diff" },
    ],
  },
  {
    title: "Git Config (Opciones Adicionales)",
    items: [
      { cmd: "git config --global user.name <name>", desc: "Define el nombre de autor global para el usuario actual.", lessonSlug: "l3-config" },
      { cmd: "git config --global user.email <email>", desc: "Define el correo electrónico global para tus commits.", lessonSlug: "l3-config" },
      { cmd: "git config --global alias.<alias> <cmd>", desc: "Crea un atajo personalizado (ej. alias.glog \"log --graph --oneline\").", lessonSlug: "l3-config" },
      { cmd: "git config --system core.editor <editor>", desc: "Configura el editor de texto por defecto para todos los usuarios.", lessonSlug: "l3-config" },
      { cmd: "git config --global --edit", desc: "Abre el archivo de configuración global para edición manual.", lessonSlug: "l3-config" },
    ],
  },
  {
    title: "Git Log & Diff (Inspección)",
    items: [
      { cmd: "git log -<limit>", desc: "Limita la salida a los últimos N commits (ej. git log -2).", lessonSlug: "l4-log-basics" },
      { cmd: "git log --oneline", desc: "Condensa cada commit a una sola línea.", lessonSlug: "l4-log-basics" },
      { cmd: "git log -p", desc: "Muestra el diff completo (parche) de cada commit.", lessonSlug: "l4-log-basics" },
      { cmd: "git log --stat", desc: "Incluye los archivos alterados y líneas agregadas/eliminadas.", lessonSlug: "l4-log-basics" },
      { cmd: "git log --author=\"<pattern>\"", desc: "Filtra commits realizados por un autor específico.", lessonSlug: "l5-log-filters" },
      { cmd: "git log --grep=\"<pattern>\"", desc: "Busca commits cuyo mensaje coincida con el patrón.", lessonSlug: "l5-log-filters" },
      { cmd: "git log <since>..<until>", desc: "Muestra commits ocurridos en un rango de referencias.", lessonSlug: "l5-log-filters" },
      { cmd: "git log -- <file>", desc: "Muestra solo commits que tocaron un archivo específico.", lessonSlug: "l5-log-filters" },
      { cmd: "git log --graph --decorate", desc: "Dibuja el grafo ASCII de ramas y etiquetas junto al historial.", lessonSlug: "l5-log-filters" },
      { cmd: "git diff HEAD", desc: "Muestra diferencias entre el Working Directory y el último commit.", lessonSlug: "l6-diff" },
      { cmd: "git diff --cached", desc: "Muestra diferencias entre el Staging Area y el último commit.", lessonSlug: "l6-diff" },
    ],
  },
  {
    title: "Undoing Changes & Git Reset",
    items: [
      { cmd: "git revert <commit>", desc: "Crea un nuevo commit que deshace los cambios de <commit> sin alterar la historia previa.", lessonSlug: "l7-revert" },
      { cmd: "git reset <file>", desc: "Retira un archivo del Staging Area conservando los cambios en el Working Directory.", lessonSlug: "l8-unstage-clean" },
      { cmd: "git clean -n / git clean -f", desc: "Vista previa (-n) o borrado real (-f) de archivos untracked del Working Directory.", lessonSlug: "l8-unstage-clean" },
      { cmd: "git reset", desc: "Reinicia todo el Staging Area al último commit sin tocar el Working Directory.", lessonSlug: "l9-reset-modes" },
      { cmd: "git reset --hard", desc: "Reinicia Staging y Working Directory al último commit sobrescribiendo cambios locales.", lessonSlug: "l9-reset-modes" },
      { cmd: "git reset <commit>", desc: "Mueve la rama hacia atrás a <commit> y reinicia staging, conservando el Working Directory.", lessonSlug: "l9-reset-modes" },
      { cmd: "git reset --hard <commit>", desc: "Mueve la rama a <commit> y descarta todos los cambios y commits posteriores.", lessonSlug: "l9-reset-modes" },
    ],
  },
  {
    title: "Git Branches (Ramas y Fusiones)",
    items: [
      { cmd: "git branch", desc: "Lista las ramas del repositorio (agrega <branch> para crear una nueva).", lessonSlug: "l10-branches" },
      { cmd: "git checkout -b <branch>", desc: "Crea una nueva rama y cambia a ella inmediatamente (sin -b cambia a una existente).", lessonSlug: "l10-branches" },
      { cmd: "git merge <branch>", desc: "Fusiona los cambios de <branch> dentro de la rama actual.", lessonSlug: "l11-merge" },
    ],
  },
  {
    title: "Rewriting Git History (Reescritura)",
    items: [
      { cmd: "git commit --amend", desc: "Reemplaza el último commit combinando los cambios en staging o editando su mensaje.", lessonSlug: "l12-amend" },
      { cmd: "git rebase <base>", desc: "Reaplica los commits de la rama actual sobre <base> creando una historia lineal.", lessonSlug: "l13-rebase" },
      { cmd: "git rebase -i <base>", desc: "Inicia un rebase interactivo para reordenar, combinar (squash) o eliminar commits.", lessonSlug: "l14-rebase-reflog" },
      { cmd: "git reflog [--relative-date|--all]", desc: "Muestra el registro local de movimientos de HEAD para rescatar commits perdidos.", lessonSlug: "l14-rebase-reflog" },
    ],
  },
  {
    title: "Remote Repositories (Remotos)",
    items: [
      { cmd: "git remote add <name> <url>", desc: "Crea una conexión con un repositorio remoto bajo un alias como origin.", lessonSlug: "l15-remote-fetch" },
      { cmd: "git fetch <remote> [branch]", desc: "Descarga commits y referencias del remoto sin modificar tus ramas locales.", lessonSlug: "l15-remote-fetch" },
      { cmd: "git pull <remote>", desc: "Descarga los cambios del remoto y los fusiona (merge) en tu rama actual.", lessonSlug: "l16-pull-rebase" },
      { cmd: "git pull --rebase <remote>", desc: "Descarga cambios del remoto y reaplica tus commits locales encima con rebase.", lessonSlug: "l16-pull-rebase" },
      { cmd: "git push <remote> <branch>", desc: "Envía tu rama y sus commits al repositorio remoto.", lessonSlug: "l17-push-options" },
      { cmd: "git push <remote> --force", desc: "Fuerza el push aunque no sea fast-forward (usar solo en ramas propias reescritas).", lessonSlug: "l17-push-options" },
      { cmd: "git push <remote> --all", desc: "Envía todas tus ramas locales al remoto especificado.", lessonSlug: "l17-push-options" },
      { cmd: "git push <remote> --tags", desc: "Envía todas tus etiquetas (tags) locales al remoto.", lessonSlug: "l17-push-options" },
    ],
  },
];
