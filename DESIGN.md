# Design

## Theme

Light. Cream background with a terracotta accent, deliberately warmer than a typical dark corporate SaaS product. Chosen this session's predecessor after Reddit feedback that the original dark/neon-green theme read as untrustworthy for a CV tool.

## Color

```
--bg:          #FBF8F2   body background
--bg-elevated: #FFFFFF   cards, panels
--bg-subtle:   #F5F1E8
--bg-muted:    #EBE5D8

--text-primary:   #2A251F
--text-heading:   #191510
--text-secondary: #6B6459
--text-tertiary:  #9A9184
--text-inverse:   #FFFFFF

--border:        rgba(42,37,31,0.10)
--border-strong: rgba(42,37,31,0.16)

--accent:        #D26A4A   terracotta, primary brand color
--accent-hover:  #BB5636
--accent-subtle: rgba(210,106,74,0.10)
--accent-text:   #AF4F2B
--accent-border: rgba(210,106,74,0.28)

--score-high: #1E9E5A
--score-mid:  #C7871B
--score-low:  #D14343
```

Not OKLCH (predates this skill's install), hex/rgba throughout. Identity-preservation wins over converting the format: keep these values, don't recompose the palette.

## Typography

- `--font-display`: Bricolage Grotesque (headings) — deliberately not the body font, gives the brand its own voice.
- `--font-sans`: Inter (body).
- `--font-mono`: DM Mono (score numbers, technical bits).

## Radius scale

```
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 10px
--radius-xl: 14px
```
Already inside impeccable's recommended card ceiling (12-16px). Don't push past `--radius-xl`.

## Shadow scale

```
--shadow-xs / sm / md / lg / xl
--shadow-lift  (multi-layer, used for the elevated Pro pricing card)
```

## Motion tokens (already defined, underused)

```
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1)
```

framer-motion is already a dependency and used for hero stagger, scroll-reveal (`data-sr` + IntersectionObserver), and a few component transitions. No GSAP/anime.js/Lenis in the project; stay on framer-motion + CSS transitions rather than introducing a new motion library.

## Components

Bespoke CSS in `src/app/globals.css` (2184 lines), no Tailwind/shadcn/Radix. Key patterns already in place: score ring (SVG arc, animated count-up), dimension bars (animated fill), stepper ("how it works"), pricing cards (Pro tier elevated), testimonial quote card, mobile hamburger nav, sliding-pill URL/PDF toggle.
