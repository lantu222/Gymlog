# Usage events: the pipeline and its retention

The app sends eight anonymous usage events to our own Vercel endpoint (the
vocabulary is `src/lib/analytics.ts`; the privacy policy lists every event).
This page is the operator's view: where the data sits, how long, and what keeps
that promise.

| Piece | Where |
|---|---|
| Vocabulary and validation (shared by client and server) | `src/lib/analytics.ts` |
| Device queue, install id, the Settings switch's gate | `src/features/analytics/analyticsClient.ts` |
| Sink and reader | `api/events.ts` → private Vercel Blob store, `events/YYYY-MM-DD/<batch>.json` |
| Report and dashboard | `node scripts/analytics-report.cjs`, `analytics.cmd` |
| Retention rule | `src/lib/analyticsRetention.ts` (`ANALYTICS_RETENTION_MONTHS = 24`) |
| Retention enforcement | `api/prune-events.ts`, scheduled by `vercel.json` |

## The user's switch

Settings → Usage statistics (`usageStatisticsEnabled`, on by default). The client
sends nothing until App.tsx has handed it the stored preference after hydration,
so a reader who turned it off never has a batch leave during startup. Off also
drops the queue and the install id; on again starts as a new install.

## Retention: 24 months, deleted automatically

The policy says events are kept for up to 24 months and then deleted
automatically. `vercel.json` runs `/api/prune-events` on the first of every
month at 04:00 UTC (Hobby plan: once a day is the maximum frequency, and the
run lands somewhere inside that hour). The endpoint lists `events/`, keeps
every batch whose arrival day is inside the window, and deletes the rest in
chunks of a hundred. It is idempotent, so a skipped or doubled run is harmless.

`tests/lib/analyticsRetention.test.cjs` pins the number in the policy to the
constant, the cron path to an existing function, the schedule to a fixed
monthly run, and `.vercelignore` to letting `vercel.json` through.

### One-time setup in Vercel

1. Project → Settings → Environment Variables: add `CRON_SECRET` (any random
   string of 16+ characters, production scope). Vercel sends it as
   `Authorization: Bearer <CRON_SECRET>` on every cron call; the endpoint
   refuses anything else.
2. Deploy (`npx vercel --prod`). `vercel.json` is uploaded because
   `.vercelignore` allows it by name. The cron then appears under Project →
   Settings → Cron Jobs, with a View Logs link.
3. Dry run from your machine, proven with the analytics read secret:

```bash
node scripts/prune-events.cjs --dry
```

   The first real deletion is due in September 2028; until then the dry run
   reports zero expired batches, which is the right answer.

### Changing the period

Change `ANALYTICS_RETENTION_MONTHS`, then the two policy sentences the test
names (English and Finnish) in `src/lib/legalDocuments.ts`, bump
`LEGAL_LAST_UPDATED`, re-run `node scripts/export-legal.cjs`, and redeploy.
