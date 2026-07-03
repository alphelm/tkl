# Cooling Station 3D Generator

A single-page, self-contained tool that generates the three printable parts
(base plenum, dome cover, graduated diffuser plate) from the guide in
`../README.md`, parametrically, from your colander's measured diameter. It
does real boolean-cut geometry (vac port bore, colander seat, dome inlet
slot, crown vents, graduated diffuser holes) using
[`three-bvh-csg`](https://github.com/gkjohnson/three-bvh-csg), renders a
live Three.js preview, and exports binary STL per component.

`dist/coffee-cooling-station.html` is the built, ready-to-open artifact —
no server, no install, just open it in a browser. It's fully self-contained
(Three.js, the CSG library, and two embedded fonts are all inlined), so it
also works offline once downloaded.

## Rebuilding after a source change

```sh
npm install
npm run build
```

This runs esbuild over `src/main.js` (the parametric geometry engine +
Three.js scene) into `dist/bundle.js`, then `build.js` stitches
`header.html` (styles/markup) + the bundle + `footer.html` (UI wiring) into
`dist/coffee-cooling-station.html`.

The `b64/` folder holds the two embedded typefaces
(Fraunces for headings, JetBrains Mono for technical/data text) already
base64-encoded — `build.js` inlines them as `@font-face` data URIs so the
page needs no external font requests.

## Source layout

- `src/main.js` — parameter derivation + the three geometry builders
  (`buildBaseBox`, `buildDomeCover`, `buildDiffuserPlate`) + Three.js scene
  setup + STL export helpers. No DOM/UI code lives here — it's usable
  headless (see the `buildAll(input)` entry point).
- `header.html` — `<style>` + the page markup (design tokens, layout, the
  parameter form, the viewport shell).
- `footer.html` — the UI glue script: reads form inputs, debounces
  regeneration, wires the visibility toggles/explode slider/download
  buttons to the scene.
