# Desarrollo (commits y changelog)

## Convención de commits y pull requests

### Formato del subject (una línea)

`type(scope): descripción en imperativo, minúsculas, sin punto final`

| type | Cuándo usarlo |
|------|----------------|
| `feat` | Comportamiento nuevo (usuario o integración) |
| `fix` | Corrección de bug o regresión |
| `chore` | Mantenimiento (deps, tooling) sin cambio funcional |
| `docs` | Solo documentación |
| `refactor` | Cambio interno sin cambiar comportamiento |
| `test` | Solo tests |
| `ci` | Pipelines, Actions, hooks de CI |
| `build` | Empaquetado, bundler, native prebuild relacionado con build |
| `perf` | Mejora de rendimiento |
| `revert` | Revierte un commit anterior |

**Breaking change:** en el cuerpo del commit, línea `BREAKING CHANGE: …` (Commitizen lo guía; `standard-version` lo usa en el changelog).

### Pull requests

- Título alineado con Conventional Commits (especialmente si merges con **squash**).
- Cuerpo: contexto, cambios, test plan (usa la plantilla en [`.github/pull_request_template.md`](.github/pull_request_template.md)).
- PRs pequeños cuando sea posible (más fácil de revisar y revertir).

### Ramas (naming)

Formato recomendado:

`type/descripcion-corta-en-kebab-case`

| Prefijo | Uso típico |
|---------|------------|
| `feature/` | Funcionalidad nueva |
| `fix/` | Corrección de bug |
| `chore/` | Deps, tooling, CI, sin cambio de producto |
| `refactor/` | Refactor sin cambiar comportamiento |
| `docs/` | Solo documentación |
| `test/` | Solo tests |

Ejemplos: `feature/auth-email-link`, `fix/ios-firebase-pods`, `chore/dependabot-weekly`.

Opcional con ticket: `feature/42-onboarding-flow`. Evitar nombres genéricos (`wip`, `tmp`).

### Happy path: rama + add + commit + push

Desde la rama base en la que quieras bifurcar (suele ser `main` actualizado), con cambios ya hechos en el working tree:

```bash
npm run git:flow -- <type> <kebab-slug> "<conventional commit subject>"
```

Ejemplo:

```bash
npm run git:flow -- feature fcm-token-handler "feat(push): add FCM token refresh listener"
```

Eso crea `feature/fcm-token-handler`, ejecuta `git add -A`, `git commit -m "…"` y `git push -u origin …`.

El **mensaje del commit** lo pasas tú (Conventional Commits); si prefieres asistente interactivo, crea la rama a mano y usa `npm run commit` o `npm run commit:ai`.

### CI en GitHub

| Workflow | Qué hace |
|----------|-----------|
| [ci.yml](.github/workflows/ci.yml) | `npm ci`, `npm run lint` (Biome), `npm run typecheck` en `push` y `pull_request` a `main` |
| [semantic-pr.yml](.github/workflows/semantic-pr.yml) | Valida que el **título del PR** siga Conventional Commits (útil con *squash merge*) |
| [commitlint.yml](.github/workflows/commitlint.yml) | Valida los **mensajes de commit** del PR con [commitlint.config.cjs](./commitlint.config.cjs) |
| [dependency-review.yml](.github/workflows/dependency-review.yml) | Revisa dependencias nuevas en el PR (severidad configurable) |

Actualizaciones de dependencias: [dependabot.yml](.github/dependabot.yml) (npm y GitHub Actions).

**Commitlint en local** (opcional, contra `main`):

```bash
npm run commitlint
```

Si tu rama base no se llama `main`, usa por ejemplo: `npx commitlint --from origin/develop --to HEAD --verbose`.

## Lint / formato (Biome)

Este proyecto usa **[Biome](https://biomejs.dev/)** para formatear y lintear TypeScript/React Native más rápido que ESLint+Prettier en la mayoría de flujos.

```bash
npm run lint        # biome check .
npm run lint:fix    # biome check --write .
npm run format      # biome format --write .
```

Si necesitas las reglas específicas de **Expo** que Biome aún no cubre por completo:

```bash
npm run lint:eslint
```

En VS Code/Cursor instala la extensión recomendada **Biome**; el repo incluye `.vscode/settings.json` con formato al guardar.

## Commits con Commitizen

Este repo usa mensajes de commit estilo **Conventional Commits** con `commitizen` + `cz-conventional-changelog`.

- Crear un commit guiado:

```bash
npm run commit
```

## Commits automáticos (AI)

Si tienes `OPENAI_API_KEY` en tu `.env`, puedes generar el mensaje automáticamente desde el diff staged:

```bash
git add .
npm run commit:ai
```

## Changelog / releases

El changelog se genera desde los commits convencionales con `standard-version`.

- Generar/actualizar `CHANGELOG.md` y crear tag de versión:

```bash
npm run release
```

Notas:
- `npm run release` actualiza `CHANGELOG.md` y `package.json` (versión) según los commits.
- Si no quieres crear tag automáticamente, puedes usar `npx standard-version --skip.tag`.

