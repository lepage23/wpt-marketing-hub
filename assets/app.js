/* WPT Marketing Hub
   Plain JavaScript, no build step. Data is saved in this browser (localStorage) until
   shared storage is added. Each page is a render function registered in PAGES. */
(function () {
  "use strict";

  var VERSION = "0.10.0";
  var BUILT = "2026-10-15 17:23 BST";
  var PREFIX = "wpt-hub:";

  /* ---------- small helpers ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* storage blocked */ }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function pct(a, b) { a = Number(a); b = Number(b); return b > 0 ? (a / b * 100) : null; }
  function fmtPct(v) { return v == null || isNaN(v) ? "–" : v.toFixed(1) + "%"; }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(done || "Copied"); }, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(done || "Copied"); } catch (e) { toast("Copy failed. Select the text and copy it yourself."); }
    ta.remove();
  }

  /* ---------- CSV ---------- */
  function toCsv(columns, rows) {
    var head = columns.map(function (c) { return c.label; });
    var lines = [head].concat(rows.map(function (r) {
      return columns.map(function (c) { return c.compute ? c.compute(r) : (r[c.k] == null ? "" : r[c.k]); });
    }));
    return lines.map(function (l) {
      return l.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    }).join("\n");
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ""; }); });
  }
  function download(name, text) {
    try {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast("Download blocked here. Use Copy as CSV instead."); }
  }

  /* ---------- editable table ----------
     cfg: { key, columns:[{k,label,type,options,num,compute,width}], seed:[rows], actions:[{label,run(row)}], addLabel, csvName } */
  function editableTable(cfg) {
    var rows = load(cfg.key, null);
    if (!rows) { rows = (cfg.seed || []).map(function (r) { r._id = uid(); return r; }); save(cfg.key, rows); }
    var wrap = el('<div class="panel-body" style="display:flex;flex-direction:column;gap:10px"></div>');
    var tools = el('<div class="row"></div>');
    var tableBox = el('<div class="table-wrap"></div>');
    wrap.appendChild(tableBox); wrap.appendChild(tools);

    function persist() { save(cfg.key, rows); if (cfg.onChange) cfg.onChange(rows); }
    function cellInput(c, r) {
      var v = r[c.k] == null ? "" : r[c.k];
      var id = cfg.key + "-" + r._id + "-" + c.k;
      if (c.compute) return '<span>' + esc(c.compute(r)) + '</span>';
      if (c.type === "select") {
        return '<select id="' + id + '" data-k="' + c.k + '">' + c.options.map(function (o) {
          return '<option' + (o === v ? " selected" : "") + ">" + esc(o) + "</option>";
        }).join("") + "</select>";
      }
      if (!c.type || c.type === "text") {
        return '<textarea id="' + id + '" data-k="' + c.k + '" rows="1" class="cell' + (c.wide ? " wide" : "") + '" aria-label="' + esc(c.label) + '">' + esc(v) + "</textarea>";
      }
      var t = c.type === "number" ? "number" : c.type === "date" ? "date" : "text";
      return '<input id="' + id + '" data-k="' + c.k + '" type="' + t + '" value="' + esc(v) + '"' + (c.num ? ' style="text-align:right"' : "") + ' aria-label="' + esc(c.label) + '">';
    }
    function render() {
      if (!rows.length) {
        tableBox.innerHTML = '<div class="empty">' + esc(cfg.emptyText || "Nothing here yet.") + "</div>";
      } else {
        var h = "<table><thead><tr>" + cfg.columns.map(function (c) {
          return '<th class="' + (c.num || c.compute ? "num" : "") + '">' + esc(c.label) + "</th>";
        }).join("") + "<th></th></tr></thead><tbody>";
        rows.forEach(function (r) {
          h += '<tr data-id="' + r._id + '">' + cfg.columns.map(function (c) {
            return '<td class="' + (c.num || c.compute ? "num" : "") + '">' + cellInput(c, r) + "</td>";
          }).join("") + '<td class="row-actions">' +
            (r._ex ? '<span class="chip ex" title="Example row. Replace or delete it.">example</span> ' : "") +
            (cfg.actions || []).map(function (a, i) { return '<button type="button" class="btn small" data-act="' + i + '">' + esc(a.label) + "</button> "; }).join("") +
            '<button type="button" class="btn small danger" data-del="1" aria-label="Delete row">Delete</button></td></tr>';
        });
        tableBox.innerHTML = h + "</tbody></table>";
        requestAnimationFrame(function () { Array.prototype.forEach.call(tableBox.querySelectorAll("textarea.cell"), fitCell); });
      }
      var hasEx = rows.some(function (r) { return r._ex; });
      tools.innerHTML = '<button type="button" class="btn primary">' + esc(cfg.addLabel || "Add row") + "</button>" +
        '<button type="button" class="btn" data-copy="1">Copy as CSV</button>' +
        '<button type="button" class="btn" data-dl="1">Download CSV</button>' +
        (hasEx ? '<button type="button" class="btn" data-clear="1">Remove example rows</button>' : "");
    }
    tableBox.addEventListener("input", function (e) { if (e.target.classList.contains("cell")) fitCell(e.target); });
    tableBox.addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-k"); if (!k) return;
      var id = e.target.closest("tr").getAttribute("data-id");
      var r = rows.find(function (x) { return x._id === id; });
      r[k] = e.target.value; delete r._ex; persist(); render();
    });
    tableBox.addEventListener("click", function (e) {
      var tr = e.target.closest("tr"); if (!tr) return;
      var id = tr.getAttribute("data-id");
      if (e.target.hasAttribute("data-del")) { rows = rows.filter(function (x) { return x._id !== id; }); persist(); render(); toast("Row deleted"); }
      var a = e.target.getAttribute("data-act");
      if (a != null) cfg.actions[a].run(rows.find(function (x) { return x._id === id; }));
    });
    tools.addEventListener("click", function (e) {
      if (e.target.classList.contains("primary")) {
        var r = { _id: uid() }; cfg.columns.forEach(function (c) { if (!c.compute) r[c.k] = c.type === "select" ? c.options[0] : c.type === "date" ? today() : ""; });
        if (cfg.newRow) cfg.newRow(r);
        rows.unshift(r); persist(); render();
      }
      if (e.target.hasAttribute("data-copy")) copyText(toCsv(cfg.columns, rows), "CSV copied");
      if (e.target.hasAttribute("data-dl")) download((cfg.csvName || cfg.key) + "-" + today() + ".csv", toCsv(cfg.columns, rows));
      if (e.target.hasAttribute("data-clear")) { rows = rows.filter(function (r) { return !r._ex; }); persist(); render(); toast("Example rows removed"); }
    });
    render();
    return { node: wrap, get: function () { return rows; }, set: function (r) { rows = r; persist(); render(); }, add: function (r) { r._id = uid(); rows.unshift(r); persist(); render(); } };
  }
  function fitCell(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
  function getRows(key) { return load(key, []) || []; }

  /* ---------- shared column sets ---------- */
  var LEAD_STATUS = ["New", "Contacted", "Qualified", "Proposal sent", "Won", "Lost"];
  var LEAD_COLS = [
    { k: "date", label: "Date in", type: "date" },
    { k: "company", label: "Company" },
    { k: "contact", label: "Contact" },
    { k: "source", label: "Source", type: "select", options: ["Website form", "Live chat", "Email campaign", "Phone", "Tender", "Referral", "Partner", "Other"] },
    { k: "interest", label: "Interested in" },
    { k: "status", label: "Status", type: "select", options: LEAD_STATUS },
    { k: "owner", label: "Owner", type: "select", options: ["Garry", "Connor"] },
    { k: "next", label: "Next step", wide: true },
    { k: "nextDate", label: "Next step by", type: "date" },
    { k: "notes", label: "Notes", wide: true }
  ];
  var LEAD_SEED = [
    { _ex: true, date: daysAgo(2), company: "Example: Harbour Dental Group", contact: "Practice manager", source: "Website form", interest: "Hosted phones, 4 sites", status: "New", owner: "Garry", next: "Call to book discovery", nextDate: today(), notes: "Came in on the 8x8 page" },
    { _ex: true, date: daysAgo(6), company: "Example: Downs Lettings", contact: "Operations lead", source: "Email campaign", interest: "Teams calling", status: "Contacted", owner: "Garry", next: "Send Teams Phone pricing", nextDate: daysAgo(-2), notes: "Clicked the Teams Phone email" }
  ];

  /* ---------- pages ---------- */
  var PAGES = [
    { id: "today", label: "Today", render: renderToday },
    { id: "seo", label: "Website & SEO", pri: "Priority", render: renderSeo },
    { id: "fixes", label: "Fix queue", render: renderFixes },
    { id: "jobs", label: "Your jobs", render: renderJobs },
    { id: "leads", label: "Leads", render: renderLeads },
    { id: "email", label: "Email campaigns", render: renderEmail },
    { id: "chat", label: "Live chat", render: renderChat },
    { id: "brief", label: "Weekly brief", render: renderBrief },
    { id: "inbox", label: "Inbox triage", render: renderInbox }
  ];

  function head(eyebrow, title, sub, right) {
    return '<div class="page-head"><div><div class="eyebrow">' + esc(eyebrow) + "</div><h1>" + esc(title) + "</h1>" +
      (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (right || "") + "</div>";
  }
  function panel(title, sub, right) {
    return el('<section class="panel"><div class="panel-head"><div><h2>' + esc(title) + "</h2>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (right || "") + "</div></section>");
  }
  function openLeads() { return getRows("leads").filter(function (l) { return l.status !== "Won" && l.status !== "Lost"; }); }

  /* Today */
  function renderToday(main) {
    var leads = openLeads();
    var due = leads.filter(function (l) { return l.nextDate && l.nextDate <= today(); });
    var audit = load("seo-audit", null);
    var issues = audit ? audit.pages.reduce(function (n, p) { return n + p.issues.length; }, 0) : null;
    var inbox = getRows("inbox").filter(function (m) { return m.state !== "Dealt with"; });
    var plan = getRows("content-plan").filter(function (c) { return c.status !== "Live"; });
    var d = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    main.innerHTML = head(d, "Good morning, Connor", "Leads first, then the website. Everything below is pulled from the other pages.");
    main.appendChild(el('<div class="stats">' +
      stat(leads.length, "Open leads", false) +
      stat(due.length, "Lead actions due today or late", due.length > 0) +
      stat(issues == null ? "–" : issues, issues == null ? "SEO issues (no audit run yet)" : "SEO issues from last audit", issues > 0) +
      (ga4Data() && ga4Data().configured ? stat(fmtNum(ga4Data().totals.keyEvents), "Website leads, last " + ga4Data().days + " days", !+ga4Data().totals.keyEvents) + stat(fmtNum(ga4Data().totals.sessions), "Website visits, last " + ga4Data().days + " days") : "") +
      (perfData() && perfData().totals ? stat(fmtNum(perfData().totals.clicks), "Clicks from Google, last " + perfData().days + " days") : "") +
      (function () { var d = psiData(); if (!d || !d.pages) return ""; var ok = Object.keys(d.pages).map(function (k) { return d.pages[k]; }).filter(function (r) { return !r.error && r.perf != null; }); if (!ok.length) return ""; var a = Math.round(ok.reduce(function (s, r) { return s + r.perf; }, 0) / ok.length); return stat(a + "/100", "Average mobile speed score", a < 50); })() +
      stat(pendingFixes().length, "Website fixes waiting for approval", pendingFixes().length > 0) +
      stat(jobsToDo(), "Your jobs to do", false) +
      stat(inbox.length, "Inbox items flagged", inbox.length > 0) +
      stat(plan.length, "Content pieces in progress", false) + "</div>"));

    var grid = el('<div class="grid-2"></div>');
    var p1 = panel("Needs you today", "Lead actions due, then flagged emails.");
    var items = due.map(function (l) {
      return { chip: '<span class="chip flag">Lead</span>', t: l.company || "Unnamed lead", s: (l.next || "No next step set") + " · " + (l.owner || "") + (l.nextDate < today() ? " · late" : "") };
    }).concat(inbox.slice(0, 5).map(function (m) {
      return { chip: '<span class="chip ' + (m.category === "Lead" ? "flag" : m.category === "Complaint" ? "bad" : "info") + '">' + esc(m.category) + "</span>", t: m.subject, s: m.from + " · " + (m.why || "") };
    }));
    p1.appendChild(el(items.length ? '<div class="list">' + items.map(function (i) {
      return '<div class="list-item">' + i.chip + '<div><div class="t">' + esc(i.t) + '</div><div class="s">' + esc(i.s) + "</div></div><span></span></div>";
    }).join("") + "</div>" : '<div class="empty">Nothing due. Good time for SEO work.</div>'));
    var p2 = panel("Website", audit ? "Last audit " + audit.when : "No audit run yet.");
    p2.appendChild(el('<div class="row"><a class="btn primary" href="#seo">' + (audit ? "Open website & SEO" : "Run the first page audit") + "</a></div>"));
    if (audit) {
      var worst = audit.pages.slice().sort(function (a, b) { return b.issues.length - a.issues.length; }).slice(0, 4);
      p2.appendChild(el('<div class="list">' + worst.map(function (p) {
        return '<div class="list-item"><span class="chip ' + (p.issues.length ? "flag" : "good") + '">' + p.issues.length + '</span><div><div class="t">' + esc(p.title) + '</div><div class="s">' + esc(p.issues.slice(0, 2).join(", ") || "No issues") + "</div></div><span></span></div>";
      }).join("") + "</div>"));
    }
    grid.appendChild(p1); grid.appendChild(p2); main.appendChild(grid);
  }
  function stat(n, label, flag) {
    return '<div class="stat' + (flag ? " flag" : "") + '"><span class="n">' + esc(n) + '</span><span class="l">' + esc(label) + "</span></div>";
  }

  /* Website & SEO */
  function stripHtml(h) { var d = document.createElement("div"); d.innerHTML = h || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
  function auditItem(item, type, site) {
    var html = (item.content && item.content.rendered) || "";
    var text = stripHtml(html);
    var words = text ? text.split(" ").length : 0;
    var y = item.yoast_head_json || null;
    var metaTitle = y && y.title ? y.title : "";
    var metaDesc = y && (y.description || (y.og_description)) ? (y.description || y.og_description) : "";
    /* Rank Math and SEOPress fields only come back when the hub is connected and the snippet is in. */
    var m = item.meta || {}, seoFields = null;
    if ("rank_math_description" in m) seoFields = { t: m.rank_math_title, d: m.rank_math_description, name: "Rank Math" };
    else if ("_seopress_titles_desc" in m) seoFields = { t: m._seopress_titles_title, d: m._seopress_titles_desc, name: "SEOPress" };
    if (!y && seoFields) { metaTitle = seoFields.t || ""; metaDesc = seoFields.d || ""; }
    var hasSeo = !!y || !!seoFields;
    metaTitle = stripHtml(metaTitle); metaDesc = stripHtml(metaDesc); /* decode &amp; etc. so lengths are right */
    var doc = new DOMParser().parseFromString(html, "text/html");
    var h2 = doc.querySelectorAll("h2").length;
    var imgs = doc.querySelectorAll("img");
    var noAlt = Array.prototype.filter.call(imgs, function (i) { return !(i.getAttribute("alt") || "").trim(); }).length;
    var host = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    var internal = Array.prototype.filter.call(doc.querySelectorAll("a[href]"), function (a) {
      var h = a.getAttribute("href"); return h.indexOf(host) > -1 || h.charAt(0) === "/";
    }).length;
    var modified = (item.modified || "").slice(0, 10);
    var issues = [];
    if (words < 300) issues.push("Thin content (" + words + " words)");
    if (hasSeo && !metaDesc) issues.push(y ? "No meta description" : "No custom meta description");
    if (metaDesc && metaDesc.length > 160) issues.push("Meta description too long");
    if (metaDesc && metaDesc.length < 70) issues.push("Meta description short");
    if (metaTitle && metaTitle.length > 60) issues.push("Title tag over 60 characters");
    if (h2 === 0 && words > 150) issues.push("No H2 subheadings");
    if (noAlt) issues.push(noAlt + " image" + (noAlt > 1 ? "s" : "") + " missing alt text");
    if (internal < 2 && words > 150) issues.push("Few internal links");
    if (modified && modified < daysAgo(365)) issues.push("Not updated in over a year");
    return {
      id: item.id, type: type, title: stripHtml(item.title && item.title.rendered) || "(no title)", link: item.link, modified: modified,
      words: words, metaTitle: metaTitle, metaDesc: metaDesc, h2: h2, noAlt: noAlt, internal: internal, issues: issues, hasSeo: hasSeo, seoName: y ? "Yoast SEO" : seoFields ? seoFields.name : ""
    };
  }
  function apiUrl(site, type, page) {
    return site.replace(/\/$/, "") + "/wp-json/wp/v2/" + type + "?per_page=100&page=" + page + "&_fields=id,link,title,modified,content,yoast_head_json";
  }
  function fetchAll(site, type) {
    var all = [], a = wpAuth();
    var authed = a && a.pass && a.ok && a.site.replace(/\/$/, "") === site.replace(/\/$/, "");
    function get(page) {
      if (!authed) return fetch(apiUrl(site, type, page));
      var token; try { token = btoa(a.user + ":" + a.pass); } catch (e) { return fetch(apiUrl(site, type, page)); }
      return fetch(apiUrl(site, type, page).replace("_fields=", "context=edit&_fields=meta,"), { headers: { "Authorization": "Basic " + token } });
    }
    function next(page) {
      return get(page).then(function (r) {
        if (r.status === 400 && page > 1) return all;
        if (!r.ok) throw new Error("The site answered " + r.status + " for " + type + ".");
        return r.json().then(function (j) {
          all = all.concat(j);
          return j.length === 100 && page < 10 ? next(page + 1) : all;
        });
      });
    }
    return next(1);
  }

  function renderSeo(main) {
    var cfg = load("seo-settings", { site: "https://westpiertech.com", types: "pages,posts" });
    main.innerHTML = head("Priority area", "Website & SEO", "Audit westpiertech.com through the WordPress API, track rankings and AI search visibility, and plan content.",
      '<a class="btn primary" href="#fixes">Fix queue (' + pendingFixes().length + " waiting)</a>");
    renderWpConnect(main);
    renderPerformance(main);
    renderGa4(main);
    renderMobile(main);
    renderFind(main);

    /* Audit panel */
    var p = panel("Page audit", "Reads every page and post live from WordPress. Read-only: nothing on the site is changed.");
    var form = el('<div class="form-grid">' +
      '<label class="field" for="seo-site">Site address<input id="seo-site" value="' + esc(cfg.site) + '"></label>' +
      '<label class="field" for="seo-types">Content to audit<select id="seo-types">' +
      ["pages,posts", "pages", "posts"].map(function (o) { return "<option" + (o === cfg.types ? " selected" : "") + ' value="' + o + '">' + (o === "pages,posts" ? "Pages and posts" : o === "pages" ? "Pages only" : "Posts only") + "</option>"; }).join("") +
      "</select></label></div>");
    var actions = el('<div class="row"><button type="button" class="btn primary" id="seo-run">Run audit now</button>' +
      '<label class="row muted" style="font-size:.85rem"><input type="checkbox" id="seo-only"> Only show pages with issues</label>' +
      '<button type="button" class="btn" id="seo-copy">Copy as CSV</button></div>');
    var status = el('<div></div>');
    var results = el("<div></div>");
    var paste = el('<details><summary class="muted" style="cursor:pointer;font-size:.88rem">Audit won\'t run? Paste the data in by hand</summary>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><p class="muted" style="font-size:.86rem">Open this address in a new browser tab, select everything, copy it and paste it below.</p>' +
      '<div class="mono" id="seo-api-url" style="word-break:break-all"></div>' +
      '<label class="field" for="seo-paste">Pasted data<textarea id="seo-paste" placeholder="[{&quot;id&quot;: ...}]"></textarea></label>' +
      '<div class="row"><button type="button" class="btn" id="seo-paste-run">Audit pasted data</button></div></div></details>');
    p.appendChild(form); p.appendChild(actions); p.appendChild(status); p.appendChild(results); p.appendChild(paste);
    main.appendChild(p);

    function showUrl() { paste.querySelector("#seo-api-url").textContent = apiUrl(form.querySelector("#seo-site").value, "pages", 1); }
    showUrl(); form.addEventListener("input", showUrl);

    function storeAudit(pages, site, siteData, statusMap) {
      var audit = { when: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }), site: site, pages: pages, siteData: siteData || null, status: statusMap || null };
      save("seo-audit", audit); drawAudit(audit); updateNav();
      return audit;
    }
    function drawAudit(audit) {
      if (!audit) { results.innerHTML = '<div class="empty">No audit yet. Press Run audit now.</div>'; return; }
      var only = actions.querySelector("#seo-only").checked;
      var list = audit.pages.slice().sort(function (a, b) { return (a.redirectTo ? 1 : 0) - (b.redirectTo ? 1 : 0) || b.issues.length - a.issues.length; });
      if (only) list = list.filter(function (x) { return x.issues.length; });
      var total = audit.pages.reduce(function (n, x) { return n + x.issues.length; }, 0);
      var real = audit.pages.filter(function (x) { return !x.redirectTo; });
      var redirected = audit.pages.length - real.length;
      var thin = real.filter(function (x) { return x.words < 300; }).length;
      var noDesc = real.filter(function (x) { return x.hasSeo && !x.metaDesc; }).length;
      var stale = audit.pages.filter(function (x) { return x.modified && x.modified < daysAgo(365); }).length;
      var seoSeen = audit.pages.some(function (x) { return x.hasSeo; });
      var liveSeen = audit.pages.some(function (x) { return x.live || x.redirectTo; });
      results.innerHTML = '<div class="stats" style="margin-bottom:12px">' + stat(audit.pages.length, "Pages and posts checked") + stat(total, "Issues found", total > 0) +
        stat(thin, "Thin pages (under 300 words)", thin > 0) + stat(noDesc, "Missing meta descriptions", noDesc > 0) + stat(stale, "Not updated in a year", stale > 0) + (redirected ? stat(redirected, "Redirect elsewhere (skipped)") : "") + "</div>" +
        (seoSeen ? "" : '<div class="notice" style="margin-bottom:12px">SEO titles and meta descriptions couldn\'t be checked, so "Missing meta descriptions" reads 0 until they can. For Rank Math, connect WordPress above, add the snippet from docs/wordpress-snippet.php, then run the audit again.</div>') +
        siteSummary(audit) +
        '<p class="muted mono" style="margin-bottom:8px">Last run ' + esc(audit.when) + " · " + esc(audit.site) + (liveSeen ? " · checked against the live site" : " · WordPress data only, redirects not checked") + "</p>" +
        '<div class="table-wrap"><table><thead><tr><th>Page</th><th>Type</th><th class="num">Words</th><th class="num">Title len</th><th class="num">Desc len</th><th class="num">H2s</th><th class="num">Int. links</th><th>Updated</th><th>Issues</th></tr></thead><tbody>' +
        list.map(function (x) {
          if (x.redirectTo) return '<tr class="dim"><td><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a></td><td>" + esc(x.type) + '</td><td colspan="6" class="muted">Skipped</td><td><span class="chip info">Redirects to ' + esc(shortPath(x.redirectTo)) + "</span></td></tr>";
          return "<tr><td><a href=\"" + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a></td><td>' + esc(x.type) + '</td><td class="num">' + x.words +
            '</td><td class="num">' + (x.metaTitle ? x.metaTitle.length : "–") + '</td><td class="num">' + (x.metaDesc ? x.metaDesc.length : "–") + '</td><td class="num">' + x.h2 +
            '</td><td class="num">' + x.internal + '</td><td class="mono">' + esc(x.modified) + "</td><td>" +
            (x.issues.length ? x.issues.map(function (i) { return '<span class="chip flag">' + esc(i) + "</span>"; }).join(" ") : '<span class="chip good">Clear</span>') + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    function siteSummary(audit) {
      var d = audit.siteData; if (!d) return "";
      function line(ok, label, note) { return '<div class="list-item"><span class="chip ' + (ok ? "good" : "flag") + '">' + (ok ? "OK" : "Fix") + '</span><div><div class="t">' + esc(label) + '</div><div class="s">' + esc(note) + "</div></div><span></span></div>"; }
      var rb = d.robots && d.robots.status === 200;
      var aiBlocked = rb ? AI_BOTS.filter(function (b) { return robotsBlocks(d.robots.body, b); }) : [];
      var maps = (d.sitemaps || []).filter(function (m) { return m.status === 200; }).length;
      var homeRow = audit.pages.filter(function (p) { return norm(p.link) === norm(d.home); })[0] || {};
      return '<div class="panel" style="margin-bottom:12px;background:var(--bg)"><h3>Site checks</h3><div class="list">' +
        line(d.blog_public !== 0, "Search engines allowed", d.blog_public !== 0 ? "WordPress isn't blocking search engines." : "WordPress is set to discourage search engines.") +
        line(rb, "robots.txt", rb ? "Found." : "Missing or not loading.") +
        line(rb && !aiBlocked.length, "AI search crawlers", aiBlocked.length ? "Blocked: " + aiBlocked.join(", ") : "ChatGPT, Claude, Perplexity, Gemini and Copilot crawlers can read the site.") +
        line(maps > 0, "XML sitemap", maps ? (d.sitemap_urls || []).length + " addresses across " + maps + " sitemap files." : "No working sitemap found.") +
        line(!!homeRow.googleVerify, "Google Search Console tag", homeRow.googleVerify ? "Found on the home page." : "Not found on the home page (fine if verified through DNS).") +
        line(!!homeRow.bingVerify, "Bing Webmaster Tools tag", homeRow.bingVerify ? "Found on the home page." : "Not found on the home page.") +
        line(d.llms === 200, "llms.txt for AI tools", d.llms === 200 ? "Found." : "Not set up yet.") +
        line(true, "Redirect rules", (d.redirections || []).length + " rules in Rank Math.") +
        "</div></div>";
    }
    drawAudit(load("seo-audit", null));

    actions.querySelector("#seo-only").addEventListener("change", function () { drawAudit(load("seo-audit", null)); });
    actions.querySelector("#seo-copy").addEventListener("click", function () {
      var a = load("seo-audit", null); if (!a) return toast("Run an audit first");
      var cols = [{ k: "title", label: "Page" }, { k: "link", label: "URL" }, { k: "type", label: "Type" }, { k: "words", label: "Words" }, { k: "metaTitle", label: "Title tag" }, { k: "metaDesc", label: "Meta description" }, { k: "modified", label: "Updated" }, { label: "Custom description set", compute: function (r) { return r.customDesc ? "yes" : "no"; } }, { label: "Redirects to", compute: function (r) { return r.redirectTo || ""; } }, { label: "Checked live", compute: function (r) { return r.live ? "yes" : r.redirectTo ? "redirect" : "no"; } }, { label: "H1", compute: function (r) { return (r.h1 || []).join(" / "); } }, { label: "Schema", compute: function (r) { return (r.schema || []).join(" "); } }, { label: "Canonical", compute: function (r) { return r.canonical || ""; } }, { label: "Noindex", compute: function (r) { return r.noindex ? "yes" : ""; } }, { label: "Content links", compute: function (r) { return (r.linksContent || []).length; } }, { label: "Images missing alt", compute: function (r) { return r.imagesNoAlt || 0; } }, { label: "Server ms", compute: function (r) { return r.ms || ""; } }, { label: "Google clicks", compute: function (r) { var x = perfByPage()[norm(r.link)]; return x ? x.clicks : ""; } }, { label: "Google impressions", compute: function (r) { var x = perfByPage()[norm(r.link)]; return x ? x.impressions : ""; } }, { label: "Google position", compute: function (r) { var x = perfByPage()[norm(r.link)]; return x ? x.position.toFixed(1) : ""; } }, { label: "Issues", compute: function (r) { return r.issues.join("; "); } }];
      copyText(toCsv(cols, a.pages), "Audit copied as CSV");
    });
    actions.querySelector("#seo-run").addEventListener("click", function () {
      var site = form.querySelector("#seo-site").value.trim();
      var types = form.querySelector("#seo-types").value.split(",");
      save("seo-settings", { site: site, types: types.join(",") });
      status.innerHTML = '<div class="notice info">Reading ' + esc(types.join(" and ")) + " from " + esc(site) + "…</div>";
      Promise.all(types.map(function (t) { return fetchAll(site, t).then(function (items) { return items.map(function (i) { return auditItem(i, t === "pages" ? "Page" : "Post", site); }); }); }))
        .then(function (sets) {
          var pages = [].concat.apply([], sets);
          if (!hasChecker()) {
            pages.forEach(function (p) { p.customDesc = !!p.metaDesc; });
            storeAudit(pages, site);
            status.innerHTML = '<div class="notice info">Audit finished. ' + pages.length + " items checked. Add the page checker snippet to also catch redirects.</div>";
            return;
          }
          function prog(d, n) { status.innerHTML = '<div class="notice info">Checking live pages: ' + d + " of " + n + "…</div>"; }
          return checkUrls(pages.map(function (p) { return p.link; }), prog).then(function (live) {
            var targets = applyLive(pages, live);
            return (targets.length ? checkUrls(targets, prog) : Promise.resolve({})).then(function (live2) {
              targets.forEach(function (u) { pages.push(liveOnlyRow(u, live2[norm(u)])); });
              status.innerHTML = '<div class="notice info">Checking the site: robots.txt, sitemap, redirects and links…</div>';
              return siteAudit(pages, prog).then(function (res) {
                var known = {}; pages.forEach(function (p) { known[norm(p.link)] = true; });
                var inMap = {}; (res.site.sitemap_urls || []).forEach(function (u) { inMap[norm(u)] = true; });
                Object.keys(res.extraRows).forEach(function (k) {
                  var r = res.extraRows[k];
                  if (known[k] || !r || r.status !== 200 || !(r.title || (r.h1 || []).length)) return;
                  if (!inMap[k] && /\/(tag|category|author|page)\//.test(r.url)) return;
                  pages.push(liveOnlyRow(r.url, r)); known[k] = true;
                });
                var audit = storeAudit(pages, site, res.site, res.status);
                var autos = buildAutoFixes(audit);
                storeAutoFixes(autos, Date.now());
                fetchPerf(load("perf-days", 28)).catch(function () { /* search data is optional */ });
                fetchGa4(load("perf-days", 28)).catch(function () { /* GA4 is optional */ });
                runClaimsCheck().catch(function () { /* needs page checker v4 */ });
                drawAudit(audit); updateNav();
                var red = pages.filter(function (p) { return p.redirectTo; }).length;
                status.innerHTML = '<div class="notice info">Audit finished. ' + pages.length + " addresses checked against the live site (" + red + " redirect elsewhere). " + autos.length + ' technical fixes are in the <a href="#fixes">Fix queue</a>.</div>';
              }, function (err) {
                storeAudit(pages, site);
                status.innerHTML = '<div class="notice"><b>Pages checked, but the site-wide check didn\'t run.</b> ' + esc(err.message) + ' If it says "No route was found", update the page checker snippet with the new version in docs/wordpress-page-checker.php.</div>';
              });
            });
          });
        })
        .catch(function (err) {
          status.innerHTML = '<div class="notice"><b>The audit couldn\'t reach the site.</b> ' + esc(err.message || "") +
            " Usually this means a security plugin is blocking the WordPress API, or the site doesn't allow requests from this page. Matt can check the security plugin settings. Until then, use the paste option below.</div>";
          paste.open = true;
        });
    });
    paste.querySelector("#seo-paste-run").addEventListener("click", function () {
      var site = form.querySelector("#seo-site").value.trim();
      try {
        var data = JSON.parse(paste.querySelector("#seo-paste").value);
        if (!Array.isArray(data)) throw new Error();
        var pages = data.map(function (i) { return auditItem(i, i.link && /\/\d{4}\/|\/blog\//.test(i.link) ? "Post" : "Page", site); });
        storeAudit(pages, site); status.innerHTML = '<div class="notice info">Audit finished from pasted data. ' + pages.length + " items checked.</div>";
      } catch (e) { status.innerHTML = '<div class="notice">That doesn\'t look like the WordPress data. Copy the whole page from the address above, starting with [ and ending with ].</div>'; }
    });

    var grid = el('<div class="grid"></div>');

    var rank = panel("Keyword rankings", "Searches we want to win and where we sit in Google. Update weekly.");
    rank.appendChild(editableTable({
      key: "keywords", csvName: "keyword-rankings", addLabel: "Add keyword",
      columns: [
        { k: "keyword", label: "Search term" }, { k: "page", label: "Target page" },
        { k: "pos", label: "Position", type: "number", num: true }, { k: "prev", label: "Last week", type: "number", num: true },
        { label: "Change", compute: function (r) { if (!r.pos || !r.prev) return "–"; var d = Number(r.prev) - Number(r.pos); return d > 0 ? "▲ " + d : d < 0 ? "▼ " + (-d) : "no change"; } },
        { k: "checked", label: "Checked", type: "date" }
      ],
      seed: [
        { _ex: true, keyword: "8x8 partner UK", page: "/8x8/", pos: "", prev: "", checked: today() },
        { _ex: true, keyword: "business VoIP Brighton", page: "/", pos: "", prev: "", checked: today() },
        { _ex: true, keyword: "Microsoft Teams calling provider", page: "/teams-phone/", pos: "", prev: "", checked: today() }
      ]
    }).node);

    var ai = panel("AI search visibility", "Questions buyers ask ChatGPT, Google AI Overviews and others. Does WPT get named?");
    ai.appendChild(editableTable({
      key: "ai-visibility", csvName: "ai-visibility", addLabel: "Add question",
      columns: [
        { k: "q", label: "Question asked" },
        { k: "engine", label: "Where", type: "select", options: ["ChatGPT", "Google AI Overview", "Gemini", "Perplexity", "Copilot", "Claude"] },
        { k: "named", label: "WPT named?", type: "select", options: ["Not checked", "Yes", "Partly", "No"] },
        { k: "others", label: "Who was named instead" },
        { k: "checked", label: "Checked", type: "date" }
      ],
      seed: [
        { _ex: true, q: "Who are the best 8x8 resellers in the UK?", engine: "ChatGPT", named: "Not checked", others: "", checked: today() },
        { _ex: true, q: "Hosted phone system for a police control room", engine: "Google AI Overview", named: "Not checked", others: "", checked: today() }
      ]
    }).node);
    grid.appendChild(rank); grid.appendChild(ai); main.appendChild(grid);

    var plan = panel("Content plan", "New pages, rewrites and blog posts. Blog ideas from the weekly brief land here once approved.");
    plan.appendChild(editableTable({
      key: "content-plan", csvName: "content-plan", addLabel: "Add content",
      columns: [
        { k: "title", label: "Working title" }, { k: "keyword", label: "Target search" },
        { k: "kind", label: "Type", type: "select", options: ["Blog post", "New page", "Page rewrite", "Case study", "FAQ"] },
        { k: "status", label: "Status", type: "select", options: ["Idea", "Drafting", "Review", "Scheduled", "Live"] },
        { k: "due", label: "Due", type: "date" }
      ],
      seed: [
        { _ex: true, title: "Rewrite the 8x8 partner page for AI answers", keyword: "8x8 partner UK", kind: "Page rewrite", status: "Idea", due: daysAgo(-7) }
      ]
    }).node);
    main.appendChild(plan);

    renderChangeLog(main);
  }

  /* Leads */
  function renderLeads(main) {
    main.innerHTML = head("Every lead in one place", "Leads", "Garry chases, you both update. Each lead has a status, an owner, a next step and notes.");
    var counts = el('<div class="stats"></div>');
    main.appendChild(counts);
    function drawCounts(rows) {
      counts.innerHTML = LEAD_STATUS.map(function (s) {
        var n = rows.filter(function (r) { return r.status === s; }).length;
        return stat(n, s, s === "New" && n > 0);
      }).join("");
      updateNav();
    }
    var p = panel("Lead tracker", "Edit any cell. Changes save as you go.");
    var t = editableTable({ key: "leads", csvName: "wpt-leads", addLabel: "Add lead", columns: LEAD_COLS, seed: LEAD_SEED, onChange: drawCounts,
      emptyText: "No leads yet. Add one, or send a chat across from the Live chat page.", newRow: function (r) { r.owner = "Garry"; } });
    p.appendChild(t.node); main.appendChild(p);
    drawCounts(t.get());
    main.appendChild(el('<div class="notice"><b>Garry can\'t see this yet.</b> Leads are saved in this browser only. Next step is shared storage so you both work from the same list. Until then, use Copy as CSV to send him the list.</div>'));
  }

  /* Email */
  function renderEmail(main) {
    main.innerHTML = head("iContact for now", "Email campaigns", "Every send with opens, clicks, bounces and unsubscribes. Rates work out automatically.");
    var flow = panel("How a send works", "From Quistor list to logged results.");
    flow.appendChild(el('<div class="steps">' +
      '<div><b>Step 1</b>Export the list from Quistor as a spreadsheet</div>' +
      '<div><b>Step 2</b>Clean it: duplicates, role addresses, opt-outs</div>' +
      '<div><b>Step 3</b>Upload to iContact and send</div>' +
      '<div><b>Step 4</b>After 3 days, export results and import here</div>' +
      '<div><b>Step 5</b>Clickers go to Leads for Garry</div></div>'));
    main.appendChild(flow);

    var summary = el('<div class="stats"></div>');
    main.appendChild(summary);
    function drawSummary(rows) {
      var real = rows.filter(function (r) { return Number(r.sent) > 0; });
      function avg(k) { var s = real.reduce(function (n, r) { return n + Number(r.sent); }, 0); var a = real.reduce(function (n, r) { return n + Number(r[k] || 0); }, 0); return fmtPct(pct(a, s)); }
      summary.innerHTML = stat(real.length, "Sends logged") + stat(avg("opens"), "Average open rate") + stat(avg("clicks"), "Average click rate") +
        stat(avg("bounces"), "Average bounce rate") + stat(avg("unsubs"), "Average unsubscribe rate");
    }
    var cols = [
      { k: "date", label: "Sent", type: "date" }, { k: "name", label: "Campaign" }, { k: "list", label: "List" },
      { k: "sent", label: "Sent", type: "number", num: true }, { k: "opens", label: "Opens", type: "number", num: true },
      { k: "clicks", label: "Clicks", type: "number", num: true }, { k: "bounces", label: "Bounces", type: "number", num: true },
      { k: "unsubs", label: "Unsubs", type: "number", num: true },
      { label: "Open %", compute: function (r) { return fmtPct(pct(r.opens, r.sent)); } },
      { label: "Click %", compute: function (r) { return fmtPct(pct(r.clicks, r.sent)); } },
      { label: "Bounce %", compute: function (r) { return fmtPct(pct(r.bounces, r.sent)); } }
    ];
    var p = panel("Sends", "Type results in, or import the iContact export below.");
    var t = editableTable({ key: "campaigns", csvName: "email-campaigns", addLabel: "Log a send", columns: cols, onChange: drawSummary,
      seed: [{ _ex: true, date: daysAgo(9), name: "Example: Teams Phone for law firms", list: "Quistor legal SE", sent: "1200", opens: "312", clicks: "41", bounces: "18", unsubs: "3" }] });
    p.appendChild(t.node);
    var imp = el('<details><summary class="muted" style="cursor:pointer;font-size:.88rem">Import an iContact results export (CSV)</summary>' +
      '<div class="row" style="margin-top:10px"><input type="file" id="email-csv" accept=".csv,text/csv"></div>' +
      '<p class="muted" style="font-size:.84rem;margin-top:6px">Columns are matched by name: date, subject or name, sent, opens, clicks, bounces, unsubscribes.</p></details>');
    p.appendChild(imp); main.appendChild(p);
    drawSummary(t.get());
    imp.querySelector("#email-csv").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var rows = parseCsv(String(r.result)); if (rows.length < 2) return toast("No rows found in that file");
        var h = rows[0].map(function (x) { return x.toLowerCase(); });
        function col(re) { return h.findIndex(function (x) { return re.test(x); }); }
        var map = { date: col(/date|sent on|time/), name: col(/subject|name|campaign|message/), sent: col(/^sent$|recipients|delivered|sent to/), opens: col(/unique open|open/), clicks: col(/unique click|click/), bounces: col(/bounce/), unsubs: col(/unsub/) };
        var added = 0;
        rows.slice(1).forEach(function (row) {
          var rec = { list: "" };
          Object.keys(map).forEach(function (k) { rec[k] = map[k] > -1 ? (row[map[k]] || "").replace(/[^0-9a-zA-Z :\/\-.,'&]/g, "") : ""; });
          if (rec.date) { var d = new Date(rec.date); if (!isNaN(d)) rec.date = d.toISOString().slice(0, 10); }
          t.add(rec); added++;
        });
        drawSummary(t.get()); toast(added + " sends imported");
      };
      r.readAsText(f);
    });
  }

  /* Live chat */
  function renderChat(main) {
    main.innerHTML = head("8x8 AI chatbot", "Live chat", "Website chats and which ones turned into leads.");
    main.appendChild(el('<div class="notice"><b>Not connected yet.</b> Once the 8x8 chatbot replaces the current one, its chat reports can feed this page. For now, log notable chats by hand.</div>'));
    var stats = el('<div class="stats"></div>'); main.appendChild(stats);
    function draw(rows) {
      var leads = rows.filter(function (r) { return r.outcome === "Lead"; }).length;
      stats.innerHTML = stat(rows.length, "Chats logged") + stat(leads, "Turned into leads", leads > 0) + stat(fmtPct(pct(leads, rows.length)), "Chat to lead rate");
    }
    var p = panel("Chat log", "Mark a chat as a lead, then send it to the Leads page.");
    var t = editableTable({
      key: "chats", csvName: "live-chats", addLabel: "Log a chat", onChange: draw,
      columns: [
        { k: "date", label: "Date", type: "date" }, { k: "who", label: "Visitor or company" }, { k: "page", label: "Page they were on" },
        { k: "topic", label: "What they asked" }, { k: "outcome", label: "Outcome", type: "select", options: ["Info only", "Lead", "Support", "Spam"] }
      ],
      seed: [{ _ex: true, date: daysAgo(1), who: "Example: visitor from a care group", page: "/8x8/", topic: "Pricing for 40 users", outcome: "Lead" }],
      actions: [{ label: "Send to Leads", run: function (r) {
        var leads = getRows("leads");
        leads.unshift({ _id: uid(), date: r.date || today(), company: r.who || "", contact: "", source: "Live chat", interest: r.topic || "", status: "New", owner: "Garry", next: "Follow up the chat", nextDate: today(), notes: "From chat on " + (r.page || "the website") });
        save("leads", leads); updateNav(); toast("Added to Leads for Garry");
      } }]
    });
    p.appendChild(t.node); main.appendChild(p); draw(t.get());
  }

  /* Weekly brief */
  var BRIEF_PROMPT = "Produce a weekly briefing for West Pier Technologies. Review westpiertech.com and search for major, consequential UK telecoms developments across unified communications, contact centre, business mobile, connectivity, IT services, cyber security, and AI automation. Include relevant public-sector and private-sector tenders, procurement notices, contract opportunities, partnership opportunities, and credible lead-generation signals. For each item, explain what changed, why it matters to West Pier Technologies, and practical campaign, content, outreach, positioning, or sales angles. Prioritise genuinely significant updates over minor industry noise, include dates and source links, and clearly separate: Big developments, Tenders and opportunities, Lead signals, and Recommended marketing actions.";
  function renderBrief(main) {
    main.innerHTML = head("Every Monday", "Weekly brief and blog ideas", "Run the brief, save it here, then turn the best items into posts aimed at searches we want to win.");
    var grid = el('<div class="grid-2"></div>');
    var p1 = panel("This week's brief", "Paste the finished brief in and save it.");
    var wc = (function () { var d = new Date(); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); })();
    p1.appendChild(el('<div class="form-grid"><label class="field" for="brief-week">Week starting<input type="date" id="brief-week" value="' + wc + '"></label></div>'));
    p1.appendChild(el('<label class="field" for="brief-text">Brief<textarea id="brief-text" style="min-height:180px" placeholder="Big developments / Tenders and opportunities / Lead signals / Recommended marketing actions"></textarea></label>'));
    var saveRow = el('<div class="row"><button type="button" class="btn primary" id="brief-save">Save brief</button></div>');
    p1.appendChild(saveRow);
    var archive = el('<div class="list"></div>'); p1.appendChild(el("<h3>Past briefs</h3>")); p1.appendChild(archive);
    function drawArchive() {
      var b = load("briefs", []);
      archive.innerHTML = b.length ? b.map(function (x, i) {
        return '<div class="list-item"><span class="chip info mono">' + esc(x.week) + '</span><div><div class="s">' + esc(x.text.slice(0, 160)) + (x.text.length > 160 ? "…" : "") +
          '</div></div><button type="button" class="btn small" data-open="' + i + '">Open</button></div>';
      }).join("") : '<div class="empty">No briefs saved yet.</div>';
    }
    drawArchive();
    saveRow.querySelector("button").addEventListener("click", function () {
      var text = p1.querySelector("#brief-text").value.trim(); if (!text) return toast("Paste the brief in first");
      var week = p1.querySelector("#brief-week").value;
      var b = load("briefs", []).filter(function (x) { return x.week !== week; });
      b.unshift({ week: week, text: text }); b.sort(function (a, c) { return a.week < c.week ? 1 : -1; });
      save("briefs", b); drawArchive(); toast("Brief saved for w/c " + week);
    });
    archive.addEventListener("click", function (e) {
      var i = e.target.getAttribute("data-open"); if (i == null) return;
      var x = load("briefs", [])[i];
      p1.querySelector("#brief-week").value = x.week; p1.querySelector("#brief-text").value = x.text;
    });

    var p2 = panel("The brief prompt", "Copy this into Claude or ChatGPT each week.");
    p2.appendChild(el('<div class="prompt-box" id="brief-prompt"></div>'));
    p2.querySelector("#brief-prompt").textContent = BRIEF_PROMPT;
    var cp = el('<div class="row"><button type="button" class="btn">Copy prompt</button></div>');
    cp.querySelector("button").addEventListener("click", function () { copyText(BRIEF_PROMPT, "Prompt copied"); });
    p2.appendChild(cp);
    grid.appendChild(p1); grid.appendChild(p2); main.appendChild(grid);

    var p3 = panel("Blog ideas", "Strongest items from the brief. Approve one and it moves to the content plan.");
    p3.appendChild(editableTable({
      key: "blog-ideas", csvName: "blog-ideas", addLabel: "Add idea",
      columns: [
        { k: "title", label: "Post idea" }, { k: "search", label: "Search it targets" }, { k: "source", label: "From brief item" },
        { k: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] }, { k: "week", label: "Brief week", type: "date" }
      ],
      seed: [{ _ex: true, title: "What the PSTN switch-off means for GP surgeries", search: "PSTN switch off GP practice", source: "Big developments", priority: "High", week: wc }],
      actions: [{ label: "Approve", run: function (r) {
        var plan = getRows("content-plan");
        plan.unshift({ _id: uid(), title: r.title, keyword: r.search, kind: "Blog post", status: "Idea", due: daysAgo(-14) });
        save("content-plan", plan); toast("Moved to the content plan");
      } }]
    }).node);
    main.appendChild(p3);
  }

  /* Inbox */
  function renderInbox(main) {
    main.innerHTML = head("Outlook, read-only", "Inbox triage", "What needs you, in order: leads, partners, complaints, then important updates.");
    main.appendChild(el('<div class="grid">' +
      '<section class="panel"><h2>Ground rules</h2><div class="list">' +
      ["Read-only access to Outlook", "Never sends, replies, deletes or moves anything", "Only flags. You decide what happens next"].map(function (t) {
        return '<div class="list-item"><span class="chip good">Rule</span><div class="t">' + esc(t) + "</div><span></span></div>";
      }).join("") + "</div></section>" +
      '<section class="panel"><h2>Priority order</h2><div class="list">' +
      [["Lead", "flag", "Enquiries, quote requests, replies to campaigns"], ["Partner", "info", "8x8, Gamma, 3CX, Zoom Phone"], ["Complaint", "bad", "Anything from an unhappy customer"], ["Update", "", "Tenders, renewals, price changes, deadlines"]].map(function (x) {
        return '<div class="list-item"><span class="chip ' + x[1] + '">' + x[0] + '</span><div class="s">' + esc(x[2]) + "</div><span></span></div>";
      }).join("") + "</div></section></div>"));
    main.appendChild(el('<div class="notice"><b>Outlook isn\'t connected yet.</b> This needs a Microsoft 365 connection with read-only mail permission, which Matt will need to approve. Until then, log anything you want tracked here.</div>'));
    var p = panel("Flagged emails", "Mark each one as dealt with when it's sorted.");
    p.appendChild(editableTable({
      key: "inbox", csvName: "inbox-flags", addLabel: "Add flagged email", onChange: updateNav,
      columns: [
        { k: "received", label: "Received", type: "date" }, { k: "from", label: "From" }, { k: "subject", label: "Subject" },
        { k: "category", label: "Type", type: "select", options: ["Lead", "Partner", "Complaint", "Update"] },
        { k: "why", label: "Why it's flagged" }, { k: "state", label: "State", type: "select", options: ["Needs you", "Waiting on someone", "Dealt with"] }
      ],
      seed: [
        { _ex: true, received: today(), from: "Example: 8x8 partner team", subject: "Q4 partner incentive changes", category: "Partner", why: "Affects margin on new deals", state: "Needs you" }
      ]
    }).node);
    main.appendChild(p);
  }

  /* ---------- WordPress connection ----------
     The application password is saved in this browser only. It is never written
     to the repo and only used when Connor presses a button. */
  var SEO_KEYS = {
    yoast: { title: "_yoast_wpseo_title", desc: "_yoast_wpseo_metadesc", name: "Yoast SEO" },
    rankmath: { title: "rank_math_title", desc: "rank_math_description", name: "Rank Math" },
    seopress: { title: "_seopress_titles_title", desc: "_seopress_titles_desc", name: "SEOPress" }
  };
  function wpAuth() { return load("wp-auth", null); }
  function wpBase(a) { return a.site.replace(/\/$/, "") + "/wp-json"; }
  function wpFetch(path, opts) {
    var a = wpAuth();
    if (!a || !a.user || !a.pass) return Promise.reject(new Error("WordPress isn't connected. Add your application password on the Website & SEO page."));
    opts = opts || {};
    var token;
    try { token = btoa(a.user + ":" + a.pass); } catch (e) { return Promise.reject(new Error("The username has characters the connection can't send. Use the plain WordPress username.")); }
    var headers = { "Authorization": "Basic " + token };
    if (opts.body) headers["Content-Type"] = "application/json";
    var method = opts.method || "GET";
    /* A unique query on reads stops SiteGround or any other cache serving an old answer. */
    var url = wpBase(a) + path + (method === "GET" ? (path.indexOf("?") > -1 ? "&" : "?") + "_wpt=" + Date.now() : "");
    /* No extra headers here: WordPress only allows Authorization and Content-Type from other pages,
       and the browser blocks the whole request if anything else is sent. */
    return fetch(url, { method: method, headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) {
            var msg = j && j.message ? stripHtml(j.message) : "WordPress answered " + r.status + ".";
            if (r.status === 401) msg += " Check the username and application password.";
            if (r.status === 403) msg += " The account may not have permission, or a security plugin is blocking API logins.";
            throw new Error(msg);
          }
          return j;
        });
      }, function () { throw new Error("Couldn't reach the site. Check the address and your internet connection. If it keeps failing, a security plugin or the host may be blocking API logins."); });
  }
  function metaKey(kind) {
    var a = wpAuth(); var k = a && SEO_KEYS[a.seo];
    if (!k) return null;
    return kind === "meta_title" ? k.title : k.desc;
  }

  /* Live page checks via the page checker snippet (docs/wordpress-page-checker.php). */
  function hasChecker() { var a = wpAuth(); return !!(a && a.pass && a.ok && a.checker); }
  function checkUrls(urls, onProgress) {
    var out = {}, list = urls.slice(), done = 0;
    function nextChunk() {
      if (!list.length) return Promise.resolve(out);
      var chunk = list.splice(0, 8);
      return wpFetch("/wpt-hub/v1/check", { method: "POST", body: { urls: chunk } }).then(function (rows) {
        (rows || []).forEach(function (r) {
          if (r.location) { try { r.location = new URL(r.location, r.url).href; } catch (e) { /* keep as is */ } }
          out[norm(r.url)] = r;
        });
        done += chunk.length; if (onProgress) onProgress(done, urls.length);
        return nextChunk();
      });
    }
    return nextChunk();
  }
  function copyLive(p, r) {
    p.linksAll = r.links_all || []; p.linksContent = r.links_content || []; p.h1 = Array.isArray(r.h1) ? r.h1 : []; p.canonical = r.canonical || "";
    p.schema = r.schema || []; p.ogImage = r.og_image || ""; p.googleVerify = !!r.google_verify; p.bingVerify = !!r.bing_verify;
    p.images = r.images || 0; p.imagesNoAlt = r.images_no_alt || 0; p.ms = r.ms || 0; p.noindex = !!r.noindex;
    return p;
  }
  function isRedirect(r) { return r && r.status >= 300 && r.status < 400; }
  function shortPath(u) { return String(u || "").replace(/^https?:\/\/[^\/]+/, "") || "/"; }
  function liveIssues(r) {
    var out = [], d = r.description || "", t = r.title || "";
    if (r.words < 300) out.push("Thin content (" + r.words + " words on the live page)");
    if (!d) out.push("No meta description");
    else if (d.length > 160) out.push("Meta description too long");
    else if (d.length < 70) out.push("Meta description short");
    if (t.length > 60) out.push("Title tag over 60 characters");
    if (r.h2 === 0 && r.words > 150) out.push("No H2 subheadings");
    if (r.noindex) out.push("Set to noindex");
    if (Array.isArray(r.h1) && !r.h1.length) out.push("No H1");
    if (Array.isArray(r.h1) && r.h1.length > 1) out.push(r.h1.length + " H1s");
    if (r.canonical && norm(r.canonical) !== norm(r.url)) out.push("Canonical points elsewhere");
    return out;
  }
  var API_ONLY_ISSUE = /^(Thin content|No (custom )?meta description|Meta description (too long|short)|Title tag over|No H2)/;
  /* Merge live results into audited pages, and add pages that only exist as redirect targets. */
  function applyLive(pages, live) {
    var known = {};
    pages.forEach(function (p) {
      known[norm(p.link)] = true;
      var r = live[norm(p.link)];
      p.customDesc = !!p.metaDesc;
      if (!r) return;
      if (r.error) { p.issues.push("Live check failed: " + r.error); return; }
      p.liveStatus = r.status;
      if (isRedirect(r)) { p.redirectTo = r.location; p.issues = []; return; }
      if (r.status !== 200) { p.issues = ["Live page answers " + r.status]; return; }
      p.words = r.words; p.metaTitle = r.title || ""; p.metaDesc = r.description || ""; p.h2 = r.h2; p.hasSeo = true; p.live = true; copyLive(p, r);
      p.issues = p.issues.filter(function (i) { return !API_ONLY_ISSUE.test(i); }).concat(liveIssues(r));
    });
    var targets = [];
    pages.forEach(function (p) { if (p.redirectTo && !known[norm(p.redirectTo)] && targets.indexOf(p.redirectTo) < 0) targets.push(p.redirectTo); });
    return targets;
  }
  function liveOnlyRow(url, r) {
    if (!r || r.error || r.status !== 200) return { title: shortPath(url), link: url, type: "Live page", words: 0, metaTitle: "", metaDesc: "", h2: 0, internal: "–", modified: "", hasSeo: true, liveOnly: true, issues: [r && r.error ? "Live check failed: " + r.error : "Live page answers " + (r ? r.status : "nothing")] };
    return copyLive({ title: r.title || shortPath(url), link: url, type: "Live page", words: r.words, metaTitle: r.title || "", metaDesc: r.description || "", h2: r.h2, internal: "–", modified: "", hasSeo: true, live: true, liveOnly: true, liveStatus: 200, issues: liveIssues(r) }, r);
  }

  function renderWpConnect(main) {
    var a = wpAuth() || { site: load("seo-settings", { site: "https://westpiertech.com" }).site, user: "", pass: "" };
    var p = panel("Connect WordPress", "Lets the hub push fixes you approve. The password stays in this browser and is never shared.",
      '<span class="chip ' + (a.pass && a.ok ? "good" : "") + '" id="wp-chip">' + (a.pass && a.ok ? "Connected" : a.pass ? "Not tested" : "Not connected") + "</span>");
    var box = el('<div style="display:flex;flex-direction:column;gap:12px"><div class="form-grid">' +
      '<label class="field" for="wp-site">Site address<input id="wp-site" value="' + esc(a.site) + '"></label>' +
      '<label class="field" for="wp-user">WordPress username<input id="wp-user" autocomplete="off" value="' + esc(a.user) + '"></label>' +
      '<label class="field" for="wp-pass">Application password<input id="wp-pass" type="password" autocomplete="new-password" placeholder="' + (a.pass ? "Saved. Paste a new one to replace it." : "xxxx xxxx xxxx xxxx xxxx xxxx") + '"></label></div>' +
      '<div class="row"><button type="button" class="btn primary" id="wp-test">Save and test</button>' +
      '<button type="button" class="btn danger" id="wp-forget"' + (a.pass ? "" : " hidden") + ">Remove password from this browser</button></div>" +
      '<div id="wp-result"></div>' +
      '<div class="row" style="font-size:.86rem"><span class="muted">WordPress snippets:</span>' +
      '<button type="button" class="btn small" data-snip="seo">Copy SEO fields code</button>' +
      '<button type="button" class="btn small" data-snip="checker">Copy page checker code</button>' +
      '<button type="button" class="btn small" data-snip="ga4">Copy GA4 code</button>' +
      '<span class="muted">Paste into Snippets in WordPress, replacing what\'s there.</span></div>' +
      '<details><summary class="muted" style="cursor:pointer;font-size:.88rem">Where do I get an application password?</summary>' +
      '<p class="muted" style="font-size:.86rem;margin-top:8px">In WordPress go to Users, then Profile. Scroll to Application Passwords, type "Marketing Hub" and click Add. Copy the password it shows and paste it above. Never paste it into a chat or email. You can revoke it from the same screen at any time.</p></details></div>');
    p.appendChild(box); main.appendChild(p);
    var res = box.querySelector("#wp-result");
    box.addEventListener("click", function (e) {
      var k = e.target.getAttribute("data-snip"); if (!k) return;
      var code = (window.WPT_SNIPPETS || {})[k];
      if (!code) return toast("Snippet code not found. Pull the latest version of the hub.");
      copyText(code, "Copied. Paste it into the snippet in WordPress and save.");
    });
    if (a.ok) res.innerHTML = connectSummary(a);

    box.querySelector("#wp-test").addEventListener("click", function () {
      var cur = wpAuth() || {};
      var pass = box.querySelector("#wp-pass").value.trim() || cur.pass || "";
      var next = { site: box.querySelector("#wp-site").value.trim(), user: box.querySelector("#wp-user").value.trim(), pass: pass };
      if (!next.user || !next.pass) { res.innerHTML = '<div class="notice">Add the username and the application password first.</div>'; return; }
      save("wp-auth", next);
      box.querySelector("#wp-pass").value = "";
      res.innerHTML = '<div class="notice info">Testing the connection…</div>';
      wpFetch("/wp/v2/users/me?context=edit&_fields=id,name,roles").then(function (me) {
        next.name = me.name; next.roles = me.roles || [];
        return fetch(wpBase(next) + "/").then(function (r) { return r.json(); }).catch(function () { return {}; });
      }).then(function (idx) {
        var ns = (idx && idx.namespaces) || [];
        next.seo = ns.indexOf("yoast/v1") > -1 ? "yoast" : ns.indexOf("rankmath/v1") > -1 ? "rankmath" : ns.some(function (n) { return n.indexOf("seopress") === 0; }) ? "seopress" : ns.some(function (n) { return n.indexOf("aioseo") === 0; }) ? "aioseo" : "none";
        next.checker = ns.indexOf("wpt-hub/v1") > -1;
        next.checkerVersion = 0;
        var k = SEO_KEYS[next.seo];
        if (!k) return null;
        return wpFetch("/wp/v2/pages?context=edit&per_page=1&_fields=id,meta").then(function (rows) {
          var m = rows[0] && rows[0].meta;
          next.metaReady = !!(m && Object.prototype.hasOwnProperty.call(m, k.title));
        });
      }).then(function () {
        if (!next.checker) return;
        return wpFetch("/wpt-hub/v1/analytics?days=7").then(function (d) { next.checkerVersion = (d && d.version) || 3; },
          function () { return wpFetch("/wpt-hub/v1/site").then(function () { next.checkerVersion = 2; }, function () { next.checkerVersion = 1; }); });
      }).then(function () {
        next.ok = true; next.tested = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
        save("wp-auth", next); res.innerHTML = connectSummary(next);
        p.querySelector("#wp-chip").className = "chip good"; p.querySelector("#wp-chip").textContent = "Connected";
        box.querySelector("#wp-forget").hidden = false; updateNav();
      }).catch(function (err) {
        next.ok = false; save("wp-auth", next);
        p.querySelector("#wp-chip").className = "chip bad"; p.querySelector("#wp-chip").textContent = "Not working";
        box.querySelector("#wp-forget").hidden = false;
        res.innerHTML = '<div class="notice"><b>Connection failed.</b> ' + esc(err.message) + "</div>";
      });
    });
    box.querySelector("#wp-forget").addEventListener("click", function (e) {
      var b = e.target;
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to remove it"; return; }
      var cur = wpAuth() || {}; save("wp-auth", { site: cur.site, user: cur.user, pass: "" });
      b.hidden = true; b.textContent = "Remove password from this browser"; delete b.dataset.sure;
      res.innerHTML = '<div class="notice info">Password removed from this browser. Revoke it in WordPress too if you won\'t use it again.</div>';
      p.querySelector("#wp-chip").className = "chip"; p.querySelector("#wp-chip").textContent = "Not connected"; updateNav();
    });
  }
  function connectSummary(a) {
    var admin = (a.roles || []).indexOf("administrator") > -1;
    var k = SEO_KEYS[a.seo];
    var seoLine = k ? (a.metaReady ? '<span class="chip good">' + k.name + " fields ready</span>" : '<span class="chip flag">' + k.name + " found, snippet not added yet</span>")
      : a.seo === "aioseo" ? '<span class="chip flag">All in One SEO found. Title and description fixes need a different setup, ask Claude</span>'
      : '<span class="chip flag">No SEO plugin found</span>';
    return '<div class="list">' +
      '<div class="list-item"><span class="chip good">Login</span><div><div class="t">Signed in as ' + esc(a.name || a.user) + '</div><div class="s">Role: ' + esc((a.roles || []).join(", ") || "unknown") + " · tested " + esc(a.tested || "") + "</div></div><span></span></div>" +
      '<div class="list-item"><span class="chip info">SEO</span><div>' + seoLine + '<div class="s" style="margin-top:4px">' +
      (k && !a.metaReady ? "Title and description fixes can't be pushed until the snippet in docs/wordpress-snippet.php is added. Content fixes work now." : k ? "Title, description and content fixes can all be pushed." : "Content fixes work. Title and description fixes need an SEO plugin.") +
      "</div></div><span></span></div>" +
      '<div class="list-item"><span class="chip info">Live</span><div>' + (a.checker && a.checkerVersion && a.checkerVersion < 5 ? '<span class="chip bad">Page checker out of date (version ' + a.checkerVersion + ' installed, 5 needed)</span><div class="s" style="margin-top:4px">Replace the code in Snippets, WPT Hub page checker, with everything from docs/wordpress-page-checker.php, then Save and test again. Until then the site checks, Search Console and page editing won\'t work.</div>' : a.checker ? '<span class="chip good">Page checker ready' + (a.checkerVersion ? " (version " + a.checkerVersion + ")" : "") + '</span><div class="s" style="margin-top:4px">The audit checks redirects and what visitors actually see on each page.</div>' : '<span class="chip flag">Page checker not added</span><div class="s" style="margin-top:4px">Add docs/wordpress-page-checker.php as a second snippet so the audit can spot redirected pages and read Elementor pages properly.</div>') + "</div><span></span></div>" +
      (admin ? '<div class="list-item"><span class="chip flag">Role</span><div><div class="t">This is an administrator account</div><div class="s">It works, but if the password leaked it could change plugins and users. A separate Editor account is safer.</div></div><span></span></div>' : "") +
      "</div>";
  }

  /* ---------- Technical SEO and AEO checks ----------
     Turns the live audit into Fix queue items. Each finding has a stable id, so a
     fix you've marked done or dismissed stays that way, and findings that are gone
     on the next audit drop out of the queue. */
  var PRI_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Bingbot", "Applebot"];
  var STOP = { a: 1, an: 1, and: 1, the: 1, for: 1, of: 1, to: 1, in: 1, on: 1, with: 1, is: 1, are: 1, what: 1, how: 1, your: 1, you: 1, uk: 1, it: 1, do: 1, does: 1, west: 1, pier: 1, technologies: 1, 2026: 1, 2027: 1, guide: 1, best: 1, top: 1 };

  function robotsBlocks(body, bot) {
    /* True if robots.txt disallows the whole site for this bot (its own group, or * when it has none). */
    var groups = [], cur = null;
    String(body || "").split(/\r?\n/).forEach(function (line) {
      line = line.replace(/#.*/, "").trim(); if (!line) return;
      var m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) return;
      var k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
      else if (cur && (k === "disallow" || k === "allow")) cur.rules.push({ k: k, v: v });
    });
    var own = groups.filter(function (g) { return g.agents.indexOf(bot.toLowerCase()) > -1; });
    var use = own.length ? own : groups.filter(function (g) { return g.agents.indexOf("*") > -1; });
    return use.some(function (g) {
      var dis = g.rules.some(function (r) { return r.k === "disallow" && r.v === "/"; });
      var allowAll = g.rules.some(function (r) { return r.k === "allow" && r.v === "/"; });
      return dis && !allowAll;
    });
  }
  function titleWords(t) {
    return String(t || "").toLowerCase().replace(/\|.*$/, "").split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 && !STOP[w]; });
  }
  function overlap(a, b) {
    if (!a.length || !b.length) return 0;
    var n = a.filter(function (w) { return b.indexOf(w) > -1; }).length;
    return n / Math.min(a.length, b.length);
  }

  /* Run the site-wide check and extra address checks, then store everything on the audit. */
  function siteAudit(pages, prog) {
    return wpFetch("/wpt-hub/v1/site").then(function (site) {
      var status = {};
      pages.forEach(function (p) { if (p.liveStatus || p.live) status[norm(p.link)] = { status: p.liveStatus || 200, location: p.redirectTo || "" }; });
      var extra = [];
      function want(u) { var k = norm(u); if (!status[k] && extra.indexOf(u) < 0 && extra.length < 250) extra.push(u); }
      (site.sitemap_urls || []).forEach(want);
      pages.forEach(function (p) { (p.linksAll || []).forEach(want); });
      (site.redirections || []).forEach(function (r) { if (r.url_to && /^https?:/.test(r.url_to)) want(r.url_to); else if (r.url_to) want(site.home.replace(/\/$/, "") + "/" + r.url_to.replace(/^\//, "")); });
      if (!extra.length) return { site: site, status: status, extraRows: {} };
      return checkUrls(extra, prog).then(function (live) {
        Object.keys(live).forEach(function (k) { var r = live[k]; status[k] = { status: r.status || 0, location: r.location || "", error: r.error || "" }; });
        return { site: site, status: status, extraRows: live };
      });
    });
  }

  function indexable(p) { return !p.redirectTo && p.live && !p.noindex; }
  function pageRef(p, note) { return { title: p.title, link: p.link, note: note || "" }; }

  function buildAutoFixes(audit) {
    var out = [], site = audit.siteData, status = audit.status || {}, pages = audit.pages, today = new Date().toISOString().slice(0, 10);
    if (!site) return out;
    var home = site.home, idx = pages.filter(indexable);
    var byKey = {}; pages.forEach(function (p) { byKey[norm(p.link)] = p; });
    var claude = {}; proposals().forEach(function (f) { if (!f.auto) claude[f.type + "|" + norm(f.link)] = true; });
    function add(o) {
      o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found by audit";
      o.link = o.link || home; o.pageTitle = o.pageTitle || "Whole site";
      out.push(o);
    }

    /* Indexing */
    if (site.blog_public === 0) add({ id: "auto-blog-public", priority: "critical", category: "Indexing", issue: "WordPress is telling search engines not to index the site",
      why: "The 'Discourage search engines' box is ticked. Google may drop the whole site from results.", steps: ["In WordPress go to Settings, then Reading.", "Untick 'Discourage search engines from indexing this site'.", "Save Changes."] });
    var rb = site.robots;
    if (!rb || rb.status !== 200) add({ id: "auto-robots-missing", priority: "high", category: "Indexing", issue: "No robots.txt file",
      why: "Search engines check robots.txt first. Without one they can still crawl, but you lose the chance to point them at your sitemap.", steps: ["In WordPress go to Rank Math, then General Settings, then Edit robots.txt.", "Make sure it contains: User-agent: * / Allow: / and a Sitemap: line pointing at https://westpiertech.com/sitemap_index.xml.", "Save, then run the audit again."] });
    else {
      if (robotsBlocks(rb.body, "Googlebot") || robotsBlocks(rb.body, "*")) add({ id: "auto-robots-blocks-all", priority: "critical", category: "Indexing", issue: "robots.txt blocks search engines from the whole site",
        why: "A 'Disallow: /' rule tells Google not to crawl anything.", steps: ["Rank Math, then General Settings, then Edit robots.txt.", "Remove the 'Disallow: /' line under User-agent: *.", "Save and run the audit again."] });
      var blocked = AI_BOTS.filter(function (b) { return robotsBlocks(rb.body, b); });
      if (blocked.length) add({ id: "auto-robots-ai", priority: "high", category: "AI search", issue: "robots.txt blocks AI search tools: " + blocked.join(", "),
        why: "These are the crawlers behind ChatGPT search, Claude, Perplexity, Gemini, Copilot and Apple. Blocked, they can't read your pages, so they won't recommend you.", steps: ["Rank Math, then General Settings, then Edit robots.txt.", "Remove the Disallow: / rules for " + blocked.join(", ") + ".", "Save and run the audit again."] });
      if (!/^\s*sitemap\s*:/im.test(rb.body)) add({ id: "auto-robots-sitemap", priority: "low", category: "Indexing", issue: "robots.txt doesn't point to the sitemap",
        why: "Every search engine reads robots.txt, so it's the easiest place to tell them where the sitemap is.", steps: ["Rank Math, then General Settings, then Edit robots.txt.", "Add this line at the end: Sitemap: https://westpiertech.com/sitemap_index.xml", "Save."] });
    }
    var goodMaps = (site.sitemaps || []).filter(function (m) { return m.status === 200; });
    if (!goodMaps.length) add({ id: "auto-sitemap-missing", priority: "high", category: "Indexing", issue: "No working XML sitemap found",
      why: "The sitemap is the list of pages you want search engines to find. Without it, new pages take longer to show up.", steps: ["Rank Math, then Dashboard, then make sure the Sitemap module is switched on.", "Open https://westpiertech.com/sitemap_index.xml to check it loads.", "Run the audit again."] });
    else {
      var smKeys = {}; (site.sitemap_urls || []).forEach(function (u) { smKeys[norm(u)] = u; });
      var badInMap = Object.keys(smKeys).filter(function (k) { var s = status[k]; var p = byKey[k]; return (s && s.status && s.status !== 200) || (p && p.noindex); })
        .map(function (k) { var s = status[k] || {}; var p = byKey[k]; return { title: shortPath(smKeys[k]), link: smKeys[k], note: p && p.noindex ? "set to noindex" : s.status >= 300 && s.status < 400 ? "redirects to " + shortPath(s.location) : "answers " + s.status }; });
      if (badInMap.length) add({ id: "auto-sitemap-bad", priority: "high", category: "Indexing", issue: badInMap.length + " addresses in the sitemap aren't live pages", pages: badInMap,
        why: "The sitemap should only list pages you want in Google. Listing redirects, missing pages or noindexed pages wastes Google's crawl and makes the sitemap look unreliable.", steps: ["For redirected pages: in WordPress, open the old page and set it to draft, or in Rank Math set it to noindex, so it drops out of the sitemap.", "For pages answering 404: remove them or redirect them in Rank Math, then Redirections.", "For noindexed pages: Rank Math leaves them out automatically once the setting is saved. If one still shows, re-save the page.", "Run the audit again."] });
      var missing = idx.filter(function (p) { return !smKeys[norm(p.link)]; }).map(function (p) { return pageRef(p); });
      if (missing.length) add({ id: "auto-sitemap-missing-pages", priority: "medium", category: "Indexing", issue: missing.length + " live pages aren't in the sitemap", pages: missing,
        why: "Pages missing from the sitemap are slower to be found and re-crawled. This often happens with pages built outside the normal page list.", steps: ["If they're normal WordPress pages: Rank Math, then Sitemap Settings, and check that post type is included.", "If they're Matt's pages: ask Matt to add them to the sitemap (Rank Math can include extra addresses, or his code can register them).", "Run the audit again."] });
    }
    var bare = norm(home);
    function exact(u) { return String(u || "").replace(/\/$/, "").toLowerCase(); }
    (site.variants || []).forEach(function (v) {
      if (exact(v.url) === exact(home)) return;
      var label = v.url.replace(/\/$/, "");
      if (v.error) { if (/www\./.test(v.url) && /^https:/.test(v.url)) add({ id: "auto-variant-" + label.replace(/\W+/g, "-"), priority: "low", category: "Structure", issue: label + " doesn't load", why: "Some people still type www. If it doesn't load, they think the site is down.", steps: ["Ask Matt to add a www record in DNS and redirect it to https://westpiertech.com/ with a 301."] }); return; }
      var straight = exact(v.location) === exact(home);
      if (v.status === 200) add({ id: "auto-variant-" + label.replace(/\W+/g, "-"), priority: "high", category: "Structure", issue: label + " shows the site without redirecting",
        why: "Two addresses showing the same site split your Google ranking between them.", steps: ["Ask Matt to make " + label + " redirect to https://westpiertech.com/ with a 301 (permanent) redirect, at the host or in .htaccess."] });
      else if (v.status >= 300 && v.status < 400 && (!straight || v.status === 302 || v.status === 307)) add({ id: "auto-variant-" + label.replace(/\W+/g, "-"), priority: "medium", category: "Structure", issue: label + (!straight ? " redirects via " + shortPath(v.location) + " instead of straight to the main address" : " uses a temporary (" + v.status + ") redirect"),
        why: "The redirect to the main address should be a single permanent (301) hop. Extra hops and temporary redirects leak ranking strength.", steps: ["Ask Matt to point " + label + " straight at https://westpiertech.com/ with a 301 redirect."] });
    });
    var homeRow = byKey[bare];
    if (homeRow && homeRow.live) {
      if (!homeRow.googleVerify) add({ id: "auto-verify-google", priority: "medium", category: "Indexing", issue: "Can't see Google Search Console verification on the home page",
        why: "Search Console is where Google tells you which pages it has indexed, which searches you appear for and what's broken. If it's already verified another way (for example through DNS), mark this done.", steps: ["Go to search.google.com/search-console and add westpiertech.com (Domain property).", "Verify through DNS (Matt) or copy the HTML tag into Rank Math, then General Settings, then Webmaster Tools, then Google Search Console.", "Submit https://westpiertech.com/sitemap_index.xml under Sitemaps."] });
      if (!homeRow.bingVerify) add({ id: "auto-verify-bing", priority: "medium", category: "AI search", issue: "Can't see Bing Webmaster Tools verification",
        why: "Bing's index feeds Microsoft Copilot and is used by other AI search tools. Being set up properly in Bing matters more now than it used to. If it's verified another way, mark this done.", steps: ["Go to bing.com/webmasters and sign in.", "Use 'Import from Google Search Console' (quickest) or add the site and copy the meta tag into Rank Math, then General Settings, then Webmaster Tools, then Bing.", "Submit the sitemap.", "In Rank Math, switch on Instant Indexing (IndexNow) so Bing hears about changes straight away."] });
      var hs = homeRow.schema || [];
      if (!hs.some(function (t) { return /Organization|LocalBusiness|Corporation|ProfessionalService/.test(t); })) add({ id: "auto-schema-org", priority: "high", category: "AI search", issue: "Home page has no Organisation or LocalBusiness schema", link: homeRow.link,
        why: "This is the structured data that tells Google and AI tools who WPT is, where you are and how to contact you. It feeds the knowledge panel and AI answers about the business.", steps: ["Rank Math, then Titles & Meta, then Local SEO.", "Set 'Person or Company' to Company, fill in name, logo, address, phone 01273 391200 and opening hours.", "Save, purge the cache and run the audit again."] });
    }
    if (site.llms !== 200) add({ id: "auto-llms", priority: "low", category: "AI search", issue: "No llms.txt file",
      why: "llms.txt is a short plain-text summary of the site for AI tools: what you do, your key pages and how to contact you. It's new and not every AI tool reads it yet, but it's cheap to add.", steps: ["Ask Claude to write the llms.txt for WPT.", "Rank Math has an llms.txt option under General Settings in recent versions. If yours doesn't, Matt uploads the file to the site root.", "Check https://westpiertech.com/llms.txt loads, then run the audit again."] });

    /* Redirect rules */
    var rules = (site.redirections || []).filter(function (r) { return r.status === "active"; });
    function abs(u) { return /^https?:/.test(u) ? u : home.replace(/\/$/, "") + "/" + String(u || "").replace(/^\//, ""); }
    var chains = [], dead = [], temp = [];
    rules.forEach(function (r) {
      var src = (r.sources || []).map(function (s) { return s.pattern; }).join(", ");
      var t = status[norm(abs(r.url_to))];
      if (t && t.status >= 300 && t.status < 400) chains.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "which redirects again to " + shortPath(t.location) });
      else if (t && t.status >= 400) dead.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "target answers " + t.status });
      if (String(r.header_code) === "302" || String(r.header_code) === "307") temp.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "uses " + r.header_code });
    });
    if (dead.length) add({ id: "auto-redirect-dead", priority: "high", category: "Structure", issue: dead.length + " redirects send visitors to a page that doesn't exist", pages: dead,
      why: "Anyone following an old link lands on an error, and Google drops the ranking the old page had.", steps: ["Rank Math, then Redirections.", "Edit each rule listed to point at the right live page.", "Run the audit again."] });
    if (chains.length) add({ id: "auto-redirect-chain", priority: "medium", category: "Structure", issue: chains.length + " redirects go through more than one hop", pages: chains,
      why: "Each extra hop slows the visit down and loses some ranking strength. Google may stop following long chains.", steps: ["Rank Math, then Redirections.", "Change each rule listed to point straight at the final page.", "Run the audit again."] });
    if (temp.length) add({ id: "auto-redirect-temp", priority: "medium", category: "Structure", issue: temp.length + " redirects are set as temporary", pages: temp,
      why: "Temporary (302/307) redirects tell Google the old page is coming back, so it keeps the old address in results. Moves that are permanent should be 301.", steps: ["Rank Math, then Redirections.", "Edit each rule listed and change the type to 301 Permanent Move.", "Save."] });

    /* Links */
    var broken = [], toRedirect = [], inbound = {};
    pages.forEach(function (p) {
      if (!p.live) return;
      (p.linksAll || []).forEach(function (u) { var k = norm(u); if (k !== norm(p.link)) inbound[k] = (inbound[k] || 0) + 1; });
      (p.linksContent || []).forEach(function (u) {
        var s = status[norm(u)]; if (!s) return;
        if (s.status >= 400 || s.status === 0) broken.push({ title: p.title, link: p.link, note: "links to " + shortPath(u) + " (" + (s.status || "no answer") + ")" });
        else if (s.status >= 300 && s.status < 400) toRedirect.push({ title: p.title, link: p.link, note: "links to " + shortPath(u) + ", which redirects to " + shortPath(s.location) });
      });
    });
    if (broken.length) add({ id: "auto-links-broken", priority: "high", category: "Structure", issue: broken.length + " broken links in page content", pages: broken,
      why: "Broken links frustrate visitors and waste the link's value. Google sees them as a sign the site isn't looked after.", steps: ["Open each page listed in Elementor or the editor.", "Find the link noted and point it at the right live page, or remove it.", "Run the audit again."] });
    if (toRedirect.length) add({ id: "auto-links-redirected", priority: "medium", category: "Structure", issue: toRedirect.length + " links point at old addresses that redirect", pages: toRedirect,
      why: "They still work, but every click goes through a redirect, and some link value is lost. Pointing straight at the new address is cleaner.", steps: ["Open each page listed in Elementor or the editor.", "Change the link noted to the new address shown.", "Run the audit again."] });
    var orphans = idx.filter(function (p) { return norm(p.link) !== bare && !inbound[norm(p.link)]; }).map(function (p) { return pageRef(p); });
    if (orphans.length) add({ id: "auto-orphans", priority: "high", category: "Structure", issue: orphans.length + " pages have no links pointing to them", pages: orphans,
      why: "If no page on the site links to a page, Google struggles to find it and treats it as unimportant. These are effectively hidden.", steps: ["Decide where each page belongs: the menu, a parent page, or related blog posts.", "Add a link to it from at least two relevant pages. Claude can suggest where.", "Run the audit again."] });
    var fewLinks = idx.filter(function (p) { return p.type === "Post" && (p.linksContent || []).filter(function (u) { return norm(u) !== norm(p.link); }).length < 3; }).map(function (p) { return pageRef(p, (p.linksContent || []).length + " links in the article"); });
    if (fewLinks.length) add({ id: "auto-posts-few-links", priority: "medium", category: "Structure", issue: fewLinks.length + " blog posts link to fewer than 3 other pages", pages: fewLinks,
      why: "Links from posts to your service pages pass ranking strength to the pages that win leads, and help readers take the next step.", steps: ["Ask Claude for a batch of internal link suggestions.", "Add 3 to 5 links per post to the most relevant service and partner pages.", "Run the audit again."] });

    /* Page structure */
    var noH1 = idx.filter(function (p) { return !(p.h1 || []).length; }).map(function (p) { return pageRef(p); });
    if (noH1.length) add({ id: "auto-h1-missing", priority: "high", category: "Structure", issue: noH1.length + " pages have no H1 heading", pages: noH1,
      why: "The H1 is the main heading that tells search engines and AI tools what the page is about.", steps: ["Open each page in Elementor.", "Set the main heading widget's HTML tag to H1 (Heading widget, then Content, then HTML Tag).", "Run the audit again."] });
    var multiH1 = idx.filter(function (p) { return (p.h1 || []).length > 1; }).map(function (p) { return pageRef(p, p.h1.length + " H1s: " + p.h1.slice(0, 3).join(" / ")); });
    if (multiH1.length) add({ id: "auto-h1-multiple", priority: "medium", category: "Structure", issue: multiH1.length + " pages have more than one H1", pages: multiH1,
      why: "One clear main heading per page is easiest for search engines to read. Extra H1s blur what the page is about.", steps: ["Open each page in Elementor.", "Keep one main heading as H1 and change the others to H2.", "Run the audit again."] });
    var canon = idx.filter(function (p) { return p.canonical && norm(p.canonical) !== norm(p.link); }).map(function (p) { return pageRef(p, "canonical says " + shortPath(p.canonical)); });
    if (canon.length) add({ id: "auto-canonical", priority: "high", category: "Indexing", issue: canon.length + " pages tell Google a different address is the real one", pages: canon,
      why: "A canonical pointing elsewhere tells Google to ignore this page and rank the other address instead.", steps: ["Open each page, then Rank Math, then Advanced.", "Clear the Canonical URL box (or set it to the page's own address).", "Save and run the audit again."] });
    idx.concat(pages.filter(function (p) { return p.live && p.noindex; })).filter(function (p) { return p.noindex; }).forEach(function (p) {
      add({ id: "auto-noindex-" + norm(p.link).replace(/\W+/g, "-"), priority: "high", category: "Indexing", pageTitle: p.title, link: p.link, issue: "Set to noindex, so it won't appear in Google",
        why: "If this is deliberate, choose 'Not doing this' and it won't come back. If not, the page is invisible in search.", steps: ["Open the page, then Rank Math, then Advanced.", "Untick No Index.", "Save and run the audit again."] });
    });
    function dupes(field, label, pri) {
      var groups = {};
      idx.forEach(function (p) { var v = (p[field] || "").trim().toLowerCase(); if (v) (groups[v] = groups[v] || []).push(p); });
      Object.keys(groups).forEach(function (v) {
        var g = groups[v]; if (g.length < 2) return;
        add({ id: "auto-dupe-" + field + "-" + v.replace(/\W+/g, "-").slice(0, 60), priority: pri, category: "Content", issue: g.length + " pages share the same " + label, pages: g.map(function (p) { return pageRef(p); }),
          why: "When pages share a " + label + ", Google can't tell them apart and may show the wrong one, or neither. The shared text is: " + g[0][field], steps: ["Give each page listed its own " + label + " describing what's different about it. Claude can write these in the next batch.", "Run the audit again."] });
      });
    }
    dupes("metaTitle", "title", "high"); dupes("metaDesc", "meta description", "medium");
    var pairs = [];
    for (var i = 0; i < idx.length; i++) for (var j = i + 1; j < idx.length; j++) {
      var a = idx[i], b = idx[j];
      if (overlap(titleWords(a.title), titleWords(b.title)) >= 0.75 && titleWords(a.title).length >= 2) pairs.push([a, b]);
    }
    pairs.slice(0, 15).forEach(function (pr) {
      add({ id: "auto-cannibal-" + (norm(pr[0].link) + "-" + norm(pr[1].link)).replace(/\W+/g, "-").slice(0, 90), priority: "medium", category: "Content", pageTitle: pr[0].title, link: pr[0].link,
        issue: "May compete with \"" + pr[1].title + "\" for the same searches", pages: [pageRef(pr[0]), pageRef(pr[1])],
        why: "Two pages chasing the same search split the ranking between them, so often neither makes page one. If they really cover different things, choose 'Not doing this'.", steps: ["Decide which page should rank for this topic.", "Either merge the other into it and redirect the old address (Rank Math, then Redirections, 301), or rewrite one so it targets a clearly different search.", "Tell Claude which, and it can write the changes."] });
    });

    /* Content and AEO */
    var thin = idx.filter(function (p) { return p.words < 300 && !/contact|get-started|news/.test(p.link); }).map(function (p) { return pageRef(p, p.words + " words"); });
    if (thin.length) add({ id: "auto-thin", priority: "high", category: "Content", issue: thin.length + " pages have under 300 words", pages: thin,
      why: "Thin pages rarely rank and give AI tools little to quote. Service and sector pages need enough detail to answer what a buyer would ask.", steps: ["Ask Claude to write fuller versions (they arrive in the Fix queue as drafts).", "Paste the approved copy into Elementor, or ask Matt to.", "Run the audit again."] });
    var noSchema = idx.filter(function (p) { return !(p.schema || []).length; }).map(function (p) { return pageRef(p); });
    if (noSchema.length) add({ id: "auto-schema-none", priority: "medium", category: "AI search", issue: noSchema.length + " pages have no structured data", pages: noSchema,
      why: "Structured data (schema) labels the page for search engines and AI tools: what it is, who wrote it, what it offers. Rank Math adds it per page.", steps: ["Open each page, then Rank Math, then Schema.", "Pick a type: Article for blog posts, Service for service pages, WebPage for the rest.", "Save and run the audit again."] });
    var postsNoArticle = idx.filter(function (p) { return p.type === "Post" && (p.schema || []).length && !(p.schema || []).some(function (t) { return /Article|BlogPosting/.test(t); }); }).map(function (p) { return pageRef(p); });
    if (postsNoArticle.length) add({ id: "auto-schema-article", priority: "medium", category: "AI search", issue: postsNoArticle.length + " blog posts aren't marked up as articles", pages: postsNoArticle,
      why: "Article schema tells Google and AI tools it's an article, who wrote it and when. That feeds Top Stories, AI answers and the 'last updated' date people see.", steps: ["Rank Math, then Titles & Meta, then Posts: set Schema Type to Article (BlogPosting).", "For existing posts, open each one, then Rank Math, then Schema, and switch to Article.", "Run the audit again."] });
    var noOg = idx.filter(function (p) { return !p.ogImage; }).map(function (p) { return pageRef(p); });
    if (noOg.length) add({ id: "auto-og-image", priority: "low", category: "Content", issue: noOg.length + " pages have no social sharing image", pages: noOg,
      why: "When someone shares the page on LinkedIn, Teams or WhatsApp, it shows a blank box instead of an image. Fewer clicks.", steps: ["Rank Math, then Titles & Meta, then Global Meta: set a default OpenGraph image (your logo on brand colours works).", "For key pages, set their own image in Rank Math, then Social.", "Run the audit again."] });
    var noAlt = idx.filter(function (p) { return p.imagesNoAlt > 0; }).map(function (p) { return pageRef(p, p.imagesNoAlt + " of " + p.images + " images"); });
    if (noAlt.length) add({ id: "auto-alt", priority: "medium", category: "Content", issue: noAlt.length + " pages have images with no alt text", pages: noAlt,
      why: "Alt text is how Google Images, screen readers and AI tools understand a picture. Missing alt text also counts against accessibility, which public sector buyers check.", steps: ["Go to Media, then Library, open each image used on these pages and fill in Alt Text.", "Describe what the image shows in a short sentence. Claude can draft these if you send the image file names.", "Run the audit again."] });
    var slow = idx.filter(function (p) { return p.ms > 2000; }).map(function (p) { return pageRef(p, (p.ms / 1000).toFixed(1) + " seconds for the server to send it"); });
    if (slow.length) add({ id: "auto-slow", priority: slow.length > 10 ? "high" : "medium", category: "Structure", issue: slow.length + " pages take over 2 seconds to load from the server", pages: slow,
      why: "Speed affects rankings and whether people wait. This measures the server alone, before images and scripts, so real visitors wait longer.", steps: ["Check SiteGround caching is on for these pages (SG Optimizer, then Caching).", "Ask Matt to check for heavy plugins on these pages.", "Test them at pagespeed.web.dev and send Claude the results."] });
    var titleGap = idx.filter(function (p) { return (p.metaTitle || "").length > 60 && !claude["meta_title|" + norm(p.link)]; }).map(function (p) { return pageRef(p, p.metaTitle.length + " characters"); });
    if (titleGap.length) add({ id: "auto-titles-long", priority: "medium", category: "Content", issue: titleGap.length + " more pages have titles Google will cut off", pages: titleGap,
      why: "These aren't in a Claude batch yet. Google shows about 60 characters.", steps: ["Ask Claude for the next batch of titles, which will cover these.", "Or shorten them yourself in Rank Math, then Edit Snippet."] });
    var descGap = idx.filter(function (p) { var d = p.metaDesc || ""; return (d.length < 70 || d.length > 160) && !claude["meta_description|" + norm(p.link)]; }).map(function (p) { return pageRef(p, (p.metaDesc || "").length + " characters"); });
    if (descGap.length) add({ id: "auto-desc-gap", priority: "medium", category: "Content", issue: descGap.length + " more pages have descriptions that are missing, too short or too long", pages: descGap,
      why: "These aren't in a Claude batch yet.", steps: ["Ask Claude for the next batch of descriptions, which will cover these.", "Or write them yourself in Rank Math, then Edit Snippet."] });
    return out;
  }

  /* Save auto fixes; reopen ones marked done that the audit still finds. */
  function storeAutoFixes(list, auditTime) {
    var s = fixState(), changed = false;
    list.forEach(function (f) {
      var st = s[f.id];
      if (st && st.status === "done" && st.doneTs && st.doneTs < auditTime) { delete st.status; st.reopened = true; changed = true; }
    });
    if (changed) save("fix-state", s);
    save("auto-fixes", list);
  }

  /* ---------- Search performance (Search Console and Analytics via Rank Math) ---------- */
  function perfData() { return load("search-perf", null); }
  function gscUrl(page, home) { return /^https?:/.test(page) ? page : String(home || "https://westpiertech.com/").replace(/\/$/, "") + "/" + String(page || "").replace(/^\//, ""); }
  function perfByPage() {
    var d = perfData(), out = {};
    if (!d || !d.pages) return out;
    var prev = {}; (d.pages_prev || []).forEach(function (r) { prev[norm(gscUrl(r.page, d.home))] = r; });
    var ga = {}; (d.ga || []).forEach(function (r) { ga[norm(gscUrl(r.page, d.home))] = r; });
    d.pages.forEach(function (r) {
      var k = norm(gscUrl(r.page, d.home));
      out[k] = { clicks: +r.clicks || 0, impressions: +r.impressions || 0, position: +r.position || 0, prevClicks: prev[k] ? +prev[k].clicks || 0 : 0, pageviews: ga[k] ? +ga[k].pageviews || 0 : null };
    });
    return out;
  }
  function perfLine(link) {
    var d = perfData(); if (!d || !d.pages) return "";
    var r = perfByPage()[norm(link)];
    if (!r) return '<p class="mono muted" style="font-size:.78rem">Google, last ' + d.days + " days: no impressions</p>";
    return '<p class="mono muted" style="font-size:.78rem">Google, last ' + d.days + " days: " + r.clicks + " clicks · " + r.impressions + " impressions · position " + r.position.toFixed(1) + "</p>";
  }
  function fetchPerf(days) {
    return wpFetch("/wpt-hub/v1/analytics?days=" + (days || 28)).then(function (d) {
      d.fetched = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      save("search-perf", d);
      save("auto-fixes-gsc", buildSearchFixes(d));
      updateNav();
      return d;
    });
  }
  function pctChange(now, before) {
    now = +now || 0; before = +before || 0;
    if (!before) return null;
    return (now - before) / before * 100;
  }
  function deltaChip(v, betterUp) {
    if (v == null || isNaN(v)) return "";
    var good = betterUp ? v >= 0 : v <= 0;
    return ' <span class="chip ' + (Math.abs(v) < 1 ? "" : good ? "good" : "bad") + '">' + (v > 0 ? "+" : "") + v.toFixed(Math.abs(v) < 10 ? 1 : 0) + (betterUp ? "%" : "") + "</span>";
  }

  /* One-series line chart: area fill, faint grid, emphasised end point, hover readout. */
  function lineChart(rows, label, fmt) {
    var W = 600, H = 170, L = 44, R = 12, T = 12, B = 26;
    var vals = rows.map(function (r) { return +r.v || 0; });
    var max = Math.max.apply(null, vals.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max))); var top = Math.ceil(max / step) * step; if (top / step > 5) step *= 2; top = Math.ceil(max / step) * step;
    var n = rows.length;
    function x(i) { return L + (n < 2 ? 0 : i * (W - L - R) / (n - 1)); }
    function y(v) { return T + (H - T - B) * (1 - v / top); }
    var pts = rows.map(function (r, i) { return x(i).toFixed(1) + "," + y(+r.v || 0).toFixed(1); });
    var grid = "", ticks = [];
    for (var g = 0; g <= top; g += step) ticks.push(g);
    ticks.forEach(function (g) { grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" class="cg"/><text x="' + (L - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end" class="ct">' + fmt(g) + "</text>"; });
    var xl = [0, Math.floor((n - 1) / 2), n - 1].filter(function (v, i, a) { return n && a.indexOf(v) === i; }).map(function (i) {
      return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '" class="ct">' + esc(shortDate(rows[i].d)) + "</text>";
    }).join("");
    var last = n ? '<circle cx="' + x(n - 1) + '" cy="' + y(vals[n - 1]) + '" r="4" class="cdot"/>' : "";
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + ' per day">' + grid +
      (n ? '<polygon points="' + L + "," + y(0) + " " + pts.join(" ") + " " + x(n - 1) + "," + y(0) + '" class="carea"/><polyline points="' + pts.join(" ") + '" class="cline"/>' : "") +
      last + xl + '<line class="cx" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/><circle class="chov" r="5" visibility="hidden"/>' +
      '<rect x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent" class="chit"/></svg>';
    var box = el('<figure class="chart"><figcaption><b>' + esc(label) + '</b> <span class="muted">per day</span></figcaption><div class="chart-svg">' + svg + '<div class="ctip" hidden></div></div></figure>');
    var s = box.querySelector("svg"), tip = box.querySelector(".ctip"), cx = box.querySelector(".cx"), dot = box.querySelector(".chov");
    function move(e) {
      if (!n) return;
      var r = s.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
      var i = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
      cx.setAttribute("x1", x(i)); cx.setAttribute("x2", x(i)); cx.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(vals[i])); dot.setAttribute("visibility", "visible");
      tip.hidden = false; tip.textContent = shortDate(rows[i].d) + ": " + fmt(vals[i]) + " " + label.toLowerCase();
      var left = x(i) / W * r.width; tip.style.left = Math.min(Math.max(left, 60), r.width - 60) + "px";
    }
    function leave() { tip.hidden = true; cx.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); }
    s.querySelector(".chit").addEventListener("mousemove", move);
    s.querySelector(".chit").addEventListener("mouseleave", leave);
    return box;
  }
  function shortDate(d) { var t = new Date(String(d).slice(0, 10) + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  function fmtNum(v) { v = +v || 0; return v >= 10000 ? (v / 1000).toFixed(0) + "k" : v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v)); }

  function renderPerformance(main) {
    var p = panel("Search performance", "Clicks and searches from Google Search Console, through Rank Math. Read-only.");
    var body = el('<div style="display:flex;flex-direction:column;gap:14px"></div>'); p.appendChild(body); main.appendChild(p);
    var days = load("perf-days", 28);
    function draw(d) {
      var a = wpAuth();
      if (!a || !a.ok) { body.innerHTML = '<div class="empty">Connect WordPress above to see search performance.</div>'; return; }
      var controls = '<div class="row"><label class="field" for="perf-days" style="flex-direction:row;align-items:center;gap:8px">Period<select id="perf-days">' +
        [7, 28, 90].map(function (n) { return '<option value="' + n + '"' + (n === days ? " selected" : "") + ">Last " + n + " days</option>"; }).join("") +
        '</select></label><button type="button" class="btn" id="perf-refresh">Refresh</button>' + (d && d.fetched ? '<span class="muted mono" style="font-size:.78rem">Updated ' + esc(d.fetched) + (d.from ? " · data " + esc(shortDate(d.from)) + " to " + esc(shortDate(d.to)) : "") + "</span>" : "") + "</div>";
      if (!d) { body.innerHTML = controls + '<div class="empty">No search data loaded yet. Click Refresh.</div>'; return wire(); }
      if (!d.tables || !d.tables.gsc) {
        body.innerHTML = controls + '<div class="notice"><b>Rank Math isn\'t connected to Google yet.</b> In WordPress go to Rank Math, then General Settings, then Analytics. Click Connect Google, sign in with the Google account that owns Search Console, pick westpiertech.com as the Search Console property and your GA4 property under Analytics, then Save. Rank Math imports the last 90 days, which can take an hour or two. Then click Refresh here.</div>';
        return wire();
      }
      if (!d.totals || !+d.totals.impressions) { body.innerHTML = controls + '<div class="notice info">Rank Math is connected but hasn\'t imported any Search Console data yet. Give it an hour or two, then click Refresh.</div>'; return wire(); }
      var t = d.totals, pv = d.prev || {};
      var ctr = +t.impressions ? t.clicks / t.impressions * 100 : 0, pctr = +pv.impressions ? pv.clicks / pv.impressions * 100 : 0;
      var gaTotal = d.ga ? d.ga.reduce(function (s, r) { return s + (+r.pageviews || 0); }, 0) : null;
      body.innerHTML = controls +
        '<div class="stats">' +
        '<div class="stat"><span class="n">' + fmtNum(t.clicks) + deltaChip(pctChange(t.clicks, pv.clicks), true) + '</span><span class="l">Clicks from Google</span></div>' +
        '<div class="stat"><span class="n">' + fmtNum(t.impressions) + deltaChip(pctChange(t.impressions, pv.impressions), true) + '</span><span class="l">Times you appeared in results</span></div>' +
        '<div class="stat"><span class="n">' + ctr.toFixed(1) + "%" + (pctr ? deltaChip(ctr - pctr, true).replace("%</span>", " pts</span>") : "") + '</span><span class="l">Click rate</span></div>' +
        '<div class="stat"><span class="n">' + (+t.position || 0).toFixed(1) + (pv.position ? deltaChip(t.position - pv.position, false) : "") + '</span><span class="l">Average position (lower is better)</span></div>' +
        (gaTotal != null ? '<div class="stat"><span class="n">' + fmtNum(gaTotal) + '</span><span class="l">Page views (Analytics)</span></div>' : "") +
        "</div>" + '<p class="muted" style="font-size:.8rem">Changes compare with the ' + d.days + " days before. Search Console data runs about 3 days behind.</p>" +
        '<div class="grid charts"></div><div class="grid tables"></div>';
      var charts = body.querySelector(".charts");
      charts.appendChild(lineChart((d.daily || []).map(function (r) { return { d: r.d, v: r.clicks }; }), "Clicks", fmtNum));
      charts.appendChild(lineChart((d.daily || []).map(function (r) { return { d: r.d, v: r.impressions }; }), "Impressions", fmtNum));
      if (d.ga_daily && d.ga_daily.length) charts.appendChild(lineChart(d.ga_daily.map(function (r) { return { d: r.d, v: r.pageviews }; }), "Page views", fmtNum));
      var by = perfByPage();
      var tables = body.querySelector(".tables");
      var pages = (d.pages || []).slice().sort(function (a, b) { return (+b.clicks || 0) - (+a.clicks || 0) || (+b.impressions || 0) - (+a.impressions || 0); }).slice(0, 15);
      tables.appendChild(el('<div><h3 style="margin-bottom:6px">Top pages</h3><div class="table-wrap"><table><thead><tr><th>Page</th><th class="num">Clicks</th><th class="num">Change</th><th class="num">Impr.</th><th class="num">Pos.</th></tr></thead><tbody>' +
        pages.map(function (r) {
          var u = gscUrl(r.page, d.home), x = by[norm(u)] || {}, ch = pctChange(r.clicks, x.prevClicks);
          return '<tr><td><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(shortPath(u)) + '</a></td><td class="num">' + (+r.clicks || 0) + '</td><td class="num">' + (ch == null ? "–" : (ch > 0 ? "+" : "") + ch.toFixed(0) + "%") + '</td><td class="num">' + (+r.impressions || 0) + '</td><td class="num">' + (+r.position || 0).toFixed(1) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>"));
      var q = {}; (d.queries || []).forEach(function (r) { var k = r.query; if (!q[k]) q[k] = { query: k, clicks: 0, impressions: 0, wpos: 0, page: r.page, best: 0 }; var o = q[k]; o.clicks += +r.clicks || 0; o.impressions += +r.impressions || 0; o.wpos += (+r.position || 0) * (+r.impressions || 0); if ((+r.impressions || 0) > o.best) { o.best = +r.impressions || 0; o.page = r.page; } });
      var qs = Object.keys(q).map(function (k) { var o = q[k]; o.position = o.impressions ? o.wpos / o.impressions : 0; return o; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, 20);
      tables.appendChild(el('<div><h3 style="margin-bottom:6px">Top searches</h3><div class="table-wrap"><table><thead><tr><th>Search</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">Pos.</th></tr></thead><tbody>' +
        qs.map(function (o) { return "<tr><td>" + esc(o.query) + '<div class="muted" style="font-size:.75rem">' + esc(shortPath(gscUrl(o.page, d.home))) + '</div></td><td class="num">' + o.clicks + '</td><td class="num">' + o.impressions + '</td><td class="num">' + o.position.toFixed(1) + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>"));
      var gscFixes = load("auto-fixes-gsc", []).length;
      body.appendChild(el('<div class="row"><button type="button" class="btn" id="perf-copy">Copy search data as CSV</button>' + (gscFixes ? '<a class="btn primary" href="#fixes">' + gscFixes + " search opportunities in the Fix queue</a>" : "") + "</div>"));
      body.querySelector("#perf-copy").addEventListener("click", function () {
        copyText(toCsv([{ k: "query", label: "Search" }, { label: "Page", compute: function (r) { return gscUrl(r.page, d.home); } }, { k: "clicks", label: "Clicks" }, { k: "impressions", label: "Impressions" }, { label: "Position", compute: function (r) { return (+r.position || 0).toFixed(1); } }], d.queries || []), "Search data copied");
      });
      wire();
    }
    function wire() {
      var sel = body.querySelector("#perf-days"), btn = body.querySelector("#perf-refresh");
      if (sel) sel.addEventListener("change", function () { days = +sel.value; save("perf-days", days); refresh(); });
      if (btn) btn.addEventListener("click", refresh);
    }
    function refresh() {
      var btn = body.querySelector("#perf-refresh"); if (btn) { btn.disabled = true; btn.textContent = "Loading…"; }
      fetchPerf(days).then(draw, function (err) {
        draw(perfData());
        var msg = /no route/i.test(err.message) ? "The page checker snippet needs updating to the latest version (docs/wordpress-page-checker.php) for search data." : err.message;
        body.insertBefore(el('<div class="notice"><b>Couldn\'t load search data.</b> ' + esc(msg) + "</div>"), body.firstChild);
      });
    }
    draw(perfData());
  }

  /* Search Console findings become Fix queue items. */
  function buildSearchFixes(d) {
    var out = []; if (!d || !d.queries || !d.pages) return out;
    var today = new Date().toISOString().slice(0, 10), home = d.home;
    function slug(u) { return norm(u).replace(/\W+/g, "-").slice(0, 80); }
    function add(o) { o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found in Search Console"; out.push(o); }
    var byPage = {};
    d.queries.forEach(function (r) { var u = gscUrl(r.page, home); (byPage[u] = byPage[u] || []).push(r); });
    Object.keys(byPage).forEach(function (u) {
      var near = byPage[u].filter(function (r) { var p = +r.position; return p >= 4 && p <= 20 && (+r.impressions || 0) >= 20; }).sort(function (a, b) { return b.impressions - a.impressions; });
      if (!near.length) return;
      var imp = near.reduce(function (s, r) { return s + (+r.impressions || 0); }, 0);
      add({ id: "gsc-near-" + slug(u), priority: imp >= 200 ? "high" : "medium", category: "Content", pageTitle: shortPath(u), link: u,
        issue: "Close to page one for " + near.length + " search" + (near.length > 1 ? "es" : "") + " (" + imp + " impressions in " + d.days + " days)",
        pages: near.slice(0, 8).map(function (r) { return { title: "\"" + r.query + "\"", link: u, note: "position " + (+r.position).toFixed(1) + ", " + r.impressions + " impressions, " + r.clicks + " clicks" }; }),
        why: "Google already thinks this page is relevant for these searches but ranks it on page one's lower half or page two, where hardly anyone clicks. Small improvements here often move it up and turn impressions into leads.",
        steps: ["Ask Claude to strengthen this page for the searches listed. It will write additions into the Fix queue.", "Make sure the main search phrase appears in the page title, the H1 and the first paragraph.", "Add a short FAQ answering the questions behind these searches.", "Link to this page from two or three related pages using the search phrase as the link text."] });
    });
    d.pages.forEach(function (r) {
      var u = gscUrl(r.page, home), imp = +r.impressions || 0, ctr = imp ? (+r.clicks || 0) / imp * 100 : 0, pos = +r.position || 0;
      if (imp >= 100 && pos <= 10 && ctr < 2) add({ id: "gsc-ctr-" + slug(u), priority: "high", category: "Content", pageTitle: shortPath(u), link: u,
        issue: "Seen " + imp + " times on page one but only " + ctr.toFixed(1) + "% click",
        why: "The page ranks well enough to be seen, but the title and description in the results aren't persuading people to click. That's usually the cheapest traffic win there is.",
        steps: ["Ask Claude to rewrite this page's title and description for the searches it's appearing for. They'll arrive as pushable fixes.", "Approve them, then check back here in 2 to 3 weeks."] });
    });
    var prev = {}; (d.pages_prev || []).forEach(function (r) { prev[norm(gscUrl(r.page, home))] = +r.clicks || 0; });
    d.pages.forEach(function (r) {
      var u = gscUrl(r.page, home), b = prev[norm(u)] || 0, c = +r.clicks || 0;
      if (b >= 10 && c < b * 0.6) add({ id: "gsc-drop-" + slug(u), priority: "high", category: "Content", pageTitle: shortPath(u), link: u,
        issue: "Clicks down from " + b + " to " + c + " compared with the " + d.days + " days before",
        why: "A sharp drop usually means a competitor overtook you, the page changed, or Google changed what it shows for the search. Worth catching early.",
        steps: ["Check the change log for recent edits to this page.", "Search the page's main phrases in Google (logged out) and see who now ranks above you.", "Send Claude the page and what you found. It will suggest what to change."] });
    });
    var byQ = {};
    d.queries.forEach(function (r) { (byQ[r.query] = byQ[r.query] || []).push(r); });
    Object.keys(byQ).forEach(function (qq) {
      var rows = byQ[qq], tot = rows.reduce(function (s, r) { return s + (+r.impressions || 0); }, 0);
      var big = rows.filter(function (r) { return tot && (+r.impressions || 0) / tot >= 0.15; });
      if (tot >= 30 && big.length >= 2) add({ id: "gsc-split-" + qq.replace(/\W+/g, "-").slice(0, 60), priority: "medium", category: "Content", pageTitle: "\"" + qq + "\"", link: gscUrl(big[0].page, home),
        issue: big.length + " of your pages compete for \"" + qq + "\"",
        pages: big.map(function (r) { return { title: shortPath(gscUrl(r.page, home)), link: gscUrl(r.page, home), note: "position " + (+r.position).toFixed(1) + ", " + r.impressions + " impressions" }; }),
        why: "Google keeps switching between these pages for the same search, so neither builds up a strong position.", steps: ["Decide which page should own this search.", "Make the other page link to it using the search phrase, and take the phrase out of its title.", "If the pages say the same thing, merge them and redirect the weaker one (Rank Math, then Redirections, 301)."] });
    });
    return out;
  }

  /* ---------- Google Analytics 4 (direct, via the WPT Hub GA4 snippet) ---------- */
  var AI_SOURCE = /chatgpt|openai|perplexity|copilot|gemini\.google|claude\.ai|you\.com|phind|deepseek|meta\.ai|mistral/i;
  function ga4Data() { return load("ga4", null); }
  function fetchGa4(days, fresh) {
    return wpFetch("/wpt-hub/v1/ga4?days=" + (days || 28) + (fresh ? "&fresh=1" : "")).then(function (d) {
      if (d && d.configured) { d.loaded = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); save("ga4", d); save("auto-fixes-ga4", buildGa4Fixes(d)); }
      else { save("ga4", d); save("auto-fixes-ga4", []); }
      updateNav(); return d;
    });
  }
  function gaDate(s) { s = String(s || ""); return s.length === 8 ? s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6) : s; }

  function buildGa4Fixes(d) {
    var out = []; if (!d || !d.configured) return out;
    var today = new Date().toISOString().slice(0, 10), home = "https://westpiertech.com";
    function add(o) { o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found in Google Analytics"; out.push(o); }
    var leads = +(d.totals || {}).keyEvents || 0;
    var anyKey = (d.events || []).some(function (e) { return +e.keyEvents > 0; });
    var formEvents = (d.events || []).filter(function (e) { return /form|lead|submit|contact|enquir|call|phone|thank/i.test(e.eventName); });
    if (!leads && !anyKey) add({ id: "ga4-no-leads", priority: "critical", category: "Leads", pageTitle: "Google Analytics", link: home + "/",
      issue: "GA4 isn't counting any leads",
      pages: formEvents.map(function (e) { return { title: e.eventName, link: home + "/", note: e.eventCount + " times in " + d.days + " days, not marked as a key event" }; }),
      why: "Without key events, GA4 can't tell you which pages, searches or channels produce enquiries, so there's no way to prove what marketing brings in. This is the single most important thing to set up.",
      steps: formEvents.length ? ["In GA4 go to Admin, then Data display, then Events.", "Find the event(s) listed here and switch on 'Mark as key event'.", "Key events count from that moment on. Check back here in a few days."]
        : ["Ask Matt how enquiry forms are built (WPForms is installed).", "Easiest route: send each form to a thank-you page, then in GA4 Admin, Events, create an event when page_location contains /thank-you/ and mark it as a key event.", "Also mark clicks on the phone number as a key event if calls matter.", "Tell Claude once it's set up and the hub will start showing leads by page and channel."] });
    (d.organic_landing || []).forEach(function (r) {
      var path = r.landingPage || ""; if (!path || path === "(not set)" || +r.sessions < 30 || +r.keyEvents > 0 || !leads) return;
      add({ id: "ga4-organic-noleads-" + path.replace(/\W+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70), priority: "medium", category: "Leads", pageTitle: path, link: home + path,
        issue: "Brings in " + r.sessions + " visits from Google but no enquiries",
        why: "Search is doing its job getting people here, but the page isn't turning them into leads. Usually it's a missing or weak next step: no clear call to action, no phone number near the top, or a form buried at the bottom.",
        steps: ["Open the page and check there's a clear call to action in the first screen, the phone number is visible, and the form or contact button appears more than once.", "Ask Claude for a call-to-action block written for this page.", "Check back here after a month."] });
    });
    (d.landing || []).forEach(function (r) {
      var path = r.landingPage || ""; if (!path || path === "(not set)" || +r.sessions < 50 || +r.engagementRate >= 0.35) return;
      add({ id: "ga4-bounce-" + path.replace(/\W+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70), priority: "medium", category: "Content", pageTitle: path, link: home + path,
        issue: Math.round(r.engagementRate * 100) + "% of " + r.sessions + " visits actually engage with the page",
        why: "Most visitors leave within seconds without scrolling or clicking. The page either loads slowly, doesn't match what they searched for, or doesn't show quickly that they're in the right place.",
        steps: ["Check the page's speed at pagespeed.web.dev.", "Look at Search performance for the searches bringing people here, and make sure the first screen speaks to them directly.", "Ask Claude to rewrite the opening of the page."] });
    });
    return out;
  }

  function renderGa4(main) {
    var p = panel("Website traffic and leads", "Straight from Google Analytics 4. Read-only.");
    var body = el('<div style="display:flex;flex-direction:column;gap:14px"></div>'); p.appendChild(body); main.appendChild(p);
    var days = load("perf-days", 28);
    function setupForm(msg) {
      body.innerHTML = (msg || "") + '<div class="notice info"><b>One-off setup, about 15 minutes.</b> You create a read-only robot login for Google Analytics, then upload its key here. The key goes straight to your WordPress and never into chat or GitHub.</div>' +
        '<ol class="steps-list" style="font-size:.9rem">' +
        "<li>Go to <b>console.cloud.google.com</b>, signed in with the Google account that owns GA4. Create a project called <b>WPT Hub</b>.</li>" +
        "<li>In that project: <b>APIs &amp; Services, then Library</b>. Search <b>Google Analytics Data API</b> and click <b>Enable</b>.</li>" +
        "<li><b>IAM &amp; Admin, then Service Accounts, then Create service account</b>. Name it <b>wpt-hub</b>, skip the optional steps, click <b>Done</b>.</li>" +
        "<li>Open the new account, go to <b>Keys, then Add key, then Create new key, then JSON</b>. A file downloads. Keep it safe and don't email it. If Google says key creation is disabled, Matt needs to allow it for this project.</li>" +
        "<li>Copy the account's email (ends in <b>iam.gserviceaccount.com</b>). In GA4 go to <b>Admin, then Property access management, then +</b>, paste the email, choose <b>Viewer</b> and Add.</li>" +
        "<li>In GA4 <b>Admin, then Property details</b>, copy the <b>Property ID</b> (a number).</li>" +
        "<li>Add the <b>WPT Hub GA4</b> snippet from docs/wordpress-ga4.php, same way as the others.</li>" +
        "<li>Fill in the two boxes below and click <b>Connect</b>. Then delete the downloaded key file from your computer.</li></ol>" +
        '<div class="form-grid"><label class="field" for="ga4-prop">GA4 property ID<input id="ga4-prop" inputmode="numeric" placeholder="123456789"></label>' +
        '<label class="field" for="ga4-key">Key file (.json)<input id="ga4-key" type="file" accept=".json,application/json"></label></div>' +
        '<div class="row"><button type="button" class="btn primary" id="ga4-connect">Connect</button></div><div id="ga4-msg"></div>';
      body.querySelector("#ga4-connect").addEventListener("click", function () {
        var prop = body.querySelector("#ga4-prop").value.trim(), f = body.querySelector("#ga4-key").files[0], m = body.querySelector("#ga4-msg");
        if (!prop || !f) { m.innerHTML = '<div class="notice">Add the property ID and choose the key file first.</div>'; return; }
        var btn = body.querySelector("#ga4-connect"); btn.disabled = true; btn.textContent = "Connecting…";
        var r = new FileReader();
        r.onload = function () {
          wpFetch("/wpt-hub/v1/ga4-setup", { method: "POST", body: { property: prop, key: String(r.result) } }).then(function (res) {
            toast("Connected. " + res.sessions_last_7_days + " sessions in the last 7 days");
            return fetchGa4(days, true).then(draw);
          }).catch(function (err) {
            btn.disabled = false; btn.textContent = "Connect";
            var msg = /no route/i.test(err.message) ? "Add the WPT Hub GA4 snippet (docs/wordpress-ga4.php) to WordPress first." : err.message;
            m.innerHTML = '<div class="notice"><b>Not connected.</b> ' + esc(msg) + "</div>";
          });
        };
        r.readAsText(f);
      });
    }
    function draw(d) {
      var a = wpAuth();
      if (!a || !a.ok) { body.innerHTML = '<div class="empty">Connect WordPress above first.</div>'; return; }
      if (!d) { body.innerHTML = '<div class="row"><button type="button" class="btn" id="ga4-load">Load Google Analytics</button></div>'; body.querySelector("#ga4-load").addEventListener("click", refresh); return; }
      if (!d.configured) return setupForm();
      var t = d.totals || {}, pv = d.prev || {};
      var aiRows = (d.sources || []).filter(function (r) { return AI_SOURCE.test(r.sessionSource); });
      var aiSessions = aiRows.reduce(function (s, r) { return s + (+r.sessions || 0); }, 0);
      body.innerHTML = '<div class="row"><span class="muted mono" style="font-size:.78rem">GA4 property ' + esc(d.property) + " · last " + d.days + " days · loaded " + esc(d.loaded || "") + '</span><button type="button" class="btn small" id="ga4-refresh">Refresh</button><button type="button" class="btn small danger" id="ga4-off">Disconnect</button></div>' +
        '<div class="stats">' +
        '<div class="stat' + (+t.keyEvents ? "" : " flag") + '"><span class="n">' + fmtNum(t.keyEvents) + deltaChip(pctChange(t.keyEvents, pv.keyEvents), true) + '</span><span class="l">Leads (key events)</span></div>' +
        '<div class="stat"><span class="n">' + fmtNum(t.sessions) + deltaChip(pctChange(t.sessions, pv.sessions), true) + '</span><span class="l">Visits</span></div>' +
        '<div class="stat"><span class="n">' + fmtNum(t.totalUsers) + deltaChip(pctChange(t.totalUsers, pv.totalUsers), true) + '</span><span class="l">People</span></div>' +
        '<div class="stat"><span class="n">' + Math.round((+t.engagementRate || 0) * 100) + '%</span><span class="l">Visits that engage</span></div>' +
        '<div class="stat"><span class="n">' + fmtNum(aiSessions) + '</span><span class="l">Visits from AI tools</span></div></div>' +
        '<div class="grid charts"></div><div class="grid tables"></div>';
      var charts = body.querySelector(".charts");
      charts.appendChild(lineChart((d.daily || []).map(function (r) { return { d: gaDate(r.date), v: r.sessions }; }), "Visits", fmtNum));
      charts.appendChild(lineChart((d.daily || []).map(function (r) { return { d: gaDate(r.date), v: r.keyEvents }; }), "Leads", fmtNum));
      var tables = body.querySelector(".tables");
      function tbl(title, head, rows) { return el('<div><h3 style="margin-bottom:6px">' + esc(title) + '</h3><div class="table-wrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + (rows || '<tr><td colspan="4" class="muted">Nothing yet.</td></tr>') + "</tbody></table></div></div>"); }
      tables.appendChild(tbl("Where visits come from", '<th>Channel</th><th class="num">Visits</th><th class="num">Leads</th><th class="num">Lead rate</th>',
        (d.channels || []).slice().sort(function (x, y) { return y.sessions - x.sessions; }).map(function (r) { return "<tr><td>" + esc(r.sessionDefaultChannelGroup) + '</td><td class="num">' + r.sessions + '</td><td class="num">' + r.keyEvents + '</td><td class="num">' + (r.sessions ? (r.keyEvents / r.sessions * 100).toFixed(1) + "%" : "–") + "</td></tr>"; }).join("")));
      tables.appendChild(tbl("Pages people land on", '<th>Page</th><th class="num">Visits</th><th class="num">Leads</th><th class="num">Engage</th>',
        (d.landing || []).slice(0, 15).map(function (r) { return '<tr><td><a href="https://westpiertech.com' + esc(r.landingPage) + '" target="_blank" rel="noopener">' + esc(r.landingPage) + '</a></td><td class="num">' + r.sessions + '</td><td class="num">' + r.keyEvents + '</td><td class="num">' + Math.round(r.engagementRate * 100) + "%</td></tr>"; }).join("")));
      tables.appendChild(tbl("Visits from AI tools", '<th>Source</th><th class="num">Visits</th><th class="num">Leads</th>',
        aiRows.map(function (r) { return "<tr><td>" + esc(r.sessionSource) + '</td><td class="num">' + r.sessions + '</td><td class="num">' + r.keyEvents + "</td></tr>"; }).join("")));
      var evs = (d.events || []).filter(function (e) { return +e.keyEvents > 0; });
      tables.appendChild(tbl("What counts as a lead", '<th>Key event</th><th class="num">Count</th>',
        evs.map(function (e) { return "<tr><td>" + esc(e.eventName) + '</td><td class="num">' + e.keyEvents + "</td></tr>"; }).join("")));
      var n = load("auto-fixes-ga4", []).length;
      if (n) body.appendChild(el('<div class="row"><a class="btn primary" href="#fixes">' + n + " Analytics findings in the Fix queue</a></div>"));
      body.querySelector("#ga4-refresh").addEventListener("click", function () { refresh(true); });
      body.querySelector("#ga4-off").addEventListener("click", function (e) {
        var b = e.target; if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to disconnect"; return; }
        wpFetch("/wpt-hub/v1/ga4-setup", { method: "DELETE" }).then(function () { save("ga4", { configured: false }); save("auto-fixes-ga4", []); toast("Disconnected. Delete the key in Google Cloud too."); setupForm(); updateNav(); })
          .catch(function (err) { toast(err.message); });
      });
    }
    function refresh(fresh) {
      body.insertBefore(el('<div class="notice info">Loading from Google Analytics…</div>'), body.firstChild);
      fetchGa4(days, fresh === true).then(draw, function (err) {
        if (/no route/i.test(err.message)) return setupForm();
        draw(ga4Data()); body.insertBefore(el('<div class="notice"><b>Couldn\'t load Google Analytics.</b> ' + esc(err.message) + "</div>"), body.firstChild);
      });
    }
    draw(ga4Data());
  }

  /* ---------- Mobile and speed (Google PageSpeed Insights, mobile strategy) ----------
     Built against the v5 API reference and Lighthouse 13: audits are read by what Google
     returns rather than a fixed old list, and real-visitor (CrUX) data is optional. */
  var PSI_URL = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
  var PSI_SKIP = /^(metrics|screenshot-thumbnails|final-screenshot|main-thread-tasks|network-requests|network-rtt|network-server-latency|diagnostics|script-treemap-data|resource-summary|largest-contentful-paint|first-contentful-paint|speed-index|total-blocking-time|cumulative-layout-shift|interactive|max-potential-fid|first-meaningful-paint)$/;
  function psiKey() { return load("psi-key", ""); }
  function psiData() { return load("psi", null); }
  function runPsi(url) {
    var q = "?url=" + encodeURIComponent(url) + "&strategy=MOBILE&category=PERFORMANCE&category=ACCESSIBILITY&category=SEO&category=BEST_PRACTICES" + (psiKey() ? "&key=" + encodeURIComponent(psiKey()) : "");
    return fetch(PSI_URL + q).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = (j.error && j.error.message) || ("Google answered " + r.status);
          if (r.status === 429) m = "Google's limit for checks without a key has been reached. Add a free API key (steps above) and run it again.";
          throw new Error(m);
        }
        return summarisePsi(j);
      });
    });
  }
  function summarisePsi(j) {
    var lr = j.lighthouseResult || {}, cats = lr.categories || {}, audits = lr.audits || {};
    function sc(c) { return cats[c] && cats[c].score != null ? Math.round(cats[c].score * 100) : null; }
    function num(id) { return audits[id] && audits[id].numericValue != null ? audits[id].numericValue : null; }
    var fails = [];
    Object.keys(audits).forEach(function (id) {
      var a = audits[id];
      if (PSI_SKIP.test(id) || a.score == null || a.score >= 0.9) return;
      if (!/^(binary|numeric|metricSavings)$/.test(a.scoreDisplayMode || "")) return;
      var items = ((a.details && a.details.items) || []).slice(0, 8).map(function (it) {
        var u = it.url || (it.node && it.node.snippet) || it.source || "";
        if (typeof u === "object") u = u.url || "";
        return { url: String(u).slice(0, 300), wasted: it.wastedBytes || 0, displayed: it.displayedAspectRatio || "", actual: it.actualAspectRatio || "" };
      });
      fails.push({ id: id, title: a.title || id, display: a.displayValue || "", score: a.score, items: items });
    });
    var le = j.loadingExperience || null, field = null;
    if (le && le.metrics && !le.origin_fallback) {
      var mt = le.metrics;
      function p(k) { return mt[k] ? { p75: mt[k].percentile, cat: mt[k].category } : null; }
      field = { overall: le.overall_category || "", lcp: p("LARGEST_CONTENTFUL_PAINT_MS"), cls: p("CUMULATIVE_LAYOUT_SHIFT_SCORE"), inp: p("INTERACTION_TO_NEXT_PAINT") };
    }
    return { perf: sc("performance"), a11y: sc("accessibility"), seo: sc("seo"), bp: sc("best-practices"),
      lcp: num("largest-contentful-paint"), cls: num("cumulative-layout-shift"), tbt: num("total-blocking-time"),
      fails: fails, field: field, version: lr.lighthouseVersion || "", when: new Date().toISOString() };
  }
  function failOf(r, id) { return (r.fails || []).filter(function (f) { return f.id === id; })[0]; }
  function fileName(u) { return String(u || "").split("?")[0].split("/").pop() || u; }

  function buildMobileFixes(d) {
    var out = []; if (!d || !d.pages) return out;
    var today = new Date().toISOString().slice(0, 10);
    var rows = Object.keys(d.pages).map(function (u) { return { url: u, r: d.pages[u] }; }).filter(function (x) { return x.r && !x.r.error; });
    function add(o) { o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found by mobile check"; o.category = "Mobile"; o.pageTitle = o.pageTitle || "Mobile"; o.link = o.link || "https://westpiertech.com/"; out.push(o); }
    function pagesWith(fn) { return rows.filter(function (x) { return fn(x.r); }).map(function (x) { return { title: shortPath(x.url), link: x.url, note: fn(x.r) === true ? "" : String(fn(x.r)) }; }); }
    var squash = [];
    rows.forEach(function (x) { var f = failOf(x.r, "image-aspect-ratio"); if (f) f.items.forEach(function (it) { squash.push({ title: fileName(it.url), link: x.url, note: "on " + shortPath(x.url) + (it.displayed ? " · shown " + it.displayed + ", really " + it.actual : "") }); }); });
    if (squash.length) add({ id: "mob-squashed", priority: "high", issue: squash.length + " images are squashed or stretched", pages: squash,
      why: "An image forced into the wrong shape looks broken, especially on a phone, and Google counts it against the page's quality. It's often the first thing a visitor sees.",
      steps: ["Open the page in Elementor and click the image listed.", "Go to the Style tab. Set Height to Default (or auto), or keep the height and set Object Fit to Cover so it crops instead of squashing.", "Check it in Elementor's mobile view (the phone icon at the bottom left) before you update.", "Run the mobile check again."] });
    var vp = pagesWith(function (r) { return !!failOf(r, "viewport-insight") || !!failOf(r, "viewport"); });
    if (vp.length) add({ id: "mob-viewport", priority: "critical", issue: vp.length + " pages aren't set up for phones (viewport)", pages: vp,
      why: "Without the mobile viewport setting, phones show a shrunk desktop page. Google treats that as not mobile-friendly.", steps: ["Ask Matt to check the theme (Blocksy) outputs the viewport meta tag on these pages.", "Run the mobile check again."] });
    var cwv = pagesWith(function (r) { if (!r.field) return false; var bad = []; ["lcp", "cls", "inp"].forEach(function (k) { if (r.field[k] && r.field[k].cat && r.field[k].cat !== "FAST") bad.push(k.toUpperCase() + " " + r.field[k].cat.toLowerCase()); }); return bad.length ? "real visitors: " + bad.join(", ") : false; });
    if (cwv.length) add({ id: "mob-cwv-field", priority: "high", issue: cwv.length + " pages fail Core Web Vitals for real mobile visitors", pages: cwv,
      why: "This is Google's measure from real Chrome users over the last 28 days, and it's what feeds rankings. LCP is how fast the main content shows (good under 2.5 s), CLS is how much the page jumps about (good under 0.1), INP is how quickly it responds to taps (good under 200 ms).",
      steps: ["Start with the fixes below for slow pages, layout shifts and heavy images. They are usually the cause.", "Real-visitor figures update daily but cover 28 days, so give changes a few weeks to show."] });
    var slow = pagesWith(function (r) { return r.perf != null && r.perf < 50 ? "mobile score " + r.perf + "/100, main content after " + (r.lcp ? (r.lcp / 1000).toFixed(1) + " s" : "?") : false; });
    if (slow.length) add({ id: "mob-slow", priority: "high", issue: slow.length + " pages score under 50 for mobile speed", pages: slow,
      why: "Google's test phone is a mid-range handset on a mobile connection. Under 50 means most visitors on phones wait several seconds, and many leave before the page loads.",
      steps: ["Check SiteGround Optimizer has caching, CSS and JS minifying and lazy loading switched on.", "Fix the heavy images listed in the image fix in this queue.", "Ask Matt whether any plugins load on every page that don't need to (chat widgets, sliders, extra fonts).", "Run the mobile check again."] });
    var shift = pagesWith(function (r) { return r.cls != null && r.cls > 0.1 ? "layout shift " + r.cls.toFixed(2) : false; });
    if (shift.length) add({ id: "mob-cls", priority: shift.some(function (p) { return parseFloat(p.note.split(" ").pop()) > 0.25; }) ? "high" : "medium", issue: shift.length + " pages jump about while loading", pages: shift,
      why: "When images or banners load late and push the text down, people tap the wrong thing. Google measures it as CLS and wants it under 0.1.",
      steps: ["Look for images without a set width and height, and banners or cookie bars that appear after the page loads.", "In Elementor, give images a fixed size (or aspect ratio) so space is reserved before they load.", "Run the mobile check again."] });
    var heavy = [];
    rows.forEach(function (x) { var f = failOf(x.r, "image-delivery-insight"); if (f) f.items.forEach(function (it) { if (it.wasted > 50000) heavy.push({ title: fileName(it.url), link: x.url, note: "could save " + Math.round(it.wasted / 1024) + " KB on " + shortPath(x.url) }); }); });
    if (heavy.length) add({ id: "mob-images", priority: heavy.length > 15 ? "high" : "medium", issue: heavy.length + " images are much bigger than they need to be", pages: heavy.slice(0, 60),
      why: "Oversized images are the most common reason pages load slowly on phones. The figures are what Google says each image could save.",
      steps: ["Turn on image optimisation and WebP in SiteGround Optimizer (Media).", "For the biggest ones, resize to the size actually shown (usually under 1600 px wide) before uploading.", "Run the mobile check again."] });
    var tap = pagesWith(function (r) { return failOf(r, "target-size") ? "buttons or links too small or close together" : false; });
    if (tap.length) add({ id: "mob-tap", priority: "medium", issue: tap.length + " pages have buttons or links too small to tap easily", pages: tap,
      why: "On a phone, small or crowded links mean people tap the wrong thing. It also counts against accessibility, which public sector buyers check.", steps: ["Open each page in Elementor's mobile view.", "Give buttons and menu links more padding (at least 24 px tall) and space between them.", "Run the mobile check again."] });
    var con = pagesWith(function (r) { return failOf(r, "color-contrast") ? "text hard to read against its background" : false; });
    if (con.length) add({ id: "mob-contrast", priority: "medium", issue: con.length + " pages have text that's hard to read", pages: con,
      why: "Low-contrast text is hard to read outdoors on a phone and fails accessibility standards public sector buyers look for.", steps: ["Open Google's full report for each page (link in the mobile check table) to see which text.", "Darken the text or lighten the background in Elementor.", "Run the mobile check again."] });
    var acc = pagesWith(function (r) { return r.a11y != null && r.a11y < 90 ? "accessibility " + r.a11y + "/100" : false; });
    if (acc.length) add({ id: "mob-a11y", priority: "medium", issue: acc.length + " pages score under 90 for accessibility", pages: acc,
      why: "Public sector websites and buyers expect accessible suppliers, and AI tools read accessible pages more reliably.", steps: ["Open Google's full report for each page (link in the mobile check table) and work through the Accessibility section.", "Most fixes are alt text, contrast and labels on forms and buttons."] });
    return out;
  }

  function renderMobile(main) {
    var p = panel("Mobile and speed", "Google's own mobile test (PageSpeed Insights) on every live page. Read-only.");
    var body = el('<div style="display:flex;flex-direction:column;gap:12px"></div>'); p.appendChild(body); main.appendChild(p);
    var stop = false;
    function draw() {
      var d = psiData();
      body.innerHTML =
        '<details' + (psiKey() ? "" : " open") + '><summary class="muted" style="cursor:pointer;font-size:.88rem">API key (free, recommended for checking every page)' + (psiKey() ? " · saved" : "") + "</summary>" +
        '<ol class="steps-list" style="font-size:.88rem;margin-top:8px"><li>In Google Cloud, open your <b>WPT Hub</b> project.</li><li><b>APIs &amp; Services, then Library</b>. Search <b>PageSpeed Insights API</b> and click <b>Enable</b>.</li><li><b>APIs &amp; Services, then Credentials, then Create credentials, then API key</b>. Copy it.</li><li>Click the new key, then under <b>API restrictions</b> choose <b>Restrict key</b> and tick only <b>PageSpeed Insights API</b>. Save.</li><li>Paste it below. It stays in this browser.</li></ol>' +
        '<div class="row" style="margin-top:8px"><label class="field" for="psi-key" style="flex:1;min-width:220px">PageSpeed API key<input id="psi-key" type="password" autocomplete="off" placeholder="' + (psiKey() ? "Saved. Paste a new one to replace it." : "AIza…") + '"></label><button type="button" class="btn" id="psi-save" style="align-self:flex-end">Save key</button></div></details>' +
        '<div class="row"><button type="button" class="btn primary" id="psi-run">Run mobile check on all pages</button><button type="button" class="btn" id="psi-stop" hidden>Stop</button>' +
        '<span class="muted" style="font-size:.82rem">About 15 to 30 seconds a page, two at a time. Uses the pages from your last audit.</span></div><div id="psi-status"></div><div id="psi-out"></div>';
      body.querySelector("#psi-save").addEventListener("click", function () { var v = body.querySelector("#psi-key").value.trim(); if (v) { save("psi-key", v); toast("Key saved"); draw(); } });
      body.querySelector("#psi-run").addEventListener("click", runAll);
      body.querySelector("#psi-stop").addEventListener("click", function () { stop = true; });
      table(d);
    }
    function table(d) {
      var out = body.querySelector("#psi-out");
      if (!d || !d.pages || !Object.keys(d.pages).length) { out.innerHTML = '<div class="empty">No mobile check yet.</div>'; return; }
      var rows = Object.keys(d.pages).map(function (u) { return { u: u, r: d.pages[u] }; }).sort(function (a, b) { return (a.r.perf == null ? 101 : a.r.perf) - (b.r.perf == null ? 101 : b.r.perf); });
      var ok = rows.filter(function (x) { return !x.r.error; });
      var avg = ok.length ? Math.round(ok.reduce(function (s, x) { return s + (x.r.perf || 0); }, 0) / ok.length) : 0;
      var poor = ok.filter(function (x) { return x.r.perf < 50; }).length;
      var squashed = ok.filter(function (x) { return failOf(x.r, "image-aspect-ratio"); }).length;
      function chip(v) { return v == null ? "–" : '<span class="chip ' + (v >= 90 ? "good" : v >= 50 ? "flag" : "bad") + '">' + v + "</span>"; }
      out.innerHTML = '<div class="stats">' + stat(avg + "/100", "Average mobile speed score", avg < 50) + stat(poor, "Pages under 50", poor > 0) + stat(squashed, "Pages with squashed images", squashed > 0) + stat(ok.length + " of " + rows.length, "Pages checked") + "</div>" +
        '<p class="muted mono" style="font-size:.78rem">Checked ' + esc(new Date(d.when).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })) + (ok[0] && ok[0].r.version ? " · Lighthouse " + esc(ok[0].r.version) : "") + ". Scores vary a few points between runs; look at the trend. 90+ good, 50 to 89 needs work, under 50 poor.</p>" +
        '<div class="table-wrap"><table><thead><tr><th>Page</th><th class="num">Speed</th><th class="num">Access.</th><th class="num">SEO</th><th class="num">Main content</th><th class="num">Jumping</th><th>Real visitors</th><th></th></tr></thead><tbody>' +
        rows.map(function (x) {
          var r = x.r;
          if (r.error) return '<tr><td><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(shortPath(x.u)) + '</a></td><td colspan="7" class="muted">' + esc(r.error) + "</td></tr>";
          return '<tr><td><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(shortPath(x.u)) + '</a></td><td class="num">' + chip(r.perf) + '</td><td class="num">' + chip(r.a11y) + '</td><td class="num">' + chip(r.seo) + '</td><td class="num">' + (r.lcp ? (r.lcp / 1000).toFixed(1) + " s" : "–") + '</td><td class="num">' + (r.cls != null ? r.cls.toFixed(2) : "–") + "</td><td>" + (r.field ? esc((r.field.overall || "").toLowerCase() || "–") : '<span class="muted">not enough data</span>') + '</td><td><a class="btn small" href="https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(x.u) + '&form_factor=mobile" target="_blank" rel="noopener">Full report</a></td></tr>';
        }).join("") + "</tbody></table></div>" +
        (load("auto-fixes-mobile", []).length ? '<div class="row" style="margin-top:10px"><a class="btn primary" href="#fixes">' + load("auto-fixes-mobile", []).length + " mobile fixes in the Fix queue</a></div>" : "");
    }
    function runAll() {
      var audit = load("seo-audit", null), st = body.querySelector("#psi-status");
      if (!audit) { st.innerHTML = '<div class="notice">Run the page audit first, so the check knows which pages are live.</div>'; return; }
      var urls = audit.pages.filter(function (p) { return p.live && !p.redirectTo && !p.noindex; }).map(function (p) { return p.link; }).slice(0, 120);
      var d = { when: new Date().toISOString(), pages: {} }, i = 0, done = 0; stop = false;
      body.querySelector("#psi-run").disabled = true; body.querySelector("#psi-stop").hidden = false;
      function next() {
        if (stop || i >= urls.length) return Promise.resolve();
        var u = urls[i++];
        return runPsi(u).then(function (r) { d.pages[u] = r; }, function (e) { d.pages[u] = { error: e.message }; if (/limit/.test(e.message)) stop = true; })
          .then(function () { done++; st.innerHTML = '<div class="notice info">Checked ' + done + " of " + urls.length + "…</div>"; save("psi", d); return next(); });
      }
      Promise.all([next(), next()]).then(function () {
        save("psi", d); save("auto-fixes-mobile", buildMobileFixes(d)); updateNav();
        body.querySelector("#psi-run").disabled = false; body.querySelector("#psi-stop").hidden = true;
        var errs = Object.keys(d.pages).filter(function (k) { return d.pages[k].error; });
        st.innerHTML = '<div class="notice ' + (errs.length ? "" : "info") + '">' + (stop && done < urls.length ? "Stopped after " + done + " pages. " : "Mobile check finished. ") + (errs.length ? errs.length + " pages couldn't be checked: " + esc(d.pages[errs[0]].error) : "") + "</div>";
        table(d);
      });
    }
    draw();
  }

  /* ---------- Fix queue ---------- */
  var TYPE_LABEL = { meta_title: "SEO title", meta_description: "Meta description", content_replace: "Content change", new_draft: "New draft", manual: "Steps",
    elementor_set: "Page text change", elementor_swap: "Phrase change", elementor_remove: "Remove from page", set_status: "Unpublish page" };
  function needsV4(err) {
    if (/no route|unknown edit type/i.test(err.message)) throw new Error("Page editing needs the latest page checker snippet. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again.");
    throw err;
  }
  var PRI_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  var PRI_CHIP = { critical: "bad", high: "flag", medium: "info", low: "" };
  function proposals() {
    var list = (window.WPT_PROPOSALS || []).concat(load("auto-fixes", []), load("auto-fixes-gsc", []), load("auto-fixes-ga4", []), load("auto-fixes-claims", []), load("auto-fixes-rules", []), load("auto-fixes-mobile", []));
    return list.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      return (PRI_ORDER[a.p.priority || "medium"] - PRI_ORDER[b.p.priority || "medium"]) || a.i - b.i;
    }).map(function (x) { return x.p; });
  }
  function fixState() { return load("fix-state", {}); }
  function setFix(id, patch) { var s = fixState(); s[id] = Object.assign({}, s[id] || {}, patch); save("fix-state", s); }
  function pendingFixes() {
    var s = fixState();
    return proposals().filter(function (p) { return !p.example && !(s[p.id] && s[p.id].status); });
  }
  function logChange(entry) { var l = load("change-log", []); l.unshift(entry); save("change-log", l); }

  function countOnce(hay, needle) {
    if (!needle) return 0; var n = 0, i = hay.indexOf(needle);
    while (i > -1 && n < 3) { n++; i = hay.indexOf(needle, i + needle.length); }
    return n;
  }
  /* Find a page's WordPress ID from its web address, for fixes written without one. */
  function resolveId(p) {
    var path = (p.link || "").replace(/^https?:\/\/[^\/]+/, "").replace(/\/$/, "");
    var slug = path.split("/").pop();
    if (!slug) return wpFetch("/wp/v2/pages?per_page=100&_fields=id,link").then(function (rows) {
      var home = rows.filter(function (r) { return norm(r.link) === norm(p.link); });
      if (home.length === 1) return home[0].id;
      throw new Error("Couldn't match the home page by its address. Ask Claude to add the page ID to this fix.");
    });
    return wpFetch("/wp/v2/" + p.postType + "?slug=" + encodeURIComponent(slug) + "&_fields=id,link").then(function (rows) {
      var exact = rows.filter(function (r) { return norm(r.link) === norm(p.link); });
      if (exact.length === 1) return exact[0].id;
      if (rows.length === 1) return rows[0].id;
      throw new Error("Couldn't find this page by its address (" + p.link + "). It may have moved. Nothing was changed.");
    });
  }
  function norm(u) { return String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase(); }

  function pushFix(p, text) {
    if (p.example) return Promise.reject(new Error("This is an example. It can't be pushed."));
    if (p.type !== "new_draft" && p.link && !p._liveChecked && hasChecker()) {
      return checkUrls([p.link]).then(function (live) {
        var r = live[norm(p.link)];
        if (isRedirect(r)) throw new Error("This page redirects to " + r.location + ", so changing it would do nothing. Nothing was changed. Reject this fix.");
        return pushFix(Object.assign({}, p, { _liveChecked: true }), text);
      });
    }
    if (p.type !== "new_draft" && !(p.pageId > 0) && p.link) {
      return resolveId(p).then(function (id) {
        return pushFix(Object.assign({}, p, { pageId: id }), text).then(function (r) { r.pageId = id; return r; });
      });
    }
    var base = "/wp/v2/" + p.postType + "/";
    if (p.type === "new_draft") {
      return wpFetch(base, { method: "POST", body: { title: p.pageTitle, content: text, status: "draft" } }).then(function (r) {
        return { before: "", after: text, draftId: r.id, editLink: wpAuth().site.replace(/\/$/, "") + "/wp-admin/post.php?post=" + r.id + "&action=edit" };
      });
    }
    if (!(p.pageId > 0)) return Promise.reject(new Error("This fix has no page ID. Ask Claude to regenerate it."));
    if (p.type === "meta_title" || p.type === "meta_description") {
      var key = metaKey(p.type), a = wpAuth();
      if (!key) return Promise.reject(new Error("No supported SEO plugin was found when you tested the connection."));
      if (!a.metaReady) return Promise.reject(new Error("The SEO fields aren't open to the hub yet. Add the snippet in docs/wordpress-snippet.php, then test the connection again."));
      return wpFetch(base + p.pageId + "?context=edit&_fields=id,meta").then(function (cur) {
        var before = (cur.meta && cur.meta[key]) || "";
        var body = { meta: {} }; body.meta[key] = text;
        return wpFetch(base + p.pageId, { method: "POST", body: body }).then(function (r) {
          if (!r.meta || r.meta[key] !== text) throw new Error("WordPress accepted the request but the field didn't change. The snippet may not be active.");
          return { before: before, after: text };
        });
      });
    }
    if (p.type === "elementor_set" || p.type === "elementor_remove" || p.type === "elementor_swap") {
      if (p.type === "elementor_remove" && p.level == null) return Promise.reject(new Error("Choose exactly what to remove first (the options above), so nothing else on the page goes with it."));
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: p.type === "elementor_set" ? "set" : p.type === "elementor_swap" ? "swap" : "remove", find: p.find, replace: text, level: p.level, scope: p.scope || "" } })
        .then(function (r) { return { before: r.before, after: r.after, backup: r.backup }; }, needsV4);
    }
    if (p.type === "set_status") {
      return wpFetch(base + p.pageId + "?context=edit&_fields=id,status").then(function (cur) {
        return wpFetch(base + p.pageId, { method: "POST", body: { status: p.status || "draft" } }).then(function (r) {
          if (r.status !== (p.status || "draft")) throw new Error("WordPress didn't change the page status. Nothing was changed.");
          return { before: cur.status, after: r.status };
        });
      });
    }
    if (p.type === "content_replace") {
      return wpFetch(base + p.pageId + "?context=edit&_fields=id,content").then(function (cur) {
        var raw = (cur.content && cur.content.raw) || "";
        var n = countOnce(raw, p.current);
        if (n === 0) throw new Error("The text being replaced isn't on the page any more, so someone may have edited it. Nothing was changed. Ask Claude for a fresh version of this fix.");
        if (n > 1) throw new Error("That text appears more than once on the page, so the hub can't tell which one to change. Nothing was changed.");
        var next = raw.split(p.current).join(text);
        return wpFetch(base + p.pageId, { method: "POST", body: { content: next } }).then(function () { return { before: p.current, after: text }; });
      });
    }
    return Promise.reject(new Error("Unknown fix type."));
  }
  /* Ask WordPress what each removal level would take off the page, without changing anything. */
  function previewRemoval(p) {
    var go = p.pageId > 0 ? Promise.resolve(p.pageId) : resolveId(p);
    return go.then(function (id) {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: id, op: "remove", find: p.find, dry_run: 1 } }).then(function (r) {
        if (!r.dry_run) throw new Error("The page checker snippet needs updating before removals can be previewed. Click Copy page checker code on the Website & SEO page.");
        return r.options;
      }, needsV4);
    });
  }
  function undoFix(p, st, force) {
    if (!(p.pageId > 0) && st.pageId) p = Object.assign({}, p, { pageId: st.pageId });
    var base = "/wp/v2/" + p.postType + "/";
    if (p.type === "elementor_set" || p.type === "elementor_remove" || p.type === "elementor_swap") {
      return wpFetch("/wpt-hub/v1/elementor-undo", { method: "POST", body: { post_id: p.pageId, backup: st.backup, force: force ? 1 : 0 } });
    }
    if (p.type === "set_status") return wpFetch(base + p.pageId, { method: "POST", body: { status: st.before || "publish" } });
    if (p.type === "meta_title" || p.type === "meta_description") {
      var key = metaKey(p.type); var body = { meta: {} }; body.meta[key] = st.before || "";
      return wpFetch(base + p.pageId, { method: "POST", body: body });
    }
    if (p.type === "content_replace") {
      return wpFetch(base + p.pageId + "?context=edit&_fields=id,content").then(function (cur) {
        var raw = (cur.content && cur.content.raw) || "";
        if (countOnce(raw, st.after) !== 1) throw new Error("The page has changed since this fix went live, so it can't be undone automatically. Use Revisions on the page in WordPress to roll it back.");
        return wpFetch(base + p.pageId, { method: "POST", body: { content: raw.split(st.after).join(st.before) } });
      });
    }
    return Promise.reject(new Error("New drafts aren't undone from here. Move the draft to the bin in WordPress if you don't want it."));
  }

  function lengthHint(type, text) {
    var n = text.length;
    if (type === "meta_title") return n + " characters" + (n > 60 ? " · over 60, Google may cut it off" : "");
    if (type === "meta_description") return n + " characters" + (n > 160 ? " · over 160, Google may cut it off" : n < 70 ? " · a bit short" : " · good length");
    return "";
  }

  function renderFixes(main) {
    var view = load("fix-view", "waiting");
    main.innerHTML = head("Website & SEO", "Fix queue", "Everything the website needs for Google and AI search: fixes Claude has written and problems the audit found. Nothing goes live until you approve it.");
    var area = load("fix-area", "All");
    var filt = el('<div class="row"><label class="field" for="fix-area" style="flex-direction:row;align-items:center;gap:8px">Show<select id="fix-area">' +
      ["All", "Leads", "Content", "Mobile", "Structure", "Indexing", "AI search"].map(function (o) { return "<option" + (o === area ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></label></div>");
    main.appendChild(filt);
    filt.querySelector("select").addEventListener("change", function (e) { area = e.target.value; save("fix-area", area); draw(); });
    var a = wpAuth();
    if (!a || !a.pass || !a.ok) main.appendChild(el('<div class="notice"><b>WordPress isn\'t connected yet.</b> You can read and edit fixes, but pushing needs the connection set up on the <a href="#seo">Website & SEO</a> page.</div>'));
    var tabs = el('<div class="row" role="tablist"></div>'); main.appendChild(tabs);
    var list = el('<div style="display:flex;flex-direction:column;gap:14px"></div>'); main.appendChild(list);

    function draw() {
      var s = fixState(), all = proposals().filter(function (p) { return area === "All" || (p.category || "Content") === area; });
      var groups = {
        waiting: all.filter(function (p) { return !(s[p.id] && s[p.id].status); }),
        pushed: all.filter(function (p) { return s[p.id] && /^(pushed|undone|done)$/.test(s[p.id].status); }),
        rejected: all.filter(function (p) { return s[p.id] && s[p.id].status === "rejected"; })
      };
      var names = { waiting: "Waiting for you", pushed: "Done", rejected: "Not doing" };
      tabs.innerHTML = Object.keys(groups).map(function (g) {
        return '<button type="button" role="tab" class="btn' + (g === view ? " primary" : "") + '" data-view="' + g + '" aria-selected="' + (g === view) + '">' + names[g] + " (" + groups[g].length + ")</button>";
      }).join("");
      var items = groups[view];
      if (!items.length) {
        list.innerHTML = '<div class="panel"><div class="empty">' + (view === "waiting" ? "No fixes waiting. Send Claude the audit (Copy as CSV on the Website & SEO page) and ask for the next batch." : "Nothing here yet.") + "</div></div>";
        return;
      }
      list.innerHTML = "";
      items.forEach(function (p) { list.appendChild(fixCard(p, s[p.id] || {}, draw)); });
    }
    tabs.addEventListener("click", function (e) { var v = e.target.getAttribute("data-view"); if (v) { view = v; save("fix-view", v); draw(); } });
    draw();
    updateNav();
  }

  function headChips(p, st) {
    return '<div class="row">' + '<span class="chip ' + PRI_CHIP[p.priority || "medium"] + '">' + PRI_LABEL[p.priority || "medium"] + "</span>" +
      '<span class="chip info">' + esc(TYPE_LABEL[p.type] || p.type) + "</span>" + '<span class="chip">' + esc(p.category || "Content") + "</span>" +
      (p.auto ? '<span class="chip">Found by audit</span>' : "") + (p.example ? '<span class="chip ex">example</span>' : "") +
      (st.status === "done" ? '<span class="chip good">Done</span>' : "") + (st.reopened && !st.status ? '<span class="chip bad">Still found on the last audit</span>' : "") + "</div>";
  }
  function offerAlreadyDone(p, box, redraw) {
    var b = el('<div class="row" style="margin-top:8px"><span class="muted" style="font-size:.86rem">If this has already been sorted, you can close it.</span><button type="button" class="btn small primary">Mark as done</button></div>');
    box.appendChild(b);
    b.querySelector("button").addEventListener("click", function () {
      var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      setFix(p.id, { status: "done", doneAt: when, doneTs: Date.now() });
      logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: TYPE_LABEL[p.type] || "Fix", action: "Marked done (already sorted)" });
      toast("Marked done"); redraw(); updateNav();
    });
  }
  function manualCard(p, st, redraw) {
    var card = el('<article class="panel fix"></article>');
    var pages = p.pages || [];
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' + headChips(p, st) +
      "<h2>" + esc(p.issue) + "</h2>" + perfLine(p.link) +
      (pages.length ? "" : '<p class="muted" style="font-size:.86rem"><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.pageTitle) + "</a></p>") + "</div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "") + " · " + esc(p.created || "") + "</span></div>" +
      '<p style="font-size:.9rem"><b>Why it matters:</b> ' + esc(p.why) + "</p>" +
      (pages.length ? '<details' + (pages.length <= 6 ? " open" : "") + '><summary style="cursor:pointer;font-size:.88rem"><b>Where (' + pages.length + ")</b></summary><ul class=\"where\">" +
        pages.map(function (x) { return '<li><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a>" + (x.note ? ' <span class="muted">· ' + esc(x.note) + "</span>" : "") + "</li>"; }).join("") + "</ul></details>" : "") +
      '<div><b style="font-size:.9rem">How to fix it</b><ol class="steps-list">' + (p.steps || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>" +
      '<div class="fix-actions row"></div>';
    var actions = card.querySelector(".fix-actions");
    if (!st.status) {
      actions.innerHTML = '<button type="button" class="btn primary">Mark as done</button><button type="button" class="btn rej">Not doing this</button>';
      actions.querySelector(".primary").addEventListener("click", function () {
        var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
        setFix(p.id, { status: "done", doneAt: when, doneTs: Date.now(), reopened: false });
        logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: "Steps", action: "Marked done: " + p.issue });
        toast(p.auto ? "Marked done. The next audit will check it." : "Marked done"); redraw(); updateNav();
      });
      actions.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    } else {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (st.status === "done" ? "Done " + esc(st.doneAt || "") : "Not doing this") + '</span><button type="button" class="btn small">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].status; save("fix-state", s); redraw(); updateNav(); });
    }
    return card;
  }

  function fixCard(p, st, redraw) {
    if (p.type === "manual") return manualCard(p, st, redraw);
    var text = st.edited != null ? st.edited : p.proposed;
    var isMeta = p.type === "meta_title" || p.type === "meta_description";
    var done = st.status === "pushed" || st.status === "undone";
    var card = el('<article class="panel fix"></article>');
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' +
      headChips(p, st).replace("</div>", (p.size === "big" ? '<span class="chip flag">Big change</span>' : "") + (st.status === "undone" ? '<span class="chip">Undone</span>' : st.status === "pushed" ? '<span class="chip good">Live</span>' : "") + "</div>") +
      '<h2><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.pageTitle) + "</a></h2>" +
      '<p class="muted" style="font-size:.86rem">' + esc(p.issue) + "</p>" + perfLine(p.link) + "</div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "") + " · " + esc(p.created || "") + "</span></div>" +
      '<div class="cols2">' +
      '<div class="field">Now on the site<pre class="was">' + esc(p.type === "new_draft" ? "(new page, nothing yet)" : (done ? st.before : p.current) || "(empty)") + "</pre></div>" +
      '<label class="field" for="fix-' + esc(p.id) + '">' + (done ? "What went live" : /elementor_remove|set_status/.test(p.type) ? "What will happen" : "Proposed (you can edit this)") +
      '<textarea id="fix-' + esc(p.id) + '"' + (done || p.type === "elementor_remove" || p.type === "set_status" ? " readonly" : "") + (/content_replace|new_draft|elementor_set/.test(p.type) ? ' style="min-height:140px"' : "") + ">" + esc(done ? (st.after || (p.type === "elementor_remove" ? "(removed)" : "")) : text) + "</textarea>" +
      (isMeta ? '<span class="hint mono"></span>' : "") + "</label></div>" +
      '<p class="muted" style="font-size:.86rem"><b>Why:</b> ' + esc(p.why) + "</p>" +
      '<div class="fix-actions row"></div><div class="fix-msg"></div>';
    var ta = card.querySelector("textarea"), hint = card.querySelector(".hint"), actions = card.querySelector(".fix-actions"), msg = card.querySelector(".fix-msg");
    function showHint() { if (hint) hint.textContent = lengthHint(p.type, ta.value); }
    showHint();
    if (!done) ta.addEventListener("input", function () { showHint(); setFix(p.id, { edited: ta.value }); });

    if (!st.status && p.type === "elementor_remove") {
      var pick = el('<div class="remove-pick"><div class="row"><b style="font-size:.9rem">Choose exactly what to remove</b><button type="button" class="btn small">Show the options</button></div><div class="opts"></div></div>');
      card.insertBefore(pick, actions);
      var opts = pick.querySelector(".opts");
      function loadOpts() {
        opts.innerHTML = '<div class="notice info">Asking WordPress what each option would remove. Nothing changes yet…</div>';
        previewRemoval(p).then(function (list) {
          var chosen = fixState()[p.id] && fixState()[p.id].level;
          opts.innerHTML = list.map(function (o) {
            var label = o.level === 0 ? "Just this one " + o.kind : o.level === list.length - 1 ? "The whole outer section" : "The block around it, " + o.level + " level" + (o.level > 1 ? "s" : "") + " out";
            return '<label class="opt' + (o.unique ? "" : " off") + '"><input type="radio" name="lvl-' + esc(p.id) + '" value="' + o.level + '"' + (String(chosen) === String(o.level) ? " checked" : "") + (o.unique ? "" : " disabled") + "> <span><b>" + esc(label) + "</b>" + (o.images ? ' <span class="muted">· ' + o.images + " image" + (o.images > 1 ? "s" : "") + "</span>" : "") + (o.unique ? "" : ' <span class="muted">· not possible, the text is in more than one block</span>') + '<pre class="was">' + esc(o.text.slice(0, 600)) + (o.text.length > 600 ? "\n…" : "") + "</pre></span></label>";
          }).join("");
        }).catch(function (err) {
          opts.innerHTML = '<div class="notice">' + esc(err.message) + "</div>";
          if (/isn't on the page any more/.test(err.message)) offerAlreadyDone(p, opts, redraw);
        });
      }
      pick.querySelector("button").addEventListener("click", loadOpts);
      opts.addEventListener("change", function (e) { if (e.target.name === "lvl-" + p.id) setFix(p.id, { level: +e.target.value }); });
      var a0 = wpAuth(); if (a0 && a0.ok && !p.example) loadOpts();
    }
    if (!st.status) {
      actions.innerHTML = (p.size === "big" ? '<label class="row" style="font-size:.86rem"><input type="checkbox" class="sure"> I\'ve read this change and I\'m happy for it to go live</label>' : "") +
        '<button type="button" class="btn primary go"' + (p.example ? " disabled" : "") + ">" + (p.type === "new_draft" ? "Approve and save as draft" : p.type === "elementor_remove" ? "Approve and remove from page" : p.type === "set_status" ? "Approve and unpublish" : "Approve and push live") + "</button>" +
        '<button type="button" class="btn rej">Reject</button>' + (st.edited != null ? '<button type="button" class="btn small reset">Reset to Claude\'s version</button>' : "");
      actions.querySelector(".go").addEventListener("click", function () {
        var sure = actions.querySelector(".sure");
        if (sure && !sure.checked) { msg.innerHTML = '<div class="notice">Tick the box to confirm you\'ve read this change.</div>'; return; }
        var value = ta.value;
        if (!value.trim() && !/^(meta_description|elementor_remove|set_status)$/.test(p.type)) { msg.innerHTML = '<div class="notice">The proposed text is empty.</div>'; return; }
        var btn = actions.querySelector(".go"); btn.disabled = true; btn.textContent = "Pushing…";
        var lv = fixState()[p.id] && fixState()[p.id].level;
        pushFix(p.type === "elementor_remove" ? Object.assign({}, p, { level: lv == null ? null : lv, scope: "" }) : p, value).then(function (r) {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, editLink: r.editLink || "", pageId: r.pageId || p.pageId, backup: r.backup || "" });
          logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: TYPE_LABEL[p.type], action: p.type === "new_draft" ? "Draft saved" : p.type === "elementor_remove" ? "Removed from page" : p.type === "set_status" ? "Unpublished" : "Pushed live" });
          toast(p.type === "new_draft" ? "Saved as a draft in WordPress" : "Live on the site");
          redraw(); updateNav();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = p.type === "new_draft" ? "Approve and save as draft" : p.type === "elementor_remove" ? "Approve and remove from page" : p.type === "set_status" ? "Approve and unpublish" : "Approve and push live";
          msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + "</div>";
          if (/isn't on the page any more|isn't on the page/.test(err.message)) offerAlreadyDone(p, msg, redraw);
        });
      });
      actions.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Rejected"); redraw(); updateNav(); });
      var rs = actions.querySelector(".reset");
      if (rs) rs.addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].edited; save("fix-state", s); redraw(); });
    } else if (st.status === "rejected") {
      actions.innerHTML = '<button type="button" class="btn">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].status; save("fix-state", s); redraw(); updateNav(); });
    } else {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (st.status === "undone" ? "Undone " + esc(st.undoneAt || "") : "Pushed " + esc(st.pushedAt || "")) + "</span>" +
        (st.editLink ? '<a class="btn small" href="' + esc(st.editLink) + '" target="_blank" rel="noopener">Open draft in WordPress</a>' : "") +
        (st.status === "pushed" && p.type !== "new_draft" ? '<button type="button" class="btn small danger undo">Undo</button>' : "");
      var u = actions.querySelector(".undo");
      if (u) u.addEventListener("click", function () {
        if (!u.dataset.sure) { u.dataset.sure = "1"; u.textContent = "Click again to undo"; return; }
        u.disabled = true; u.textContent = "Undoing…";
        undoFix(p, st).then(function () {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "undone", undoneAt: when });
          logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: TYPE_LABEL[p.type], action: "Undone" });
          toast("Change undone"); redraw();
        }).catch(function (err) {
          u.disabled = false; u.textContent = "Undo"; delete u.dataset.sure;
          msg.innerHTML = '<div class="notice"><b>Couldn\'t undo.</b> ' + esc(err.message) + "</div>";
          if (/edited since/.test(err.message)) {
            var f = el('<button type="button" class="btn small danger" style="margin-top:8px">Undo anyway and lose the later edits</button>');
            msg.appendChild(f);
            f.addEventListener("click", function () {
              f.disabled = true;
              undoFix(p, st, true).then(function () {
                var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
                setFix(p.id, { status: "undone", undoneAt: when });
                logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: TYPE_LABEL[p.type], action: "Undone (forced)" });
                toast("Change undone"); redraw();
              }).catch(function (e2) { f.disabled = false; msg.innerHTML = '<div class="notice"><b>Couldn\'t undo.</b> ' + esc(e2.message) + "</div>"; });
            });
          }
        });
      });
    }
    return card;
  }

  function claimTerms() { return load("claim-terms", ["Better Purchasing", "BPF"]); }
  /* "wrong phrase => right phrase" rules. Every hit becomes a push-ready fix automatically. */
  function claimRules() { return load("claim-rules", []); }
  function parseRules(txt) {
    return String(txt || "").split(/\n/).map(function (l) { var m = l.split(/\s*=>\s*/); return m.length === 2 && m[0].trim().length > 3 ? { find: m[0].trim(), replace: m[1].trim() } : null; }).filter(Boolean);
  }
  function ruleFixes() {
    var rules = claimRules(), today = new Date().toISOString().slice(0, 10), out = [];
    var claude = {}; (window.WPT_PROPOSALS || []).forEach(function (f) { if (f.find) claude[norm(f.link) + "|" + f.find.toLowerCase()] = true; });
    return rules.reduce(function (pr, rule) {
      return pr.then(function () {
        return findText(rule.find).then(function (rows) {
          rows.forEach(function (r) {
            if (claude[norm(r.link) + "|" + rule.find.toLowerCase()]) return;
            var hit = r.hits[0] || {};
            out.push({ id: "rule-" + (norm(r.link) + "-" + rule.find).replace(/\W+/g, "-").slice(0, 100), auto: true, created: today, batch: "Automatic replacement",
              type: r.elementor ? "elementor_swap" : "content_replace", size: "small", priority: "critical", category: "Content",
              postType: r.type === "post" ? "posts" : "pages", pageId: r.post_id, pageTitle: r.title, link: r.link, find: rule.find,
              issue: "Says \u201c" + rule.find + "\u201d", current: r.elementor ? "\u2026" + (hit.snippet || rule.find) + "\u2026" : rule.find, proposed: rule.replace,
              why: "Matches one of your automatic replacement rules on the Website & SEO page. Only this phrase changes; the rest of the text stays as it is." });
          });
        });
      });
    }, Promise.resolve()).then(function () { save("auto-fixes-rules", out); updateNav(); return out; });
  }
  function findText(q) {
    return wpFetch("/wpt-hub/v1/find?q=" + encodeURIComponent(q)).catch(function (err) {
      if (/no route/i.test(err.message)) throw new Error("Find needs the latest page checker snippet. Click Copy page checker code above, replace it in WordPress and save.");
      throw err;
    });
  }
  /* Claims Connor has said aren't true: any page still saying them becomes a critical fix. */
  function runClaimsCheck() {
    var terms = claimTerms(), found = {};
    return terms.reduce(function (pr, t) {
      return pr.then(function () { return findText(t).then(function (rows) { rows.forEach(function (r) { (found[r.link] = found[r.link] || { r: r, terms: [] }).terms.push(t); }); }); });
    }, Promise.resolve()).then(function () {
      var today = new Date().toISOString().slice(0, 10), fixes = [];
      var pages = Object.keys(found).map(function (k) { var x = found[k]; return { title: x.r.title, link: x.r.link, note: "says: " + x.terms.join(", ") + " · " + x.r.hits.map(function (h) { return "\u201c" + h.snippet.slice(0, 120) + "\u201d"; }).join(" ") }; });
      if (pages.length) fixes.push({ id: "auto-claims", auto: true, type: "manual", priority: "critical", category: "Content", created: today, batch: "Claims check", pageTitle: "Whole site", link: pages[0].link,
        issue: pages.length + " page" + (pages.length > 1 ? "s" : "") + " still make claims you've said aren't true", pages: pages,
        why: "Buyers and procurement teams check claims like framework status. One false claim can sink trust in everything else on the site, and in a tender it can disqualify you.",
        steps: ["Claude writes push-ready fixes for each page listed (phrase changes, removals or unpublishing). They appear at the top of this queue as critical.", "Pages marked noindex are still visible to anyone with the link, so fix those too.", "The check runs again with every audit. Change the list of claims on the Website & SEO page."] });
      save("auto-fixes-claims", fixes); updateNav();
      return ruleFixes().then(function () { return pages; }, function () { return pages; });
    });
  }
  function renderFind(main) {
    var p = panel("Find text on the site", "Searches every published page and post, including Elementor pages. Read-only.");
    var box = el('<div style="display:flex;flex-direction:column;gap:10px"><div class="row"><label class="field" for="find-q" style="flex:1;min-width:200px">Text to find<input id="find-q" placeholder="e.g. Better Purchasing"></label><button type="button" class="btn primary" id="find-go" style="align-self:flex-end">Find</button></div><div id="find-out"></div>' +
      '<div class="row"><label class="field" for="claim-terms" style="flex:1;min-width:200px">Claims that aren\'t true (checked on every audit, comma separated)<input id="claim-terms" value="' + esc(claimTerms().join(", ")) + '"></label><button type="button" class="btn" id="claim-run" style="align-self:flex-end">Check now</button></div>' +
      '<label class="field" for="claim-rules">Automatic replacements: one per line, wrong phrase => right phrase. Every page using the wrong phrase gets a push-ready fix on each audit.<textarea id="claim-rules" rows="3" placeholder="an assured BPF supplier => a long-standing supplier">' + esc(claimRules().map(function (r) { return r.find + " => " + r.replace; }).join("\n")) + '</textarea></label><div id="claim-out"></div></div>');
    p.appendChild(box); main.appendChild(p);
    function results(rows) {
      if (!rows.length) return '<div class="empty">Not found on any published page.</div>';
      return '<div class="table-wrap"><table><thead><tr><th>Page</th><th>Where</th><th>Text</th></tr></thead><tbody>' + rows.map(function (r) {
        return r.hits.map(function (h, i) { return "<tr>" + (i ? "<td></td>" : '<td><a href="' + esc(r.link) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a><div class="muted" style="font-size:.75rem">' + esc(shortPath(r.link)) + (r.elementor ? " · Elementor" : "") + "</div></td>") + '<td class="mono" style="font-size:.78rem">' + esc(h.widget) + "</td><td>" + esc(h.snippet) + "</td></tr>"; }).join("");
      }).join("") + "</tbody></table></div>";
    }
    box.querySelector("#find-go").addEventListener("click", function () {
      var q = box.querySelector("#find-q").value.trim(), out = box.querySelector("#find-out"); if (!q) return;
      out.innerHTML = '<div class="notice info">Searching…</div>';
      findText(q).then(function (rows) { out.innerHTML = results(rows); }, function (err) { out.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
    });
    box.querySelector("#find-q").addEventListener("keydown", function (e) { if (e.key === "Enter") box.querySelector("#find-go").click(); });
    box.querySelector("#claim-terms").addEventListener("change", function (e) { save("claim-terms", e.target.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean)); });
    box.querySelector("#claim-rules").addEventListener("change", function (e) { var r = parseRules(e.target.value); save("claim-rules", r); toast(r.length + " replacement rule" + (r.length === 1 ? "" : "s") + " saved. Click Check now to apply."); });
    box.querySelector("#claim-run").addEventListener("click", function () {
      var out = box.querySelector("#claim-out"); out.innerHTML = '<div class="notice info">Checking…</div>';
      runClaimsCheck().then(function (pages) { out.innerHTML = pages.length ? '<div class="notice"><b>' + pages.length + " page" + (pages.length > 1 ? "s" : "") + ' still say this.</b> Listed as a critical fix in the <a href="#fixes">Fix queue</a>.</div>' : '<div class="notice info">None of these claims appear on any published page.</div>'; },
        function (err) { out.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
    });
  }

  function renderChangeLog(main) {
    var p = panel("Change log", "Every change the hub has made to the website, newest first.");
    var l = load("change-log", []);
    p.appendChild(el(l.length ? '<div class="table-wrap"><table><thead><tr><th>When</th><th>Page</th><th>Change</th><th>What happened</th></tr></thead><tbody>' +
      l.map(function (x) { return '<tr><td class="mono">' + esc(x.when) + '</td><td><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.page) + "</a></td><td>" + esc(x.type) + "</td><td>" + esc(x.action) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" : '<div class="empty">No changes made yet.</div>'));
    main.appendChild(p);
  }

  /* ---------- Your jobs ---------- */
  function syncJobs() {
    var rows = load("jobs", null) || [];
    var seen = load("jobs-imported", []);
    (window.WPT_JOBS || []).forEach(function (j) {
      if (seen.indexOf(j.id) > -1) return;
      rows.unshift({ _id: uid(), _src: j.id, _ex: !!j.example, job: j.job, page: j.page, details: j.details, size: j.size, alt: j.alt, status: "To do" });
      seen.push(j.id);
    });
    save("jobs", rows); save("jobs-imported", seen);
  }
  function jobsToDo() { syncJobs(); return getRows("jobs").filter(function (j) { return j.status !== "Done" && !j._ex; }).length; }
  function renderJobs(main) {
    syncJobs();
    main.innerHTML = head("Things only you can do", "Your jobs", "Images, real quotes, figures to confirm and anything Garry needs to sign off. Claude adds to this list with each batch of fixes.");
    var p = panel("Job list", "For images: make them in Canva at the size given, upload to WordPress and use the alt text suggested.");
    p.appendChild(editableTable({
      key: "jobs", csvName: "your-jobs", addLabel: "Add job", onChange: updateNav,
      columns: [
        { k: "job", label: "Job", wide: true }, { k: "page", label: "Page" }, { k: "details", label: "What's needed", wide: true },
        { k: "size", label: "Size or format" }, { k: "alt", label: "Alt text to use" },
        { k: "status", label: "Status", type: "select", options: ["To do", "Doing", "Done"] }
      ],
      emptyText: "No jobs. Nice."
    }).node);
    main.appendChild(p);
  }

  /* ---------- shell ---------- */
  function updateNav() {
    var counts = {
      leads: openLeads().filter(function (l) { return l.nextDate && l.nextDate <= today(); }).length,
      inbox: getRows("inbox").filter(function (m) { return m.state === "Needs you"; }).length,
      fixes: pendingFixes().length,
      jobs: jobsToDo()
    };
    var nav = document.getElementById("nav"); var cur = currentId();
    nav.innerHTML = PAGES.map(function (p) {
      var c = counts[p.id];
      return '<a href="#' + p.id + '"' + (p.id === cur ? ' aria-current="page"' : "") + "><span>" + esc(p.label) + "</span>" +
        (c ? '<span class="count">' + c + "</span>" : p.pri ? '<span class="pri">' + esc(p.pri) + "</span>" : "") + "</a>";
    }).join("");
  }
  function currentId() {
    var h = (location.hash || "").replace("#", "");
    return PAGES.some(function (p) { return p.id === h; }) ? h : load("last-page", "today");
  }
  function route() {
    var id = currentId(); save("last-page", id);
    var page = PAGES.find(function (p) { return p.id === id; });
    var main = document.getElementById("main");
    main.innerHTML = ""; var wrap = el('<div class="page"></div>'); main.appendChild(wrap);
    page.render(wrap); updateNav(); window.scrollTo(0, 0);
    document.title = page.label + " · WPT Marketing Hub";
  }

  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  applyTheme(load("theme", null));
  document.getElementById("theme-toggle").addEventListener("click", function () {
    var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark"; applyTheme(next); save("theme", next);
  });
  document.getElementById("version-tag").textContent = "v" + VERSION + " · " + BUILT;
  window.addEventListener("hashchange", route);
  route();
})();
