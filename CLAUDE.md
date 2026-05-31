# claude.md — Distinct Hospitality Solutions
### Design System, Coding Rules & AI Collaboration Guidelines
> Version 1.0 · Drishti Studio · May 2026

---

## 1. The Aesthetic DNA

This project has a single north star: **clean, modern, and unforgettable.**

We draw from three archetypes — hold all three in tension at once:

| Archetype | What it brings |
|---|---|
| **Chanel — Classic** | Restraint. Monochrome confidence. Nothing excess. Every element earns its place. |
| **Tesla — Modern** | Precision engineering. Dark surfaces with surgical light. Technology that feels inevitable. |
| **Frida Kahlo — Soulful** | Boldness that is human, not corporate. Culture. Presence. Something that looks back at you. |

**The Golden Ratio governs all spatial decisions.** Whitespace, type scale, layout proportions, image crop ratios — all derived from φ = 1.618. If a spacing decision feels arbitrary, recalculate it.

### What this means in practice

- **High and bespoke.** This is not a SaaS template. It is a bespoke brand presence.
- **Every screen should feel designed, not generated.** If it looks like a default, it is wrong.
- **Restraint over decoration.** Add elements only if removing them would hurt. Luxury communicates through absence.
- **Emotion over information.** Copy and layout should make you feel something first, understand something second.

---

## 2. Visual Language

### 2.1 Color System

```css
/* ── Core Palette ────────────────────────────────────────── */
--color-obsidian:     #0A0A0A;   /* primary black — backgrounds, type */
--color-ivory:        #F7F4EF;   /* warm off-white — never pure white */
--color-gold:         #C9A96E;   /* accent — used sparingly, never flooding */
--color-platinum:     #D8D8D8;   /* borders, dividers */
--color-charcoal:     #1C1C1E;   /* secondary dark surfaces */
--color-smoke:        #6E6E73;   /* secondary text, labels */

/* ── Extended ─────────────────────────────────────────────── */
--color-gold-muted:   #A8895A;   /* gold on light backgrounds */
--color-surface-dark: #111111;   /* card backgrounds in dark mode */
--color-surface-light:#FAFAF8;   /* card backgrounds in light mode */

/* ── Semantic ─────────────────────────────────────────────── */
--color-text-primary:   var(--color-obsidian);
--color-text-secondary: var(--color-smoke);
--color-text-inverse:   var(--color-ivory);
--color-accent:         var(--color-gold);
--color-border:         var(--color-platinum);
```

**Rules:**
- Never use pure `#000000` or `#FFFFFF` — use obsidian and ivory.
- Gold is an accent, not a theme color. Maximum one gold element per viewport.
- Dark sections use `--color-charcoal` or `--color-surface-dark`, not black.
- No gradients except: a subtle `obsidian → charcoal` on dark hero sections.

### 2.2 Typography

```css
/* ── Type Scale (Golden Ratio: base 16px × 1.618) ──────── */
--text-xs:   0.618rem;   /* 10px — legal, labels */
--text-sm:   0.764rem;   /* 12px — captions */
--text-base: 1rem;       /* 16px — body */
--text-md:   1.236rem;   /* ~20px — lead copy */
--text-lg:   1.618rem;   /* ~26px — sub-headlines */
--text-xl:   2rem;       /* 32px — section titles */
--text-2xl:  2.618rem;   /* ~42px — page headlines */
--text-3xl:  4.236rem;   /* ~68px — hero display */
--text-4xl:  6.854rem;   /* ~110px — large display / hero */

/* ── Font Families ──────────────────────────────────────── */
--font-display:  'Cormorant Garamond', Georgia, serif;    /* headlines — classical elegance */
--font-body:     'DM Sans', system-ui, sans-serif;         /* body — clean, modern */
--font-label:    'DM Mono', monospace;                     /* labels, tags, data — precision */
```

**Rules:**
- `--font-display` for H1, H2, and any large hero text. Set at light or regular weight (300–400) for large sizes — bold display type is rarely correct here.
- `--font-body` for all body copy, nav, buttons, and UI elements.
- `--font-label` for eyebrow labels, tags, metric numbers, and technical strings (e.g. "TR Ai N", version numbers).
- Letter-spacing: display text gets `letter-spacing: 0.02em`; labels and all-caps get `letter-spacing: 0.12em`.
- Line-height: display = 1.1; body = 1.618 (the ratio, always).
- Never bold a display headline above `--text-2xl`.

### 2.3 Spacing System

```css
/* ── Spacing (all derived from 8px base × φ) ───────────── */
--space-1:   0.25rem;    /* 4px */
--space-2:   0.5rem;     /* 8px */
--space-3:   0.75rem;    /* 12px */
--space-4:   1rem;       /* 16px */
--space-5:   1.618rem;   /* ~26px — φ × base */
--space-6:   2rem;       /* 32px */
--space-8:   3.236rem;   /* ~52px — φ² × base */
--space-10:  5.236rem;   /* ~84px */
--space-12:  8rem;       /* 128px — section padding */
--space-16:  12.944rem;  /* ~207px — hero breathing room */
```

**Rule:** All margin, padding, and gap values must be one of the above tokens. Do not introduce arbitrary pixel values.

### 2.4 Layout Grid

- 12-column grid, max-width `1440px`, gutters `var(--space-6)`.
- Section padding: `var(--space-12)` top/bottom on desktop, `var(--space-8)` on mobile.
- Hero section: minimum `90vh`, content vertically centered.
- Prefer asymmetric layouts (7/5, 8/4 column splits) over symmetric 6/6.
- Horizontal rhythm follows the Golden Ratio: where an image occupies 61.8% of a row, the copy occupies 38.2% — or inverse.

### 2.5 Motion

- **Entrance animations:** fade-up with `translateY(24px) → 0`, `opacity: 0 → 1`, duration `0.6s`, easing `cubic-bezier(0.16, 1, 0.3, 1)` (expo out).
- **Stagger siblings** at `0.08s` intervals.
- **Hover states:** scale `1 → 1.02` on cards, color shift on links — duration `0.2s`.
- **Marquee/ticker:** CSS `animation: marquee linear infinite` — no JS dependency. Pause on hover.
- **No bouncy/spring animations.** No emoji-style motion. Nothing that feels playful or startup-y.
- **Respect `prefers-reduced-motion`:** All animations must have a `@media (prefers-reduced-motion)` override that disables transform/opacity transitions.

### 2.6 Imagery Style

- Photography: dark, moody, high-contrast. Hotel lobbies, candlelit restaurants, staff in motion.
- Never stock-photo bright and airy.
- Images always have a subtle `mix-blend-mode: multiply` or `overlay` with a dark tint when placed over text.
- Aspect ratios: 16:9 for wide hero, 4:3 for cards, 1:1 for team/profile. Maintain these — never stretch.
- Images never float freely — always contained in a defined grid column or full-bleed block.

---

## 3. Component Patterns

### 3.1 Buttons

```css
/* Primary — dark fill */
.btn-primary {
  background: var(--color-obsidian);
  color: var(--color-ivory);
  border: 1px solid var(--color-obsidian);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: background 0.2s, color 0.2s;
}
.btn-primary:hover {
  background: var(--color-gold);
  border-color: var(--color-gold);
  color: var(--color-obsidian);
}

/* Ghost — transparent */
.btn-ghost {
  background: transparent;
  color: var(--color-ivory);
  border: 1px solid var(--color-ivory);
  /* same padding/type as primary */
}
.btn-ghost:hover {
  background: var(--color-ivory);
  color: var(--color-obsidian);
}
```

- No border-radius on buttons — sharp corners only.
- No shadows on buttons.
- All buttons use `text-transform: uppercase` and tracked letters.

### 3.2 Navigation

- Fixed to top, `backdrop-filter: blur(12px)` on scroll, background `rgba(10,10,10,0.85)`.
- Logo left-aligned. Links right-aligned. No center nav.
- Active page: gold underline `2px solid var(--color-gold)`.
- Mobile: full-screen overlay menu, not a side drawer.
- CTA button in nav (e.g. "Book a Demo") uses `.btn-primary`.

### 3.3 Section Eyebrow Labels

```html
<span class="eyebrow">Live Guest Sentiment Intelligence</span>
```
```css
.eyebrow {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-gold);
}
```
Always appears above a headline. Never stand-alone.

### 3.4 Cards

- No rounded corners (`border-radius: 0`).
- Thin `1px` border in `var(--color-platinum)` — or borderless on dark backgrounds.
- On hover: border color shifts to `var(--color-gold)`, slight `translateY(-4px)` lift.
- No card shadows unless on a light background section.

### 3.5 Dividers

- Use `1px solid var(--color-platinum)` — never `<hr>` defaults.
- Decorative dividers: thin `40px` gold line `var(--color-gold)` centered, used sparingly (max once per page).

---

## 4. Content Rules

- **"TR Ai N"** — this is a brand name. Always capitalize exactly as shown: `TR Ai N`. The lowercase `i` is intentional (AI embedded). Never write "Train", "TRAIN", or "TrAiN".
- **"GuestSight"** — one word, capital G and S. Never "Guest Sight" or "Guestsight".
- **"DISTINCT"** and **"Distinct"** — full caps when used as the platform/product name standalone; title case when used in full brand name ("Distinct Hospitality Solutions").
- **"NeuroNerd"** — one word, capital N both times.
- Copy tone: authoritative, never hype-y. Short sentences. Declarative.
- No exclamation marks in headings.
- Numbers and data points are set in `--font-label` (monospace) for precision feel.

---

## 5. Coding Rules

### 5.1 General

- **No assumptions.** If a requirement is ambiguous, stop and ask before writing code. Document the assumption if you proceed with one.
- **No magic numbers.** Every numerical value in CSS must reference a design token or be derivable from the token system.
- **Follow the PRD.** Every page, section, link, copy string, and CTA must match the PRD exactly. Do not invent, rephrase, or omit.
- **Progressive enhancement.** Base HTML must be functional without JavaScript. JS enhances — it does not gate.
- **Semantic HTML.** Use `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>` correctly. Never `<div>` where a semantic element exists.
- **Accessibility first.** WCAG 2.1 AA minimum. All images have `alt` text. All interactive elements are keyboard-navigable. Color contrast ratio ≥ 4.5:1 for body, ≥ 3:1 for large text.
- **Mobile-first.** Write base CSS for mobile, use `min-width` breakpoints to scale up.

### 5.2 File & Folder Structure

```
/
├── src/
│   ├── components/       # Reusable UI components
│   ├── layouts/          # Page layouts
│   ├── pages/            # Route files (Home, About, Products, Privacy)
│   ├── styles/
│   │   ├── tokens.css    # All design tokens (colors, type, spacing)
│   │   ├── global.css    # Reset + base styles
│   │   └── components/   # Per-component CSS modules
│   ├── assets/
│   │   ├── images/       # Local image assets
│   │   └── video/        # train1.mp4
│   └── lib/              # Utility functions, form handlers
├── public/               # Static assets (favicon, robots.txt)
├── claude.md             # This file — always in repo root
├── PRD.md or PRD.docx    # PRD — always in repo root
└── README.md
```

### 5.3 CSS Rules

- All design tokens live in `tokens.css` and are imported globally. Never hardcode a color, size, or spacing value.
- CSS custom properties (variables) only — no Sass variables, no JS-in-CSS unless framework requires.
- No `!important` except for utility overrides (e.g. `.sr-only`).
- Class naming: BEM-lite — `.block`, `.block__element`, `.block--modifier`. No random class names.

### 5.4 JavaScript Rules

- Vanilla JS for DOM interactions and simple animations.
- No jQuery.
- ES modules only (`import`/`export`) — no CommonJS in browser code.
- All event listeners use named functions (not anonymous) for debuggability.
- `addEventListener` over inline handlers (`onclick=""` is forbidden).
- Async operations use `async/await` — no raw `.then()` chains.
- Error states: every async function has a `try/catch`. Failures surface to the user — never silent.

### 5.5 Forms

- All form fields have associated `<label>` elements (not placeholder-only).
- Required fields marked with both HTML `required` attribute and visible indicator.
- Inline validation: errors shown below the field, not via `alert()`.
- Form submit must be prevented while reCAPTCHA is unverified.
- No form data touches the client beyond what's needed — no logging to console in production.

### 5.6 Performance

- Images: use `<picture>` with `webp` source + jpg fallback. Always set `width` and `height` attributes.
- Video: native `<video>` with `preload="none"` and `poster` thumbnail. No autoplay without `muted` + `playsinline`.
- Fonts: load via `<link rel="preconnect">` + `font-display: swap`.
- No blocking scripts in `<head>`. External scripts deferred or async.
- Lighthouse score targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

---

## 6. Testing Protocol

### 6.1 Before Writing Code — Plan

1. Read the relevant PRD section in full.
2. Identify all content elements (copy, links, media) and confirm they exist in the asset inventory.
3. Flag any dependency on an unresolved open question (PRD §11) before starting.
4. Write a brief implementation plan (comments in the file or a short note) before the first line of code.

### 6.2 While Writing Code — Execute

- Implement one section at a time. Complete and verify before moving to the next.
- Test in the browser after every meaningful change — not just at the end.
- Check against the PRD checklist for the section you just built.
- Run the linter before committing.

### 6.3 After Writing Code — Verify

**Per-component checklist:**
- [ ] Copy matches PRD exactly (no paraphrasing, no missing text)
- [ ] All links match PRD exactly (href, mailto, tel)
- [ ] Images have correct alt text as described in PRD
- [ ] Component is keyboard-navigable (Tab, Enter, Escape work correctly)
- [ ] Component works without JavaScript enabled
- [ ] Component renders correctly at 375px, 768px, 1280px, 1440px
- [ ] Color contrast passes WCAG AA
- [ ] Animations respect `prefers-reduced-motion`
- [ ] No console errors or warnings

**Per-page checklist (run before marking a page done):**
- [ ] Page title is correct
- [ ] Nav active state is correct for this page
- [ ] All sections present and in correct order per PRD
- [ ] All CTAs functional (mailto/tel links open correctly; form submits correctly)
- [ ] Cookie banner appears and persists preference
- [ ] Footer present with correct copy and links
- [ ] Lighthouse audit run and scores meet targets

### 6.4 Cross-Browser

Test in: Chrome (latest), Safari (latest), Firefox (latest), Safari iOS 16+, Chrome Android.
Report any deviation as a bug — do not work around it silently.

---

## 7. AI Collaboration Rules (for Claude sessions)

These rules govern how Claude should work on this codebase when given tasks.

1. **Read the PRD before writing any code.** If you don't have the PRD in context, ask for it.
2. **Read claude.md before making any visual or design decision.** If you don't have claude.md in context, ask for it.
3. **Never assume.** If a requirement is unclear, ask a specific question. Do not fill the gap with a guess.
4. **One task at a time.** Complete and confirm the current task before starting the next.
5. **State your plan before executing.** Before writing code for a new section, briefly describe what you are about to build and why. Wait for confirmation if uncertain.
6. **Flag conflicts.** If the PRD and claude.md conflict, flag it explicitly. Do not silently pick one.
7. **Do not invent content.** Copy, links, and media must come from the PRD. If the PRD has a gap, flag it — do not write placeholder copy.
8. **No lorem ipsum.** Ever.
9. **Design tokens only.** Never hardcode a color, font, size, or spacing value. Always use CSS variables from `tokens.css`.
10. **Test after each section.** After implementing a section, verify the per-component checklist before declaring it done.
11. **Commit messages are descriptive.** Format: `[section] what was done` — e.g. `[home/hero] add animated ticker with reduced-motion fallback`.
12. **If something was not scraped, say so.** Do not invent an image, link, or copy string that is marked as "not scraped" or "pending" in the PRD.

---

## 8. What This Is Not

To be explicit about what we are not building:

- Not a startup landing page with purple gradients and Inter font.
- Not a SaaS dashboard template.
- Not a GoDaddy-style drag-and-drop output.
- Not "clean and minimal" in the sense of empty or boring.
- Not "luxury" in the sense of gold-everything and serif overload.

We are building something that feels like it was commissioned, not generated.

---

*This file is the source of truth for all design and code decisions. If anything in this project contradicts claude.md, claude.md wins — unless the PRD explicitly overrides it for a specific case, which must be noted in both documents.*
