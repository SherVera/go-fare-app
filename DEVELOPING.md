# Desarrollo (commits y changelog)

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

