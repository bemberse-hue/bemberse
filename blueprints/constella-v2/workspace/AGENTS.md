# AGENTS.md

Las instrucciones de este repo viven en [`CLAUDE.md`](./CLAUDE.md). Léelo antes de tocar
nada: contiene los comandos reales, la arquitectura y las siete reglas que no se negocian.

Resumen mínimo para no romper nada:

- TypeScript vanilla + Vite. **Sin framework de UI.** No introduzcas React, Next ni Tailwind.
- Verificación antes de cerrar una tarea:
  `npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e`
- `src/core/` es lógica pura sin DOM. `DB_VERSION` se queda en 2.
- Cero sonido, cero cronómetros.

El plan de trabajo está en `blueprints/constella-v2/`. Para saber qué toca:
`/architect-next` desde la raíz del repo.
