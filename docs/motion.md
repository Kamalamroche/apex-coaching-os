# Motion

APEX motion lives in two files in `packages/ui`:

- `src/motion.css`: timings and curves (`--ease-out`, `--ease-spring`, `--ease-liquid`, `--t-*`) and the app-wide rules. Screens rise in section by section, sheets slide up, toasts spring in, buttons press, ticks pop, the tab bar pill springs, bars grow, gauges and rings sweep, charts wipe in, routes draw themselves, and the theme switch cross-fades.
- `src/motion.tsx`: the moving parts.
  - `LiquidTank`: water that rises to a level with a moving surface and a one-off slosh when it changes. Full size for the water tracker, `size="mini"` as a habit icon.
  - `LiquidPill`: a glass pill that fills like liquid with a moving edge. `colour="status"` runs red to amber to green with the value; or pass a token.
  - `Wheel`, `NumberSheet`, `WheelInput`: a 3D number wheel in a sheet with Confirm. `WheelInput` is a normal input on a computer and opens the wheel on a phone, with "Type it instead".
  - `CountUp`: a number that counts to its value. Screen readers hear only the final value.

Rules

- Motion explains a change. It settles in under a second and only loops where the thing itself moves (water).
- No glows. Colours come from the tokens.
- "Reduce motion" on the device turns it all off (`styles.css` for CSS, `useReducedMotion` in the components).
- Animate `opacity`, `translate`, `scale` and `clip-path`, never layout. Entrance animations use `backwards` fill so nothing keeps a transform (a lasting transform would trap fixed sheets).
