(() => {
  // The exact nesting of keySkills in the profile response is not guaranteed, so search for it (depth-limited)
  function findKeySkills(o, depth = 0) {
    if (!o || typeof o !== "object" || depth > 8) return null;
    for (const [k, v] of Object.entries(o)) {
      if (k.toLowerCase() === "keyskills" && (typeof v === "string" || Array.isArray(v))) return v;
    }
    for (const v of Object.values(o)) {
      const r = findKeySkills(v, depth + 1);
      if (r) return r;
    }
    return null;
  }

  // [url pattern, event name, optional reducer that decides what is forwarded (return null to forward nothing)]
  const ROUTES = [
    [/\/jobapi\/v3\/search/, "__job_insights_data__"],
    [/\/jobapi\/v4\/job\//, "__job_insights_detail__"],
    [
      /\/resman-aggregator-services\/v2\/users\/self/,
      "__job_insights_profile__",
      (d) => {
        const k = findKeySkills(d);
        return k ? { keySkills: k } : null;
      },
    ],
  ];
  const route = (url) => ROUTES.find(([re]) => re.test(url));

  // JSON-stringify so the payload crosses the MAIN -> ISOLATED boundary safely.
  function forward(hit, url, data) {
    const out = hit[2] ? hit[2](data) : data;
    if (out) window.dispatchEvent(new CustomEvent(hit[1], { detail: JSON.stringify({ url, data: out }) }));
  }

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const req = args[0];
      const url = typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      const hit = route(url);
      // clone so the page can still read the body itself
      if (hit) res.clone().json().then((d) => forward(hit, url, d)).catch(() => {});
    } catch (_) {}
    return res;
  };

  // --- XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url, ...rest) {
    this.__url = String(url);
    return origOpen.call(this, m, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const hit = route(this.__url);
        if (!hit) return;
        const text =
          this.responseType === "" || this.responseType === "text"
            ? this.responseText
            : JSON.stringify(this.response);
        forward(hit, this.__url, JSON.parse(text));
      } catch (_) {}
    });
    return origSend.apply(this, args);
  };
})();