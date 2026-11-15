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
  --color-paper: oklch(91.8% 0.014 248);  --color-paper-2: oklch(85% 0.019 250.6);  --color-paper-3: oklch(100% 0 0);
  --color-ink: oklch(24% 0.076 257.2);  --color-ink-2: oklch(28.3% 0.069 258.9);  --color-muted: oklch(43.9% 0.033 240.4);  --color-rule: oklch(82.5% 0.025 254);
  --color-accent: oklch(37.8% 0.182 262.5);  --color-accent-2: oklch(57.5% 0.213 29.6);  --color-accent-ink: oklch(99.5% 0.003 250);  --color-focus: oklch(37.8% 0.182 262.5);
  --font-display: "Chivo Mono", "Nanum Gothic Coding", ui-monospace, monospace;  --font-body: var(--font-display);  --font-outlier: var(--font-body);
  --radius-card: 0;  --radius-pill: 999px;  --rule-hair: 1px;  --rule-bar: 2px;  --shadow-card: 0 24px 40px -24px oklch(8% 0.01 260 / 0.6);
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

Project roles on top of the theme:
- Status in four kinds, never by colour alone: `--color-live` (blue fill, open now and 24 hours), `--color-soon` (red fill under white text, closes within 30 min), `--color-closed` (paper with a 2px ink border), `--color-unknown` (grey paper, hairline).
- One surface for everything: the board, the map card and the plates sit on `--color-paper-3` inside a 2px ink border with ink figures. Only the status plate fills with its status colour. `--color-band` is now just the board's head row; it stays dark in the night colourway. Red appears only as the closing-soon fill and the icon's door handle; the read-only band is pale 705 C.
- The map card's head row is the board row itself (shared `BoardRowContent`), so a place reads the same in the list and on the map.
- Mashil palette (2026-11-15): the two restroom-sign colours, never mixed. Blue = Pantone 286 C `#0033A0` (accent: open now, the primary action, focus; lifted to `#2F5FD0` in the night colourway). Red = Pantone 485 C `#DA291C` (accent-2: the one signal). No gradient and no blended violet between them. Every other colour is a Pantone too: paper 656 C `#DDE5ED`, rest fill 538 C, rule 537 C, ink 282 C navy `#041E42`, ink-2 2767 C, muted 7545 C; night paper Black 6 C `#101820`, surfaces 433 C, rule 432 C, ink 656 C, muted 7543 C, accent 2726 C, focus 2717 C; notice band 705 C (night 7421 C) with ink text; error 1805 C (night 1785 C). The app icon uses the same two: blue tile, white door, red handle (`--color-door-*`).
- Brand values that are not the theme: the Kakao, Google and Apple sign-in buttons (their own guides).
- MUI cannot compute OKLCH or CSS variables, so `src/design/tokens.ts` keeps hex copies for MUI only. Screen code uses the CSS variables.

## Controls
- Primary: blue (286 C) fill · square · 52px (44px in dense rows)
- Secondary: transparent with a 2px ink border · square · same height
- Choice sets: square cells sharing 2px borders; the chosen cell fills ink with paper text

## Motion
- Character: severe. Colour changes in `steps(1)` at `--dur-micro`, rows update in place, no reveal; under reduced motion everything ends at once.

## Exports
`src/styles/tokens.css` in this project, plus the MUI mirror in `src/design/tokens.ts`. The Flutter app (Mashil-App `app/lib/theme.dart`) copies the same values for its native screens.
