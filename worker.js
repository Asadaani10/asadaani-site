// Asadaani — Cloudflare Worker
// Serves the static site as-is, and keeps a small pricing snapshot fresh
// via a daily scheduled job (see wrangler config [triggers]).
//
// Only Hostinger and DreamHost are actually scraped. Other hosts were tried
// and removed for specific reasons:
//   - HostGator: price is filled in by client-side JavaScript; a plain
//     fetch() never sees it.
//   - Bluehost, Namecheap: return HTTP 403 to Cloudflare Worker requests.
//   - Hosting.com: no confirmed pricing page structure to scrape.
// Their prices on the site are manually maintained static values.
//
// The scraper fails safely: if a page layout changes or a price looks
// implausible (outside min/max), the bad value is discarded and the static
// price already written in the HTML stays visible.

const HOSTS = [
  {
    id: "hostinger",
    name: "Hostinger",
    url: "https://www.hostinger.com/pricing",
    anchor: "Premium", // text just before the plan's discounted monthly price
    min: 1,
    max: 6
  },
  {
    id: "dreamhost",
    name: "DreamHost",
    url: "https://www.dreamhost.com/pricing/",
    anchor: "Web Hosting Launch",
    min: 1,
    max: 6
  }
];

// Replace tags with a SPACE (not empty string) so adjacent elements
// don't merge their digits into one bogus number.
function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

// Checks EVERY occurrence of the anchor (the first one may be a menu item),
// tolerates spaces such as "$ 2.49 /mo", and returns the smallest plausible
// value (the intro rate is always lower than the renewal rate).
function extractPrice(text, anchor, min, max) {
  const candidates = [];
  let from = 0;

  while (true) {
    const idx = text.indexOf(anchor, from);
    if (idx === -1) break;
    const windowText = text.slice(idx, idx + 800);

    // Pattern A: a price already written per month, e.g. "$2.95/mo"
    for (const m of windowText.matchAll(/\$\s*(\d{1,3}\.\d{2})\s*\/\s*mo/gi)) {
      candidates.push(parseFloat(m[1]));
    }

    // Pattern B: total price + term, e.g. "Get 48 months for $143.52"
    for (const m of windowText.matchAll(/(\d{1,2})\s*months?\s*for\s*\$\s*(\d{1,4}\.\d{2})/gi)) {
      const months = parseInt(m[1], 10);
      if (months > 0) candidates.push(parseFloat(m[2]) / months);
    }

    from = idx + anchor.length;
  }

  const values = candidates
    .map((v) => Math.round(v * 100) / 100)
    .filter((v) => !isNaN(v) && v >= min && v <= max);

  return values.length ? Math.min(...values) : null;
}

async function refreshHost(host, env) {
  const key = `price:${host.id}`;
  const now = new Date().toISOString();
  try {
    const res = await fetch(host.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = stripToText(html);
    const price = extractPrice(text, host.anchor, host.min, host.max);
    if (price === null) {
      throw new Error("price not found, or outside expected $" + host.min + "-$" + host.max + " range");
    }

    const record = { id: host.id, name: host.name, price, currency: "USD", asOf: now, ok: true };
    await env.PRICING_KV.put(key, JSON.stringify(record));
    return record;
  } catch (err) {
    // Keep the last known-good price, but ONLY if it is still within the
    // plausible range. A previously stored bad value (e.g. 10.99) is dropped,
    // so the static price in the HTML shows instead.
    const existingRaw = await env.PRICING_KV.get(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const existingValid =
      existing &&
      typeof existing.price === "number" &&
      existing.price >= host.min &&
      existing.price <= host.max;

    const failRecord = {
      id: host.id,
      name: host.name,
      price: existingValid ? existing.price : null,
      currency: "USD",
      asOf: existingValid ? existing.asOf : null,
      ok: false,
      lastError: String(err),
      lastAttempt: now
    };
    await env.PRICING_KV.put(key, JSON.stringify(failRecord));
    return failRecord;
  }
}

async function handlePricingApi(env) {
  const results = {};
  for (const host of HOSTS) {
    const raw = await env.PRICING_KV.get(`price:${host.id}`);
    results[host.id] = raw ? JSON.parse(raw) : null;
  }
  return new Response(JSON.stringify(results), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=1800"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Manual refresh for testing. Requires a secret named REFRESH_KEY
    // (Cloudflare -> Worker -> Settings -> Variables and Secrets).
    // Usage: /api/refresh?key=YOURSECRET   (delete this block if not needed)
    if (
      url.pathname === "/api/refresh" &&
      env.REFRESH_KEY &&
      url.searchParams.get("key") === env.REFRESH_KEY
    ) {
      const out = [];
      for (const host of HOSTS) out.push(await refreshHost(host, env));
      return new Response(JSON.stringify(out, null, 2), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }

    if (url.pathname === "/api/pricing") {
      return handlePricingApi(env);
    }

    // Everything else: serve the static site untouched.
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    for (const host of HOSTS) {
      ctx.waitUntil(refreshHost(host, env));
    }
  }
};
