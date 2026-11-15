# Design: 마실 웹

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (map and nearby board, detail, filter sheet, login, consent, report, admin)
- Theme: Wayfind (catalog), colourway `platform`, `night` in dark mode
- Axes: light/mono/cool · posture: committed
- Signature: the nearby board, restrooms as departure rows (distance, name and facilities, status at the right edge) on the same paper as the rest of the app, inside a 2px ink border with an ink head row

## Tokens
`src/styles/tokens.css` is the source of truth. The roles:
```css
:root {
  --color-paper: oklch(95.5% 0.006 250);  --color-paper-2: oklch(91% 0.009 250);  --color-paper-3: oklch(99.5% 0.005 250);
  --color-ink: oklch(16% 0.014 262);  --color-ink-2: oklch(29% 0.014 262);  --color-muted: oklch(47% 0.016 260);  --color-rule: oklch(80% 0.011 250);
  --color-accent: oklch(51% 0.22 264);  --color-accent-2: oklch(81% 0.16 82);  --color-accent-ink: oklch(99.5% 0.003 250);  --color-focus: oklch(51% 0.22 264);
  --font-display: "Chivo Mono", "Nanum Gothic Coding", ui-monospace, monospace;  --font-body: var(--font-display);  --font-outlier: var(--font-body);
  --radius-card: 0;  --radius-pill: 999px;  --rule-hair: 1px;  --rule-bar: 2px;  --shadow-card: 0 24px 40px -24px oklch(8% 0.01 260 / 0.6);
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

Project roles on top of the theme:
- Status in four kinds, never by colour alone: `--color-live` (cobalt fill, open now and 24 hours), `--color-soon` (amber fill under ink, closes within 30 min), `--color-closed` (paper with a 2px ink border), `--color-unknown` (grey paper, hairline).
- `--color-band` is the ink band for the plates and the board's head row; it stays dark in the night colourway so amber only ever sits on ink. Board distances are ink on paper, never amber.
- Brand values that are not the theme: the Kakao, Google and Apple sign-in buttons (their own guides) and the app icon's open door (`--color-door-*`).
- MUI cannot compute OKLCH or CSS variables, so `src/design/tokens.ts` keeps hex copies for MUI only. Screen code uses the CSS variables.

## Controls
- Primary: cobalt fill · square · 52px (44px in dense rows)
- Secondary: transparent with a 2px ink border · square · same height
- Choice sets: square cells sharing 2px borders; the chosen cell fills ink with paper text

## Motion
- Character: severe. Colour changes in `steps(1)` at `--dur-micro`, rows update in place, no reveal; under reduced motion everything ends at once.

## Exports
`src/styles/tokens.css` in this project, plus the MUI mirror in `src/design/tokens.ts`. The Flutter app (Mashil-App `app/lib/theme.dart`) copies the same values for its native screens.
