# field-ui starter

The first five minutes with field-ui — a plain **Vite + HTML** app that consumes the packages the
way any outside project would. No framework, no canvas code, no per-element wiring.

```bash
pnpm install
pnpm --filter @fundamental-engine/starter dev      # http://localhost:5180
pnpm --filter @fundamental-engine/starter build    # bundles the workspace packages
```

> In this monorepo the dependencies are `workspace:*`. Outside the repo they are ordinary installs:
> `npm install @fundamental-engine/core @fundamental-engine/elements @fundamental-engine/platform`.

## What it shows

One recipe — [`priority-well`](https://field-ui.com/docs/gallery#priority-well) — demonstrated three ways. The whole integration lives in [`src/main.ts`](src/main.ts).

1. **Declarative.** A single `<field-root>` renders a background field and scans the document for
   `[data-body]` elements. Importing `@fundamental-engine/elements` once is what turns the tag on.

   ```html
   <field-root></field-root>
   <button data-body="attract">Primary action</button>
   ```

2. **`applyRecipe()`.** Run a recipe over markup that already exists. The recipe frames which metrics
   it tracks and writes them back as `--field-*` custom properties your CSS reads.

   ```ts
   import { recipeById } from '@fundamental-engine/core';
   import { applyRecipe } from '@fundamental-engine/platform';
   const applied = applyRecipe(root, recipeById('priority-well')!, { bodies });
   applied.inspect(); // { frame, measurements, relationships, lint }
   ```

3. **`bindData()`.** Records drive the field. Each record becomes a body, its mapped metrics become
   field state, and the same recipe supplies the behavior. Updates diff by id; removed records decay
   out rather than popping.

   ```ts
   import { bindData } from '@fundamental-engine/platform';
   const binding = bindData(root, tasks, (t) => ({
     id: t.id,
     body: { tokens: ['attract'], strength: 0.4 + t.priority },
     metrics: { priority: t.priority },
     label: t.title,
   }), { recipe: 'priority-well' });
   binding.update(nextTasks);
   ```

## Reduced motion

The toggle re-runs both surfaces with `reducedMotion: true`. The recipe carries its own static
fallback (`compileRecipe(recipe).reducedMotion`), so the page stays meaningful with motion off —
weight and badges remain; only the travel stops.

## Lanes

field-ui keeps its vocabulary in strict lanes: **concepts describe · tokens execute · metrics measure
· diagnostics explain · conditions activate · recipes compose.** Only a recipe's runtime tokens
(`attract`, `gravity`, …) ever become `data-body` behavior — concepts are never executed. This
starter only ever writes real body tokens and reads real `--field-*` metrics.
