# Railway infrastructure

`.railway/railway.ts` is the single source of truth for the `lex-os` Railway project. It was
imported from both live environments before the former Config as Code files were removed.

The file intentionally preserves existing variable values without writing them to the repository.
It also preserves the environment difference that exists today: `web` is present in `staging` and
absent from `production`. Every application service follows GitHub `main` with `checkSuites`
enabled, so a failed CI run cannot start a Railway build.

## Safe workflow

1. Select the intended environment with `railway environment staging` or
   `railway environment production`.
2. Run `railway config plan` and review the complete change set.
3. Reject any unexpected deletion, variable replacement, volume change, or new service.
4. Run `railway config apply` only after that review.
5. Push reviewed application code to `main`; Railway deploys it only after the GitHub checks pass.

`config plan` is read-only. An infrastructure apply can itself trigger a build when it changes a
service source. Normal application deployment comes from the linked repository; do not replace it
with a local-directory upload. Never use `--show-values` in shared logs because it can reveal
unsealed variables.
