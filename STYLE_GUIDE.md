## Styling Guide

This document captures the styling system and conventions used in this project so they can be replicated across new projects.

### Stack Overview
- **CSS loading**: Global stylesheet imported once in `pages/_app.js`.
- **Scoping**: CSS Modules for component/page-level styles (`*.module.css`).
- **Theming**: CSS custom properties (variables) defined in `styles/global.css`, switched via `html[data-theme='dark']`.
- **No utility framework**: No Tailwind/Sass/etc. Only vanilla CSS, CSS Modules, and inline styles for small one-off layout tweaks.

### Global CSS (`styles/global.css`)
- Resets: `box-sizing: border-box`, zeroed `html, body` margins, system font stack, `line-height: 1.6`, base `font-size: 18px`.
- Markdown hygiene: responsive code blocks and images under `.markdown`, underline links inside `.markdown`.
- Accessibility: honors `prefers-reduced-motion: reduce` by disabling transitions/animations.
- Text wrapping: `overflow-wrap: anywhere` for `a, p, li, code` to prevent horizontal scroll.

#### Theme Tokens
Defined on `:root` (light) and `html[data-theme='dark']` (dark):
- `--bg`, `--text`, `--muted-text`, `--border`, `--link`, `--hover-bg`
- Status colors: `--success-text`, `--success-bg`, `--error-text`, `--error-bg`

Usage guidelines:
- Always use tokens instead of hard-coded colors in new CSS.
- Transition theme-aware properties with `transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease` when interactive.

#### Forms and Body
- `body` colors derive from theme tokens with smooth transitions.
- Form controls inherit fonts; interactive controls transition theme vars.

### Theming Behavior
- `ThemeToggle` sets `data-theme` on `<html>` to `light` or `dark` and persists to `localStorage`.
- Components should rely on CSS variables; avoid color literals to maintain theme parity.

### CSS Modules
Files: `styles/utils.module.css`, `styles/links.module.css`, `styles/projects.module.css`, `components/layout.module.css`.

Common utilities:
- Headings: `.heading2Xl`, `.headingXl`, `.headingLg`, `.headingMd` (responsive at 480px).
- `.borderCircle` for circular avatars/images.
- Lists: `.list`, `.listItem` (unstyled list with vertical rhythm).
- `.lightText` for subdued/secondary text using `--muted-text`.

Link/button pattern (`links.module.css`):
- `.linkButton`: inline-flex, centered, 10px gap, 12x16 padding, 10px radius, 1px `--border`, hover uses `--hover-bg` with slight translate.
- `.container`: vertical stack, constrained width, responsive tweaks under 480px.

Projects link (`projects.module.css`):
- `.projectLink`: pill-like anchor using `--text`; focus-visible outline with `--border`.

Layout container (`components/layout.module.css`):
- `.container`: page width and outer spacing.
- `.header`: vertical, centered header with avatar and title.
- `.backToHome`: top margin for back link area.

### Inline Style Conventions
Inline styles are used sparingly for:
- One-off layout primitives (simple flex boxes, margins, gap) inside page components.
- Back links: bordered, rounded pill using theme vars.
- Countdown footer: monospace, bold, theme-colored text.

When inline styles repeat or grow, migrate them to a CSS Module and consume theme tokens.

### Accessibility and Responsiveness
- Minimum touch sizes on links/buttons in small viewports (see media queries in modules).
- `focus-visible` styles for keyboard users on interactive elements.
- Images are responsive by default; markdown images centered and constrained.

### Usage Examples

Headings in a page:
```jsx
import utilStyles from '../styles/utils.module.css';

export default function Page() {
  return (
    <section className={utilStyles.headingMd}>
      <h1 className={utilStyles.headingLg}>Section Title</h1>
      <p className={utilStyles.lightText}>Secondary copy using muted color.</p>
    </section>
  );
}
```

CTA links using the shared button style:
```jsx
import Link from 'next/link';
import links from '../styles/links.module.css';

<div className={links.container}>
  <Link className={links.linkButton} href="/projects">Projects</Link>
  <a className={links.linkButton} href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>
  {/* Add more as needed */}
}</div>
```

Theme-safe custom component snippet:
```css
/* components/MyCard.module.css */
.card {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 12px;
  padding: 16px;
  transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
.title { font-weight: 700; }
.subtitle { color: var(--muted-text); }
```

### Replicating in New Projects
1. Copy `styles/global.css` and import it in `pages/_app.js`.
2. Copy CSS Modules you need (`utils.module.css`, `links.module.css`, etc.).
3. Implement a theme toggle that sets `data-theme` on `<html>` (optional) or default to light only.
4. Use tokens (`var(--...)`) everywhere; avoid hard-coded colors.
5. Keep inline styles minimal; promote to modules when reused.

### Naming and Structure
- Prefer descriptive class names that convey purpose (`.projectLink`, `.linkButton`).
- Keep module files focused by domain (utils, links, projects, layout).
- Avoid deep selectors; prioritize single-class selectors for composability.

### Do/Don't
- Do: rely on CSS variables for colors and spacing-related borders.
- Do: add `transition` for interactive elements.
- Do: respect reduced motion.
- Don't: introduce conflicting global styles; keep new globals minimal.
- Don't: hard-code color values in components; use theme tokens instead.


