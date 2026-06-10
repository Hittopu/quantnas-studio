# Open-source Stack Notes

## Prototype choice

This repository currently uses native HTML, CSS, and JavaScript with a tiny local static server. The reason is practical: the current workspace does not expose a working `npm`, so a zero-install prototype lets us move on visual direction, task payload shape, and backend API integration immediately.

## Recommended production stack

- Vite + React for the production front-end. Vite has a fast dev server, optimized production builds, and first-class React templates.
- Motion for React for state-driven page transitions, progress animation, and result reveal interactions.
- lucide-react for crisp SVG icons that remain tree-shakable in the final bundle.
- Optional later additions: TanStack Query for NAS job polling, Zod for payload validation, Radix UI for accessible low-level controls, and shadcn/ui only if we want a reusable internal component system.

## Why not start with a heavy UI kit?

The visual identity here needs to feel like a research platform, not a generic SaaS dashboard. The prototype therefore uses custom layout, typography, gradients, and motion language. A component library can still be introduced later for primitives, but the brand surface should remain custom.

## Source references

- Vite guide: https://vite.dev/guide/
- React quick start: https://react.dev/learn
- Motion for React: https://motion.dev/docs/react
- Lucide React guide: https://lucide.dev/guide/react
