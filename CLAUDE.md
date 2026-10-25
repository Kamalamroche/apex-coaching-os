# APEX Coaching OS: notes for Claude

- Run `npm run check` before every push. Schema changes: also run `supabase/tests/run.sh` against a scratch Postgres.
- Keep logic in `packages/core` (pure, tested) and visuals in `packages/ui`. Screens in `apps/web` should stay thin.
- Use the Athletic Tech tokens (`packages/ui/src/tokens.css`). No new colours outside the token set.
- Every AI output in the UI carries a label: Data, Insight, AI suggestion or Coach decision. AI never changes client-facing data without the coach accepting.
- Kamal's rules: never remove a working feature, no new dependencies without a stated reason, no copied competitor content (videos, illustrations, descriptions, branding).
- UK English in copy. Units default to kg.
