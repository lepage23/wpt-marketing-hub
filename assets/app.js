/* WPT Marketing Hub
   Plain JavaScript, no build step. Data is saved in this browser (localStorage) until
   shared storage is added. Each page is a render function registered in PAGES. */
(function () {
  "use strict";

  var VERSION = "0.4.1";
  var BUILT = "2026-10-15 14:55 BST";
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
          }).join("") + '<td style="white-space:nowrap">' +
            (r._ex ? '<span class="chip ex" title="Example row. Replace or delete it.">example</span> ' : "") +
            (cfg.actions || []).map(function (a, i) { return '<button type="button" class="btn small" data-act="' + i + '">' + esc(a.label) + "</button> "; }).join("") +
            '<button type="button" class="btn small danger" data-del="1" aria-label="Delete row">Delete</button></td></tr>';
        });
        tableBox.innerHTML = h + "</tbody></table>";
      }
      var hasEx = rows.some(function (r) { return r._ex; });
      tools.innerHTML = '<button type="button" class="btn primary">' + esc(cfg.addLabel || "Add row") + "</button>" +
        '<button type="button" class="btn" data-copy="1">Copy as CSV</button>' +
        '<button type="button" class="btn" data-dl="1">Download CSV</button>' +
        (hasEx ? '<button type="button" class="btn" data-clear="1">Remove example rows</button>' : "");
    }
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
    { k: "next", label: "Next step" },
    { k: "nextDate", label: "Next step by", type: "date" },
    { k: "notes", label: "Notes" }
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

    function storeAudit(pages, site) {
      var audit = { when: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }), site: site, pages: pages };
      save("seo-audit", audit); drawAudit(audit); updateNav();
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
    drawAudit(load("seo-audit", null));

    actions.querySelector("#seo-only").addEventListener("change", function () { drawAudit(load("seo-audit", null)); });
    actions.querySelector("#seo-copy").addEventListener("click", function () {
      var a = load("seo-audit", null); if (!a) return toast("Run an audit first");
      var cols = [{ k: "title", label: "Page" }, { k: "link", label: "URL" }, { k: "type", label: "Type" }, { k: "words", label: "Words" }, { k: "metaTitle", label: "Title tag" }, { k: "metaDesc", label: "Meta description" }, { k: "modified", label: "Updated" }, { label: "Custom description set", compute: function (r) { return r.customDesc ? "yes" : "no"; } }, { label: "Redirects to", compute: function (r) { return r.redirectTo || ""; } }, { label: "Checked live", compute: function (r) { return r.live ? "yes" : r.redirectTo ? "redirect" : "no"; } }, { label: "Issues", compute: function (r) { return r.issues.join("; "); } }];
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
              storeAudit(pages, site);
              var red = pages.filter(function (p) { return p.redirectTo; }).length;
              status.innerHTML = '<div class="notice info">Audit finished. ' + pages.length + " items checked against the live site. " + red + " redirect elsewhere and are skipped.</div>";
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
    return fetch(wpBase(a) + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
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
      p.words = r.words; p.metaTitle = r.title || ""; p.metaDesc = r.description || ""; p.h2 = r.h2; p.hasSeo = true; p.live = true;
      p.issues = p.issues.filter(function (i) { return !API_ONLY_ISSUE.test(i); }).concat(liveIssues(r));
    });
    var targets = [];
    pages.forEach(function (p) { if (p.redirectTo && !known[norm(p.redirectTo)] && targets.indexOf(p.redirectTo) < 0) targets.push(p.redirectTo); });
    return targets;
  }
  function liveOnlyRow(url, r) {
    if (!r || r.error || r.status !== 200) return { title: shortPath(url), link: url, type: "Live page", words: 0, metaTitle: "", metaDesc: "", h2: 0, internal: "–", modified: "", hasSeo: true, liveOnly: true, issues: [r && r.error ? "Live check failed: " + r.error : "Live page answers " + (r ? r.status : "nothing")] };
    return { title: r.title || shortPath(url), link: url, type: "Live page", words: r.words, metaTitle: r.title || "", metaDesc: r.description || "", h2: r.h2, internal: "–", modified: "", hasSeo: true, live: true, liveOnly: true, issues: liveIssues(r) };
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
      '<details><summary class="muted" style="cursor:pointer;font-size:.88rem">Where do I get an application password?</summary>' +
      '<p class="muted" style="font-size:.86rem;margin-top:8px">In WordPress go to Users, then Profile. Scroll to Application Passwords, type "Marketing Hub" and click Add. Copy the password it shows and paste it above. Never paste it into a chat or email. You can revoke it from the same screen at any time.</p></details></div>');
    p.appendChild(box); main.appendChild(p);
    var res = box.querySelector("#wp-result");
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
        var k = SEO_KEYS[next.seo];
        if (!k) return null;
        return wpFetch("/wp/v2/pages?context=edit&per_page=1&_fields=id,meta").then(function (rows) {
          var m = rows[0] && rows[0].meta;
          next.metaReady = !!(m && Object.prototype.hasOwnProperty.call(m, k.title));
        });
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
      '<div class="list-item"><span class="chip info">Live</span><div>' + (a.checker ? '<span class="chip good">Page checker ready</span><div class="s" style="margin-top:4px">The audit checks redirects and what visitors actually see on each page.</div>' : '<span class="chip flag">Page checker not added</span><div class="s" style="margin-top:4px">Add docs/wordpress-page-checker.php as a second snippet so the audit can spot redirected pages and read Elementor pages properly.</div>') + "</div><span></span></div>" +
      (admin ? '<div class="list-item"><span class="chip flag">Role</span><div><div class="t">This is an administrator account</div><div class="s">It works, but if the password leaked it could change plugins and users. A separate Editor account is safer.</div></div><span></span></div>' : "") +
      "</div>";
  }

  /* ---------- Fix queue ---------- */
  var TYPE_LABEL = { meta_title: "SEO title", meta_description: "Meta description", content_replace: "Content change", new_draft: "New draft" };
  function proposals() { return (window.WPT_PROPOSALS || []).slice(); }
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
  function undoFix(p, st) {
    if (!(p.pageId > 0) && st.pageId) p = Object.assign({}, p, { pageId: st.pageId });
    var base = "/wp/v2/" + p.postType + "/";
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
    main.innerHTML = head("Website & SEO", "Fix queue", "Fixes Claude has written for the website. Nothing goes live until you approve it.");
    var a = wpAuth();
    if (!a || !a.pass || !a.ok) main.appendChild(el('<div class="notice"><b>WordPress isn\'t connected yet.</b> You can read and edit fixes, but pushing needs the connection set up on the <a href="#seo">Website & SEO</a> page.</div>'));
    var tabs = el('<div class="row" role="tablist"></div>'); main.appendChild(tabs);
    var list = el('<div style="display:flex;flex-direction:column;gap:14px"></div>'); main.appendChild(list);

    function draw() {
      var s = fixState(), all = proposals();
      var groups = {
        waiting: all.filter(function (p) { return !(s[p.id] && s[p.id].status); }),
        pushed: all.filter(function (p) { return s[p.id] && (s[p.id].status === "pushed" || s[p.id].status === "undone"); }),
        rejected: all.filter(function (p) { return s[p.id] && s[p.id].status === "rejected"; })
      };
      var names = { waiting: "Waiting for you", pushed: "Pushed", rejected: "Rejected" };
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

  function fixCard(p, st, redraw) {
    var text = st.edited != null ? st.edited : p.proposed;
    var isMeta = p.type === "meta_title" || p.type === "meta_description";
    var done = st.status === "pushed" || st.status === "undone";
    var card = el('<article class="panel fix"></article>');
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' +
      '<div class="row"><span class="chip info">' + esc(TYPE_LABEL[p.type] || p.type) + '</span><span class="chip ' + (p.size === "big" ? "flag" : "") + '">' + (p.size === "big" ? "Big change" : "Small change") + "</span>" +
      (p.example ? '<span class="chip ex">example</span>' : "") + (st.status === "undone" ? '<span class="chip">Undone</span>' : st.status === "pushed" ? '<span class="chip good">Live</span>' : "") + "</div>" +
      '<h2><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.pageTitle) + "</a></h2>" +
      '<p class="muted" style="font-size:.86rem">' + esc(p.issue) + "</p></div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "") + " · " + esc(p.created || "") + "</span></div>" +
      '<div class="cols2">' +
      '<div class="field">Now on the site<pre class="was">' + esc(p.type === "new_draft" ? "(new page, nothing yet)" : (done ? st.before : p.current) || "(empty)") + "</pre></div>" +
      '<label class="field" for="fix-' + esc(p.id) + '">' + (done ? "What went live" : "Proposed (you can edit this)") +
      '<textarea id="fix-' + esc(p.id) + '"' + (done ? " readonly" : "") + (p.type === "content_replace" || p.type === "new_draft" ? ' style="min-height:140px"' : "") + ">" + esc(done ? st.after : text) + "</textarea>" +
      (isMeta ? '<span class="hint mono"></span>' : "") + "</label></div>" +
      '<p class="muted" style="font-size:.86rem"><b>Why:</b> ' + esc(p.why) + "</p>" +
      '<div class="fix-actions row"></div><div class="fix-msg"></div>';
    var ta = card.querySelector("textarea"), hint = card.querySelector(".hint"), actions = card.querySelector(".fix-actions"), msg = card.querySelector(".fix-msg");
    function showHint() { if (hint) hint.textContent = lengthHint(p.type, ta.value); }
    showHint();
    if (!done) ta.addEventListener("input", function () { showHint(); setFix(p.id, { edited: ta.value }); });

    if (!st.status) {
      actions.innerHTML = (p.size === "big" ? '<label class="row" style="font-size:.86rem"><input type="checkbox" class="sure"> I\'ve read this change and I\'m happy for it to go live</label>' : "") +
        '<button type="button" class="btn primary go"' + (p.example ? " disabled" : "") + ">" + (p.type === "new_draft" ? "Approve and save as draft" : "Approve and push live") + "</button>" +
        '<button type="button" class="btn rej">Reject</button>' + (st.edited != null ? '<button type="button" class="btn small reset">Reset to Claude\'s version</button>' : "");
      actions.querySelector(".go").addEventListener("click", function () {
        var sure = actions.querySelector(".sure");
        if (sure && !sure.checked) { msg.innerHTML = '<div class="notice">Tick the box to confirm you\'ve read this change.</div>'; return; }
        var value = ta.value;
        if (!value.trim() && p.type !== "meta_description") { msg.innerHTML = '<div class="notice">The proposed text is empty.</div>'; return; }
        var btn = actions.querySelector(".go"); btn.disabled = true; btn.textContent = "Pushing…";
        pushFix(p, value).then(function (r) {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, editLink: r.editLink || "", pageId: r.pageId || p.pageId });
          logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: TYPE_LABEL[p.type], action: p.type === "new_draft" ? "Draft saved" : "Pushed live" });
          toast(p.type === "new_draft" ? "Saved as a draft in WordPress" : "Live on the site");
          redraw(); updateNav();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = p.type === "new_draft" ? "Approve and save as draft" : "Approve and push live";
          msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + "</div>";
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
        }).catch(function (err) { u.disabled = false; u.textContent = "Undo"; delete u.dataset.sure; msg.innerHTML = '<div class="notice"><b>Couldn\'t undo.</b> ' + esc(err.message) + "</div>"; });
      });
    }
    return card;
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
        { k: "job", label: "Job" }, { k: "page", label: "Page" }, { k: "details", label: "What's needed" },
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
