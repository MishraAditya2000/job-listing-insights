const SEARCH_EVENT = "__job_insights_data__";
const DETAIL_EVENT = "__job_insights_detail__";

const PROFILE_EVENT = "__job_insights_profile__";
// ===== CONFIG =====
const MY_EXP_YEARS = 2;

const FALLBACK_SKILLS = { 
};

const MY_SKILLS = { ...FALLBACK_SKILLS }; // replaced in place by the synced profile skills
const EXTRA_SKILLS = [];                  // skills you have but haven't put on your profile
const IGNORE_SKILLS = [];
const NEEDS_JS = new Set(["next"]);       // bare name is a common English word: require the "js" suffix
const CARD_SELECTOR = ".cust-job-tuple";
const DEBUG = false;
// ==================

// ---------- shared helpers ----------
const IST_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const formatIst = (date) => `${IST_FMT.format(date)} IST`;

function agoLabel(date, now = Date.now()) {
  const mins = Math.floor((now - date.getTime()) / 60000);
  if (mins < 0) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

// ---------- search page ----------
const jobs = new Map(); // jobId -> insight

function lpa(sd) {
  if (!sd || sd.hideSalary || !sd.maximumSalary) return "not disclosed";
  const f = (n) => +(n / 100000).toFixed(1);
  return `${f(sd.minimumSalary)}–${f(sd.maximumSalary)} LPA`;
}

function istDate(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatIst(new Date(n));
}

function ageLabel(job) {
  if (job.footerPlaceholderLabel) return job.footerPlaceholderLabel.toLowerCase();
  const days = Math.floor((Date.now() - Number(job.createdDate)) / 86400000);
  return days <= 0 ? "today" : `${days}d ago`;
}

// "2–3 years" style hint in the description, if present
function descExperience(text) {
  const m = /(\d+)\s*[–\-to]+\s*(\d+)\s*\+?\s*years?/i.exec(text);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function toInsight(job) {
  const skills = job.keySkills?.nerSkills || [];
  const haystack = [job.title, skills.join(" "), job.jobDescription].join(" ");
  const matched = Object.entries(MY_SKILLS).filter(([, re]) => re.test(haystack)).map(([k]) => k);

  const min = Number(job.minimumExperience);
  const max = Number(job.maximumExperience);
  const fitsExp = Number.isFinite(min) && Number.isFinite(max)
    ? MY_EXP_YEARS >= min && MY_EXP_YEARS <= max : null;

  const d = descExperience(job.jobDescription || "");
  const descNote = d && (d[0] !== min || d[1] !== max) ? `desc says ${d[0]}–${d[1]} yrs` : "";

  return {
    id: String(job.jobId),
    title: job.title,
    company: job.companyName,
    matched,
    score: matched.length,
    ...extraInsight(job, matched, min, max),
    fitsExp,
    descNote,
    posted: ageLabel(job),
    postedAt: istDate(job.createdDate),
    salary: lpa(job.salaryDetail),
    tags: (job.tagsDataModel?.tagsMetadata || []).map((t) => t.label),
  };
}


// Extra fields for the card: the three counts and the lists behind the (i) tooltip
function extraInsight(job, matched, min, max) {
  const tags = job.keySkills?.nerSkills || [];
  const yours = Object.keys(MY_SKILLS);
  console.log(tags)
  return {
    listed:tags,
    yours: yours.length,                                    // skills you listed
    mentioned:tags.length,       // skills the job lists
    unmatchedYours: yours.filter((k) => !matched.includes(k)),
    jobOnly: tags.filter((t) => !Object.values(MY_SKILLS).some((re) => re.test(t))),
    min,
    max,
  };
}

function expFit(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ["Unknown", "#666"];
  if (MY_EXP_YEARS >= min && MY_EXP_YEARS <= max) return ["Good", "#1b7f3b"];
  const gap = MY_EXP_YEARS < min ? min - MY_EXP_YEARS : MY_EXP_YEARS - max;
  return gap <= 1 ? ["Close", "#b26a00"] : ["Poor", "#b3261e"];
}

function injectStyles() {
  if (document.getElementById("ji-style")) return;
  const s = document.createElement("style");
  s.id = "ji-style";
  s.textContent = `
    .ji-card{margin:8px 0 4px;padding:8px 14px;border:1.5px solid #275df5;border-radius:14px;
      font:12px/1.7 system-ui,sans-serif;background:#fff;color:#111}
    .ji-row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ji-tip{position:relative;display:inline-block;width:16px;height:16px;line-height:14px;margin-left:6px;
      text-align:center;border:1.5px solid #333;border-radius:50%;font-size:11px;cursor:help}
    .ji-pop{display:none;position:absolute;left:100%;top:-6px;z-index:99999;width:340px;padding:8px 10px;
      background:#111;color:#fff;border-radius:8px;text-align:left;font-size:12px;line-height:1.5;
      box-shadow:0 8px 24px rgba(0,0,0,.35)}
    .ji-tip:hover .ji-pop{display:block}
    .ji-ok{color:#7ee787}.ji-no{color:#ffb3a7}`;
  document.head.appendChild(s);
}


// Skill Score text + (i) tooltip. Only used on the job details page.
function skillScoreEl(info) {
  const left = document.createElement("span");
  left.textContent = `Skill Score[Yours|Matched|Mentioned]: ${info.yours} | ${info.matched.length} | ${info.mentioned}`;

  const tip = document.createElement("span");
  tip.className = "ji-tip";
  tip.textContent = "i";
  const pop = document.createElement("div");
  pop.className = "ji-pop";
  [
    ["Matched Skills", info.matched, "ji-ok"],
    ["Not In Job", info.unmatchedYours, "ji-no"],
    ["Not Your Skills", info.jobOnly, "ji-no"],
  ].forEach(([label, list, cls]) => {
    const line = document.createElement("div");
    const b = document.createElement("b");
    b.className = cls;
    b.textContent = `${label} (${list.length}): `;
    line.append(b, list.join(", ") || "none");
    pop.appendChild(line);
  });
  tip.appendChild(pop);
  left.appendChild(tip);
  return left;
}

function badgeFor(info) {
  injectStyles();
  const isDetail = info.views !== undefined; // only the job details page has view / apply counts

  const box = document.createElement("div");
  box.className = "ji-card";
  box.dataset.jiBadge = info.id;

  // row 1: [Skill Score (i)]  Experience Fit      (search cards: Experience Fit only)
  const row1 = document.createElement("div");
  row1.className = "ji-row";
  if (isDetail) row1.appendChild(skillScoreEl(info));
  const [fitLabel, fitColor] = expFit(info.min, info.max);
  const fit = document.createElement("span");
  fit.textContent = `Experience Fit : ${fitLabel}`;
  fit.style.color = fitColor;
  row1.appendChild(fit);

  // row 2: Posted On     [Views | Applies]
  const row2 = document.createElement("div");
  row2.className = "ji-row";
  const posted = document.createElement("span");
  posted.textContent = `Posted On: ${info.postedAt || info.posted}`;
  row2.appendChild(posted);
  if (isDetail) {
    const counts = document.createElement("span");
    counts.textContent = `Views: ${info.views} | Applies: ${info.applies}`;
    row2.appendChild(counts);
  }

  box.append(row1, row2);
  return box;
}

function cardId(card) {
  const href = card.querySelector("a.title")?.getAttribute("href") || "";
  return /(\d{9,})(?:[?#].*)?$/.exec(href)?.[1] || null;
}

function decorate() {
  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    const id = cardId(card);
    const info = id && jobs.get(id);
    if (!info || card.querySelector(`[data-ji-badge="${id}"]`)) return;
    const anchor = card.querySelector(".row5") || card.querySelector(".row4") || card.lastElementChild;
    anchor?.insertAdjacentElement("afterend", badgeFor(info));
  });
}

function findCard(id) {
  return [...document.querySelectorAll(CARD_SELECTOR)].find((c) => cardId(c) === id);
}

// Floating panel helper (shadow DOM keeps Naukri's CSS from affecting ours)
function makePanel(title, position, width) {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;${position};z-index:2147483647;`;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .p{font:12px/1.5 system-ui,sans-serif;background:#111;color:#fff;border-radius:10px;
         padding:10px 12px;width:${width}px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
      .h{display:flex;justify-content:space-between;font-weight:600;margin-bottom:6px}
      button{background:none;border:0;color:#aaa;cursor:pointer}
      .r{padding:4px 0;border-top:1px solid #333}
      .r.click{cursor:pointer}
      .r.click:hover{color:#9fe}
      .row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-top:1px solid #333}
      .k{color:#9aa}
      .v{font-weight:600;text-align:right}
    </style>
    <div class="p"><div class="h"><span></span><button id="x">×</button></div><div id="l"></div></div>`;
  root.querySelector(".h span").textContent = title;
  root.getElementById("x").onclick = () => host.remove();
  document.body.appendChild(host);
  return { host, list: root.getElementById("l") };
}

let searchPanel;
function renderPanel() {
  if (!searchPanel || !document.contains(searchPanel.host)) searchPanel = makePanel("Top matches", "bottom:16px;right:16px", 280);
  const top = [...jobs.values()]
    .sort((a, b) => b.score - a.score || (b.fitsExp === true) - (a.fitsExp === true))
    .slice(0, 5);
  searchPanel.list.innerHTML = "";
  top.forEach((j) => {
    const row = document.createElement("div");
    row.className = "r click";
    row.textContent = `${j.score}/${Object.keys(MY_SKILLS).length} · ${j.title} — ${j.company}`;
    row.onclick = () => findCard(j.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchPanel.list.appendChild(row);
  });
}

// ---------- job details page ----------
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// v4/job gives createdDate as "2026-10-28 09:51:57" with no time zone. Naukri is India-based, so it is
// read as IST wall-clock time. Epoch numbers (ms) are accepted too.
function parseCreated(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || /^\d{10,}$/.test(String(v))) return new Date(Number(v));
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v));
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x || 0));
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 330 * 60000); // IST = UTC+05:30
}

function jobPanelRows(data, now = Date.now()) {
  const j = data?.jobDetails;
  if (!j) return null;
  const created = parseCreated(j.createdDate);
  const ago = created ? agoLabel(created, now) : "";
  const fmt = (n) => (n === null ? "n/a" : n.toLocaleString("en-IN"));
  return [
    ["Posted", created ? `${formatIst(created)}${ago ? ` (${ago})` : ""}` : "n/a"],
    ["Views", fmt(num(j.viewCount))],
    ["Applies", fmt(num(j.applyCount))],
  ];
}

let jobPanel;

// ---------- job details page: render the same card, with Views / Applies ----------
let lastDetail = null; // card data for the job shown on this page

// Same shape the search page builds in toInsight(), but from the v4/job response (full skills list + description)
function detailInsight(j) {
  const skills = [...(j.keySkills?.other || []), ...(j.keySkills?.preferred || [])]
    .map((s) => s?.label)
    .filter(Boolean);
  const descText = String(j.description || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ");
  const haystack = [j.title, skills.join(" "), descText].join(" ");
  const matched = Object.entries(MY_SKILLS).filter(([, re]) => re.test(haystack)).map(([k]) => k);
  const created = parseCreated(j.createdDate);
  const fmt = (n) => (n === null ? "n/a" : n.toLocaleString("en-IN"));
  return {
    id: String(j.jobId),
    title: j.title,
    matched,
    ...extraInsight({ keySkills: { nerSkills: skills } }, matched, num(j.minimumExperience), num(j.maximumExperience)),
    postedAt: created ? formatIst(created) : "",
    posted: "",
    views: fmt(num(j.viewCount)),
    applies: fmt(num(j.applyCount)),
  };
}

function injectJobCard() {
  // data from a previous job (SPA navigation): drop its card and wait for the new response
  if (!lastDetail || !location.pathname.includes(lastDetail.id)) {
    document.querySelectorAll("#job_header ~ [data-ji-badge]").forEach((n) => n.remove());
    return;
  }
  const header = document.querySelector("#job_header");
  if (!header || header.parentElement.querySelector(`[data-ji-badge="${lastDetail.id}"]`)) return;
  header.insertAdjacentElement("afterend", badgeFor(lastDetail));
}

// ---------- profile skills (synced from Naukri's own users/self response) ----------
const STORE_KEY = "ji_profile_skills";
const rawJobs = new Map();   // jobId -> raw search payload, so scores can be recomputed when your skills change
let lastDetailRaw = null;    // raw v4/job payload of the job on screen

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "Node.js" -> node(.js)?   "Nextjs" -> next.js (js required)   "Tailwind CSS" -> tailwind css (flexible separators)
function skillRegex(label) {
  const parts = label.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last === "js") parts.pop();                                    // "Node.js"  -> node
  else if (last.length > 3 && last.endsWith("js")) parts[parts.length - 1] = last.slice(0, -2); // "Nextjs" -> next
  const core = parts.map(esc).join("[\\s.\\-_/]*");
  // "Express", "ExpressJS" and "Express.js" should all match; for words that are also plain English ("next") the js is required
  const js = NEEDS_JS.has(core) ? "[\\s.\\-]?js" : "(?:[\\s.\\-]?js)?";
  return new RegExp(`(?<![a-z0-9+#])${core}${js}(?![a-z0-9+#])`, "i");
}

// keySkills arrives as "A,B,C" (a string); an array of strings/objects is accepted too
function parseSkills(v) {
  const arr = Array.isArray(v)
    ? v.map((x) => (typeof x === "string" ? x : x?.name || x?.label || x?.skill || ""))
    : String(v || "").split(",");
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

function diffSkills(oldList, newList) {
  const norm = (l) => new Map(l.map((s) => [s.trim().toLowerCase(), s.trim()]));
  const a = norm(oldList);
  const b = norm(newList);
  return {
    added: [...b].filter(([k]) => !a.has(k)).map(([, v]) => v),
    removed: [...a].filter(([k]) => !b.has(k)).map(([, v]) => v),
  };
}

// Replace MY_SKILLS in place (it is a const, and the rest of the file reads it at call time)
function applySkills(list) {
  const ignore = new Set(IGNORE_SKILLS.map((s) => s.toLowerCase()));
  const seen = new Set();
  const map = {};
  for (const raw of [...list, ...EXTRA_SKILLS]) {
    const label = String(raw).trim();
    const key = label.toLowerCase();
    if (!label || ignore.has(key) || seen.has(key)) continue;
    const re = skillRegex(label);
    if (!re) continue;
    seen.add(key);
    map[label] = re;
  }
  if (!Object.keys(map).length) return; // never leave yourself with zero skills
  Object.keys(MY_SKILLS).forEach((k) => delete MY_SKILLS[k]);
  Object.assign(MY_SKILLS, map);
  rescoreAll();
}

// Recompute everything already on screen with the new skill list
function rescoreAll() {
  rawJobs.forEach((raw, id) => jobs.set(id, toInsight(raw)));
  if (lastDetailRaw) lastDetail = detailInsight(lastDetailRaw);
  document.querySelectorAll("[data-ji-badge]").forEach((n) => n.remove());
  whenBody(() => {
    decorate();
    if (jobs.size) renderPanel(); // search page only; do not create an empty panel on the job page
    injectJobCard();
  });
}

function toast(text) {
  whenBody(() => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:16px;bottom:16px;z-index:2147483647;max-width:360px;background:#111;color:#fff;" +
      "padding:8px 12px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  });
}

window.addEventListener(PROFILE_EVENT, (e) => {
  try {
    const { data } = JSON.parse(e.detail);
    const skills = parseSkills(data?.keySkills);
    if (!skills.length) return; // an odd response must never wipe the stored skills
    chrome.storage.local.get(STORE_KEY, (r) => {
      const old = r?.[STORE_KEY]?.skills || [];
      const { added, removed } = diffSkills(old, skills);
      if (old.length && !added.length && !removed.length) return; // unchanged: no write, no re-render
      chrome.storage.local.set({ [STORE_KEY]: { skills, updatedAt: Date.now() } });
      if (!old.length) return toast(`Profile skills synced: ${skills.length} skills`);
      const bits = [];
      if (added.length) bits.push(`+${added.length} (${added.join(", ")})`);
      if (removed.length) bits.push(`−${removed.length} (${removed.join(", ")})`);
      toast(`Profile skills updated: ${bits.join(" ")}`);
    });
  } catch (err) {
    console.warn("[Job Insights] profile parse failed", err);
  }
});

// Load stored skills on startup, and follow changes made from any tab
if (typeof chrome !== "undefined" && chrome.storage?.local) {
  chrome.storage.local.get(STORE_KEY, (r) => {
    const s = r?.[STORE_KEY]?.skills;
    if (s?.length) applySkills(s);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    const s = area === "local" && changes[STORE_KEY]?.newValue?.skills;
    if (s?.length) applySkills(s);
  });
}


// ---------- wiring ----------
const whenBody = (fn) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn, { once: true }));

window.addEventListener(SEARCH_EVENT, (e) => {
  try {
    const { data } = JSON.parse(e.detail);
    const list = data?.jobDetails || [];
    if (DEBUG) console.log("[Job Insights] jobs received:", list.length, list[0]);
    list.forEach((j) => { if (!j?.jobId) return; rawJobs.set(String(j.jobId), j); jobs.set(String(j.jobId), toInsight(j)); });
    whenBody(() => { decorate(); renderPanel(); });
  } catch (err) {
    console.warn("[Job Insights] parse failed", err);
  }
});

window.addEventListener(DETAIL_EVENT, (e) => {
  try {
    const { data } = JSON.parse(e.detail);
    const j = data?.jobDetails;
    if (!j) return;
    lastDetailRaw = j;
    lastDetail = detailInsight(j);
    whenBody(injectJobCard);
  } catch (err) {
    console.warn("[Job Insights] detail parse failed", err);
  }
});

// Naukri is a SPA: cards render after the API call and on pagination, so re-decorate on DOM changes.
let decoratePending = false;
document.addEventListener("DOMContentLoaded", () => {
  new MutationObserver(() => {
    if (decoratePending) return;
    decoratePending = true;
    requestAnimationFrame(() => { decoratePending = false; decorate();injectJobCard(); });
  }).observe(document.body, { childList: true, subtree: true });
});
