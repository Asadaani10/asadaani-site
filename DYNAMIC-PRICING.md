# Dynamic pricing — deployment guide

This adds a daily-refreshed pricing snapshot to `reviews.html`, covering all
6 hosts now shown there (Hostinger, Bluehost, HostGator, DreamHost,
Hosting.com, Namecheap), using your existing Cloudflare Worker.

## Per-host status

Based on actually fetching each host's live pricing page, not just assuming:

| Host | Status |
|---|---|
| Hostinger | ✅ Verified — server-rendered, scraped daily |
| Bluehost | ✅ Verified — server-rendered, scraped daily |
| DreamHost | ✅ Verified — server-rendered, scraped daily |
| Namecheap | ✅ Verified — server-rendered, scraped daily |
| Hosting.com | ⚠️ Best-guess anchor ("Starter"), page structure not confirmed — watch its first few runs before trusting it |
| **HostGator** | ❌ **Not scraped at all.** Its pricing page renders `$X.XX/mo` as literal placeholder text server-side; the real number is filled in afterward by client-side JavaScript, which a plain server-side fetch never runs — no anchor tweak fixes this. Its price on the site (marked with `*`) is a manually-entered static value instead of a fake "live" one. |

## What was added

- `worker.js` — replaces the plain static-assets Worker. It still serves your
  site exactly as before, but now also:
  - answers `GET /api/pricing` with the latest known price for each of the
    5 scrapable hosts
  - runs a scheduled job once a day that re-checks each host's pricing page
- `js/pricing.js` — runs in the browser, fetches `/api/pricing`, and updates
  any element tagged `data-price-id`. If the fetch fails, or a host has no
  data (like HostGator, which is intentionally excluded), the static price
  already in the HTML is left as-is.
- `reviews.html` — the comparison table and host cards now cover all 6
  hosts, with `data-price-id` on the 5 that get auto-checked.
- `wrangler.toml` — now points to `worker.js`, adds a KV namespace binding
  (`PRICING_KV`), and a cron trigger.

## Why this isn't literally "live per visitor" data

Hosting companies don't expose an API for "current price" — the number on
their page depends on term length, region, and rotating promos, and even
independent tracking sites disagree with each other on it day to day. So
instead of scraping fresh on every single page view (slow, and a good way to
get your Worker's IP rate-limited or blocked), the Worker checks once a day
in the background and every visitor gets that day's cached snapshot —
reliable and fast, with a visible "Pricing auto-checked daily — last checked
[date]" note near the table.

If a scrape ever fails (a host redesigns their page, changes wording, etc.),
the Worker keeps showing the last successful price rather than a blank or
broken one — check the `ok` / `lastError` fields in the KV entry to see why.

## Deployment steps

### 1. Create the KV namespace
In the Cloudflare dashboard: **Storage & Databases → KV → Create namespace**,
name it something like `asadaani-pricing`. Copy the namespace ID it gives you.

### 2. Update `wrangler.toml`
Open `wrangler.toml` in your repo and replace:
```toml
id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"
```
with the ID you just copied.

### 3. Push all the changed/new files to GitHub
Same process as before — upload or edit directly on GitHub, making sure these
land at the repo root / correct folders:
- `worker.js` (repo root)
- `wrangler.toml` (repo root, replacing the old one)
- `js/pricing.js` (inside your existing `js` folder)
- `reviews.html` (replacing the old one)

### 4. Bind the KV namespace in the Cloudflare Worker settings
Cloudflare dashboard → your Worker project → **Settings → Bindings → Add
binding → KV Namespace**:
- Variable name: `PRICING_KV`
- KV namespace: the one you created in step 1

(This step matters even though it's also declared in `wrangler.toml` — on
first deploy from Git, confirm it shows up under Bindings in the dashboard.)

### 5. Trigger a deploy
Push a commit, or use **New deployment** in the Cloudflare dashboard like
before.

### 6. Manually trigger the first price check
The cron job runs once a day on its own, but you don't have to wait a full
day to see it work the first time:
- Cloudflare dashboard → your Worker → **Triggers** tab → find the Cron
  Trigger → there's usually a way to view recent executions, or you can wait
  for the next scheduled run and check **Logs** in the meantime.
- Alternatively, visit `https://asadaani.com/api/pricing` directly in your
  browser once — if it returns `{"hostinger":null,"bluehost":null,...}`,
  the endpoint works but no scheduled run has happened yet. That's expected
  before the first cron fire.

### Checking it worked
Once the first scheduled run has happened:
1. Visit `https://asadaani.com/api/pricing` — you should see real numbers
   with `"ok":true` for each host.
2. Visit `https://asadaani.com/reviews.html` — the price cells should match
   what's in that JSON, and the small note under the table should say
   "Pricing auto-checked daily — last checked [today's date]."
3. If any host shows `"ok":false`, read its `lastError` field — that tells
   you whether the page structure changed and the anchor text in `worker.js`
   needs updating.
