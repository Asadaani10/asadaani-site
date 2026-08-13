# Asadaani — static site

A lightweight, framework-free HTML/CSS/JS site: no build step, no server, no database.
Built to deploy on **Cloudflare Pages**.

## What's included

```
index.html                    Homepage
articles.html                 Article listing (with filter pills)
article-hosting-guide.html    Sample article
article-cloudflare-pages.html Sample tech-notes article
reviews.html                  Hosting comparison hub + table
review-hostinger.html         Full single-host review (template — copy for Bluehost/Hostgator)
about.html
disclosure.html               Affiliate disclosure (see note below)
contact.html                  Static contact form (needs a backend — see below)
404.html
css/style.css                 All styling, one file
js/main.js                    Mobile nav, article filter, form UX — no dependencies
```

## Deploy to Cloudflare Pages

**Fastest — drag and drop:**
1. Cloudflare dashboard → Workers & Pages → Create application → Pages → Upload assets.
2. Drag this whole folder in and confirm.
3. You'll get a live `*.pages.dev` URL immediately.

**Recommended for ongoing updates — Git:**
1. Push this folder to a GitHub/GitLab repo.
2. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
3. Leave the build command empty, set output directory to `/`.
4. Every push to your main branch redeploys automatically.

**Custom domain:** in your Pages project, open Custom Domains and add `asadaani.com`. If the domain's DNS is already on Cloudflare this is a one-click step.

## Before you publish — checklist

- [ ] Replace all `href="#"` affiliate links with your real tracking links (Bluehost/Hostgator/Hostinger affiliate URLs).
- [ ] Replace sample speed/uptime numbers in the homepage scoreboard and `reviews.html` comparison table with your own measured results.
- [ ] Duplicate `review-hostinger.html` to create `review-bluehost.html` and `review-hostgator.html`, and link them from `reviews.html` and the footer (currently pointing to `reviews.html#bluehost` / `#hostgator` as placeholders).
- [ ] Update `hello@asadaani.com` to your real inbox.
- [ ] Have the disclosure wording on `disclosure.html` checked against current FTC endorsement guidance (or your local regulator) — the included text is a solid starting point, not legal advice.
- [ ] Swap the gradient `.article-thumb` blocks for real images/screenshots once you have them (compress before uploading — Pages doesn't do this for you).
- [ ] Add a `sitemap.xml` and `robots.txt` once the domain is live (a simple sitemap generator or Cloudflare's built-in tools work fine for a site this size).

## The contact and newsletter forms don't send anywhere yet

This is a static site, so `contact.html`'s form and the newsletter form on `index.html`/`reviews.html` only show a UI confirmation — nothing is actually sent. Two easy ways to fix that without adding a server:

1. **Cloudflare Pages Functions** — add a small serverless function under `/functions/api/contact.js` that receives the POST and forwards it (e.g. via email API or to a spreadsheet/DB). Free on Cloudflare's plan.
2. **Third-party form service** (fastest to set up) — services like Formspree or Web3Forms let you point the form's `action` at their endpoint with no backend code at all.

## Editing content

Every page is plain HTML — open in any editor, find the text, change it. There's no CMS or templating, so shared elements (nav, footer) are repeated in each file; update those in each page when they change, or convert to a static site generator later if the page count grows significantly.
