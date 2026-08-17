// Asadaani — Cloudflare Worker
// Serves the static site as-is, and keeps a small pricing snapshot fresh
// via a daily scheduled job (see wrangler.toml [triggers]).
//
// IMPORTANT — read this before changing anything below:
// Hosting companies do not publish a stable, single "current price" number.
// The figure on their pricing page depends on term length, region/currency,
// and time-limited promos, and can shift at any time. This scraper is built
// to fail safely: if a page's layout changes or a price looks implausible,
// we keep the last known-good value instead of showing something wrong.
//
// Also: not every host's price is even obtainable this way. HostGator's
// pricing page renders "$X.XX/mo" as literal placeholder text server-side,
// with the real number filled in afterward by client-side JavaScript — a
// plain fetch() like this Worker does will never see it. That's why
// HostGator isn't in the HOSTS list below; its price on the site is a
// manually-maintained static value instead.

const HOSTS = [
  {
    id: "hostinger",
    name: "Hostinger",
    url: "https://www.hostinger.com/pricing",
    anchor: "Premium",   // text just before the plan's discounted monthly price
    min: 0.5,
    max: 50
  },
  {
    id: "bluehost",
    name: "Bluehost",
    url: "https://www.bluehost.com/pricing",
    anchor: "Starter",
    min: 0.5,
    max: 50
  },
  {
    id: "dreamhost",
    name: "DreamHost",
    url: "https://www.dreamhost.com/pricing/",
    anchor: "Web Hosting Launch",
    min: 0.5,
    max: 50
  },
  {
    id: "namecheap",
    name: "Namecheap",
    url: "https://www.namecheap.com/hosting/shared/",
    anchor: "Stellar",
    min: 0.5,
    max: 50
  },
  {
    id: "hostingcom",
    name: "Hosting.com",
    url: "https://hosting.com/web-hosting/",
    anchor: "Starter",
    min: 0.5,
    max: 50,
    // Anchor/URL are a best guess from third-party sources, not confirmed
    // against Hosting.com's live markup the way the others above were.
    unverified: true
  }
  // HostGator intentionally excluded: confirmed (by fetching the live page)
  // that its price is rendered as literal "$X.XX/mo" placeholder text and
  // filled in client-side by JavaScript. A server-side fetch never sees a
  // real number, so scraping it would only ever fail. Its price on the site
  // stays as a manually-entered static value instead — see reviews.html.
];

// Replace tags with a SPACE (not empty string). This matters: if two
// adjacent page elements (e.g. a "Save 33%" badge and a price) get joined
// with no separator, their digits can merge into one bogus number
// (seen in testing: "$6" + "14.99/mo" -> "$614.99/mo"). A space prevents that.
function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function extractPrice(text, anchor, min, max) {
  const idx = text.indexOf(anchor);
  if (idx === -1) return null;
  const windowText = text.slice(idx, idx + 800);

  const candidates = [];

  // Pattern A: a price already written per month, e.g. "$2.95/mo"
  for (const m of windowText.matchAll(/\$(\d{1,3}\.\d{2})\s*\/\s*mo/gi)) {
    candidates.push(parseFloat(m[1]));
  }

  // Pattern B: a total contract price + term length, with no "/mo" figure
  // at all for the discounted rate — e.g. Hostinger writes
  // "Get 48 months for $143.52" instead of "$2.99/mo". Compute it ourselves.
  for (const m of windowText.matchAll(/(\d{1,2})\s*months?\s*for\s*\$(\d{1,4}\.\d{2})/gi)) {
    const months = parseInt(m[1], 10);
    const total = parseFloat(m[2]);
    if (months > 0) candidates.push(total / months);
  }

  // Multiple patterns can surface both the intro rate and the renewal
  // rate in the same window — the intro/discounted rate is always the
  // smaller number, so take the minimum of everything found.
  const values = candidates
    .map((v) => Math.round(v * 100) / 100)
    .filter((v) => !isNaN(v) && v >= min && v <= max);

  if (!values.length) return null;
  return Math.min(...values);
}

async function refreshHost(host, env) {
  const key = `price:${host.id}`;
  const now = new Date().toISOString();
  try {
    const res = await fetch(host.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AsadaaniPriceBot/1.0; +https://asadaani.com)" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = stripToText(html);
    const price = extractPrice(text, host.anchor, host.min, host.max);
    if (price === null) throw new Error("price not found, or outside expected $" + host.min + "-$" + host.max + " range");

    const record = { id: host.id, name: host.name, price, currency: "USD", asOf: now, ok: true };
    await env.PRICING_KV.put(key, JSON.stringify(record));
    return record;
  } catch (err) {
    // Keep the last known-good price. Never let a scrape failure blank out
    // or corrupt what visitors see — just note that today's check failed.
    const existingRaw = await env.PRICING_KV.get(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const failRecord = {
      id: host.id,
      name: host.name,
      price: existing ? existing.price : null,
      currency: "USD",
      asOf: existing ? existing.asOf : null,
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
      "Cache-Control": "public, max-age=1800" // data only changes once a day; light edge caching is fine
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
