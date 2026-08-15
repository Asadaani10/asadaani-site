// Fetches the daily pricing snapshot from the Worker and updates any element
// tagged with data-price-id. If the request fails, or a host has no data yet,
// the static price already written in the HTML is left untouched — visitors
// never see a blank or broken price.
(function () {
  function formatPrice(value) {
    return "$" + value.toFixed(2);
  }

  function applyPrice(el, record) {
    if (!record || record.price === null || record.price === undefined) return;
    var valueEl = el.querySelector("[data-price-value]") || el;
    valueEl.textContent = formatPrice(record.price);
    el.setAttribute("data-price-status", record.ok ? "live" : "stale");
    if (record.asOf) {
      var label = "Price checked " + new Date(record.asOf).toLocaleDateString();
      if (!record.ok) label += " — today's automatic check failed, showing last confirmed price";
      el.setAttribute("title", label);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var priceEls = document.querySelectorAll("[data-price-id]");
    if (!priceEls.length) return;

    fetch("/api/pricing")
      .then(function (res) {
        if (!res.ok) throw new Error("pricing API error");
        return res.json();
      })
      .then(function (data) {
        priceEls.forEach(function (el) {
          applyPrice(el, data[el.getAttribute("data-price-id")]);
        });

        var timestamps = Object.keys(data)
          .map(function (k) { return data[k] && data[k].asOf; })
          .filter(Boolean)
          .sort();
        var freshest = timestamps[timestamps.length - 1];

        if (freshest) {
          document.querySelectorAll("[data-price-updated-note]").forEach(function (n) {
            n.textContent = "Pricing auto-checked daily — last checked " + new Date(freshest).toLocaleDateString() + ".";
          });
        }
      })
      .catch(function () {
        // No KV data yet, or the API isn't reachable — the static prices
        // already in the page stay exactly as written. No error shown to visitors.
      });
  });
})();
