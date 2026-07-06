Kit Factory is the internal Best Collective workbook builder. It turns kit markdown into styled PDFs, fillable workbooks, website mockups, and package exports.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Useful Commands

```bash
npm test
npm run proofs
npm run proofs:designs
npm run proofs:packages
npm run lint
npm run build
```

`npm run proofs` writes review files to `output/visual-proof-pack/latest/`, including cover overviews, website mockups, full PDF contact sheets, and the Meet at the Heal package proof.

Use `npm run proofs:designs` when you only need the design-family cover, mockup, and full-PDF contact sheets. Use `npm run proofs:packages` when you only need Brand ZIP and Meet at the Heal ZIP package proof artifacts.

## Source Of Truth Docs

- `docs/best-collective-branch-system.md` explains the Best Collective branch ecosystem, branch/product-flow rules, and how Brand, Rise, Land, Rebuild, and Meet at the Heal relate.
- `docs/kit-factory-markdown-format.md` explains the markdown page types and fields the app accepts.
- `docs/approved-color-palettes.md` lists the locked color palettes for each design family.

## Notes

Generated proof files live under `output/`, which is ignored by git.
