---
name: constella-verify
description: Ritual de verificación de Bemberse/Constella. Úsalo antes de cerrar cualquier tarea del blueprint, y siempre que dudes de si el repo está verde.
---

# constella-verify

## When to use

- Antes de marcar cualquier tarea de `blueprints/constella-v2/tasks.json` como `done`.
- Después de cualquier cambio en `src/style.css`, `src/core/` o `src/viz/`.
- Antes de crear la etiqueta `step-NN-<slug>` de un paso.

## Steps

1. **Tipos primero.** `npm run typecheck`. Si falla, para aquí: lo demás dará errores
   derivados que te harán perder el tiempo.
2. **Lógica pura.** `npm test`. Cubre `src/core/` y los layouts. Es lo más rápido y lo que
   más veces salva.
3. **Build.** `npm run build`. Emite `dist/index.html` y `dist/app/index.html`.
4. **Presupuesto.** `npm run size`. Falla si el gzip total de `dist/` supera 120KB. Si se
   pasa, no lo subas el límite: mira qué dependencia entró.
5. **Navegador.** `npm run test:e2e`. Necesita el build del paso 3. Si es la primera vez en
   esta máquina: `npx playwright install chromium`.

En una línea:

```bash
npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e
```

## Verify

El ritual ha ido bien cuando los cinco comandos salen 0 y, además:

```bash
bash -c 'test -f dist/index.html && test -f dist/app/index.html'
bash -c '! grep -rEn "AudioContext|new Audio\(" src/'
```

ambos salen 0.

## Do not

- No marques una tarea como `done` con un `verify` a medias: la última orden del array
  tiene que haber salido 0.
- No subas el límite de `npm run size` para que pase. El límite es el presupuesto.
- No añadas dependencias de runtime para arreglar un test. La única permitida es `d3-force`.
- No toques `src/core/graph.ts` para que pase un test de otra capa: está cubierto por tests
  de caracterización a propósito.
