# Contributing

Thanks for your interest in improving this Cloudflare multiplayer 2D golf demo.

## How to Contribute

1. Fork the repository.
2. Create a feature branch from `main`.
3. Make a focused change.
4. Run the verification commands.
5. Open a pull request with a concise summary and test notes.

## Development Setup

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000` and use multiple browser windows or profiles to test multiplayer rooms locally.

## Code Style

- TypeScript is strict; run `npx tsc --noEmit` before opening a PR.
- Keep shared protocol changes in `src/game/types.ts` synchronized with `GolfRoom` and `useGolfRoom`.
- Keep game physics deterministic. Clients should send shot intent, not authoritative positions.
- Prefer small, readable changes over broad rewrites.

## Commit Messages

Use clear, imperative commit messages such as `Add spectator cursor tests` or `Fix pickup scoring display`.

## Pull Request Process

PRs should include:

- A short summary of the change.
- Screenshots for visible UI changes.
- Tests or a clear explanation when tests are not practical.
- Confirmation that verification commands pass.

## Bug Reports

Use the bug report template and include reproduction steps, browser details, expected behavior, and actual behavior.

## Feature Requests

Use the feature request template and describe the gameplay or developer-experience problem the feature solves.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
