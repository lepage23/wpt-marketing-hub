/* WPT Marketing Hub
   Plain JavaScript, no build step. Data is saved in this browser (localStorage) until
   shared storage is added. Each page is a render function registered in PAGES. */
(function () {
  "use strict";

  var VERSION = "0.1.0";
  var BUILT = "2026-10-15 11:05 BST";
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
    if (y && !metaDesc) issues.push("No meta description");
    if (metaDesc && metaDesc.length > 160) issues.push("Meta description too long");
    if (metaDesc && metaDesc.length < 70) issues.push("Meta description short");
    if (metaTitle && metaTitle.length > 60) issues.push("Title tag over 60 characters");
    if (h2 === 0 && words > 150) issues.push("No H2 subheadings");
    if (noAlt) issues.push(noAlt + " image" + (noAlt > 1 ? "s" : "") + " missing alt text");
    if (internal < 2 && words > 150) issues.push("Few internal links");
    if (modified && modified < daysAgo(365)) issues.push("Not updated in over a year");
    return {
      id: item.id, type: type, title: stripHtml(item.title && item.title.rendered) || "(no title)", link: item.link, modified: modified,
      words: words, metaTitle: metaTitle, metaDesc: metaDesc, h2: h2, noAlt: noAlt, internal: internal, issues: issues, hasYoast: !!y
    };
  }
  function apiUrl(site, type, page) {
    return site.replace(/\/$/, "") + "/wp-json/wp/v2/" + type + "?per_page=100&page=" + page + "&_fields=id,link,title,modified,content,yoast_head_json";
  }
  function fetchAll(site, type) {
    var all = [];
    function next(page) {
      return fetch(apiUrl(site, type, page)).then(function (r) {
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
    main.innerHTML = head("Priority area", "Website & SEO", "Audit westpiertech.com through the WordPress API, track rankings and AI search visibility, and plan content.");

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
      var list = audit.pages.slice().sort(function (a, b) { return b.issues.length - a.issues.length; });
      if (only) list = list.filter(function (x) { return x.issues.length; });
      var total = audit.pages.reduce(function (n, x) { return n + x.issues.length; }, 0);
      var thin = audit.pages.filter(function (x) { return x.words < 300; }).length;
      var noDesc = audit.pages.filter(function (x) { return x.hasYoast && !x.metaDesc; }).length;
      var stale = audit.pages.filter(function (x) { return x.modified && x.modified < daysAgo(365); }).length;
      var yoast = audit.pages.some(function (x) { return x.hasYoast; });
      results.innerHTML = '<div class="stats" style="margin-bottom:12px">' + stat(audit.pages.length, "Pages and posts checked") + stat(total, "Issues found", total > 0) +
        stat(thin, "Thin pages (under 300 words)", thin > 0) + stat(noDesc, "Missing meta descriptions", noDesc > 0) + stat(stale, "Not updated in a year", stale > 0) + "</div>" +
        (yoast ? "" : '<div class="notice" style="margin-bottom:12px">No SEO plugin data came back, so titles and meta descriptions could not be checked. Yoast exposes these through the API. If the site uses a different SEO plugin, tell Claude which one.</div>') +
        '<p class="muted mono" style="margin-bottom:8px">Last run ' + esc(audit.when) + " · " + esc(audit.site) + "</p>" +
        '<div class="table-wrap"><table><thead><tr><th>Page</th><th>Type</th><th class="num">Words</th><th class="num">Title len</th><th class="num">Desc len</th><th class="num">H2s</th><th class="num">Int. links</th><th>Updated</th><th>Issues</th></tr></thead><tbody>' +
        list.map(function (x) {
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
      var cols = [{ k: "title", label: "Page" }, { k: "link", label: "URL" }, { k: "type", label: "Type" }, { k: "words", label: "Words" }, { k: "metaTitle", label: "Title tag" }, { k: "metaDesc", label: "Meta description" }, { k: "modified", label: "Updated" }, { label: "Issues", compute: function (r) { return r.issues.join("; "); } }];
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
          storeAudit(pages, site);
          status.innerHTML = '<div class="notice info">Audit finished. ' + pages.length + " items checked.</div>";
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

    main.appendChild(el('<div class="notice info"><b>Pushing changes to the site</b> isn\'t switched on yet. The hub only reads from WordPress for now. Writing back needs a WordPress application password, set up by Matt, and we\'ll add it once the audit is working.</div>'));
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

  /* ---------- shell ---------- */
  function updateNav() {
    var counts = {
      leads: openLeads().filter(function (l) { return l.nextDate && l.nextDate <= today(); }).length,
      inbox: getRows("inbox").filter(function (m) { return m.state === "Needs you"; }).length
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
