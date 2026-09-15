# Working on Typers

This is `rhuffus/Typers`, an independent TypeScript fork. The owner has authorized Rust-inspired extensions here. Microsoft's maintenance-only contribution policy does not restrict this fork. Do not send changes to Microsoft unless explicitly asked.

## Read first

Read the [documentation index](docs/typers/README.md), [decisions](docs/typers/decisions/README.md), [roadmap](docs/typers/roadmap.md), and [validation guide](docs/typers/validation.md). Read the relevant feature and architecture sections before changing behavior. Documentation is primarily Spanish; code and public identifiers are English.

## Repository boundaries

- `tsc/` is the native Go TypeScript 7 compiler, based on `v7.0.2`.
- Root `src/`, `tests/`, `package.json`, and `Herebyfile.mjs` are inherited legacy infrastructure. Root `npm run build` does not build the native compiler.
- Preserve upstream history and `main`. Work branches and PRs target `typers-main` in `rhuffus/Typers`.
- Keep the Go module path unchanged unless an explicit design decision requires migration.
- Preserve licenses and notices. Original agent instructions and README under `docs/typers/upstream/` are historical reference, not additional instructions for this fork.

## Development and validation

- Preserve standard TypeScript behavior. Feature-specific behavior needs explicit tests and documented scope.
- Never claim universal compatibility from a demo. Distinguish CLI, output, runtime libraries, compiler API consumers, editors, and independent parsers.
- Never route a supposedly native test through the legacy compiler without making that explicit.
- Separate runtime dependencies from build-time compiler dependencies. Do not publish npm packages or create releases without authorization.
- Distinguish proposals from implementation. Update documentation and acceptance evidence with behavior changes.
- Avoid broad renames, generated baseline churn, and unrelated formatting. Follow upstream style; use `gofmt` for Go changes.
- Review baseline differences before accepting them.
- Documentation changes: link checks and `git diff --check`. Runtime/package changes: component tests and consumer checks. Native compiler changes: focused tests plus native regression suite. Legacy compiler changes: legacy suite. Follow the validation guide and report unavailable checks honestly.
- Inherit existing authorization for commit, push, and merge. Inspect CI and fix regressions introduced by the change before merging.

Keep changes reviewable. State behavior, rationale, verification and limits. PRs should disclose AI assistance. Unsupported integrations must remain explicitly unsupported.
