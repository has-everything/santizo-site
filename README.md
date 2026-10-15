# santizo.com, version B

The editorial redesign of [santizo.com](https://santizo.com), built alongside the current SantizoOS site (version A, [santizo-os](https://github.com/has-everything/santizo-os)) so the two can be compared side by side.

Static [Astro](https://astro.build) site: content in `src/data/`, one component per section in `src/components/`, one file per page in `src/pages/`.

```
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

Deploys on Vercel from `main`. While this is version B, every page is `noindex` (see `indexable` in `src/data/site.ts`).

See [CLAUDE.md](CLAUDE.md) for the structure, common edits, and the launch checklist.
