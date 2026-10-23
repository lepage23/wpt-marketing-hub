/* WPT Marketing Hub
   Plain JavaScript, no build step. Data is saved in this browser (localStorage) until
   shared storage is added. Each page is a render function registered in PAGES. */
(function () {
  "use strict";

  var VERSION = "0.31.0";
  var BUILT = "2026-10-23 07:47 BST";
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

    var openRows = {};
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
        return '<textarea id="' + id + '" data-k="' + c.k + '" rows="1" class="cell' + (c.wide ? " wide" : "") + (cfg.compact ? " clamp" : "") + '" aria-label="' + esc(c.label) + '">' + esc(v) + "</textarea>";
      }
      var t = c.type === "number" ? "number" : c.type === "date" ? "date" : "text";
      return '<input id="' + id + '" data-k="' + c.k + '" type="' + t + '" value="' + esc(v) + '"' + (c.num ? ' style="text-align:right"' : "") + ' aria-label="' + esc(c.label) + '">';
    }
    function render() {
      if (!rows.length) {
        tableBox.innerHTML = '<div class="empty">' + esc(cfg.emptyText || "Nothing here yet.") + "</div>";
      } else {
        var h = "<table" + (cfg.compact ? ' class="compact"' : "") + "><thead><tr>" + (cfg.compact ? "<th></th>" : "") + cfg.columns.map(function (c) {
          return '<th class="' + (c.num || c.compute ? "num" : "") + '">' + esc(c.label) + "</th>";
        }).join("") + "<th></th></tr></thead><tbody>";
        rows.forEach(function (r) {
          h += '<tr data-id="' + r._id + '"' + (openRows[r._id] ? ' class="open"' : "") + ">" + (cfg.compact ? '<td class="row-lead"><button type="button" class="btn small danger" data-del="1" aria-label="Remove this row">Remove</button><button type="button" class="btn small' + (cfg.detail && r[cfg.detail.k] ? " has" : "") + '" data-more="1">' + (openRows[r._id] ? "Hide" : cfg.detail ? "Brief" : "More") + "</button></td>" : "") + cfg.columns.map(function (c) {
            return '<td class="' + (c.num || c.compute ? "num" : "") + '">' + cellInput(c, r) + "</td>";
          }).join("") + '<td class="row-actions">' +
            (r._ex ? '<span class="chip ex" title="Example row. Replace or delete it.">example</span> ' : "") +
            (cfg.actions || []).map(function (a, i) { return '<button type="button" class="btn small" data-act="' + i + '">' + esc(a.label) + "</button> "; }).join("") +
            (cfg.compact ? "" : '<button type="button" class="btn small danger" data-del="1" aria-label="Delete row">Delete</button>') + "</td></tr>";
          if (cfg.detail) {
            var dv = r[cfg.detail.k] || "";
            h += '<tr class="detail" data-id="' + r._id + '"' + (openRows[r._id] ? "" : " hidden") + '><td></td><td colspan="' + (cfg.columns.length + 1) + '"><label class="field" for="' + cfg.key + "-" + r._id + '-detail">' + esc(cfg.detail.label) +
              '<textarea id="' + cfg.key + "-" + r._id + '-detail" data-k="' + cfg.detail.k + '" class="detail-box" placeholder="' + esc(cfg.detail.placeholder || "") + '">' + esc(dv) + "</textarea></label></td></tr>";
          }
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
      if (e.target.hasAttribute("data-more")) {
        var open = tr.classList.toggle("open"); openRows[id] = open;
        e.target.textContent = open ? "Hide" : cfg.detail ? "Brief" : "More";
        var det = tr.nextElementSibling;
        if (det && det.classList.contains("detail")) { det.hidden = !open; var db = det.querySelector("textarea"); if (open && db) { db.style.height = "auto"; db.style.height = Math.min(db.scrollHeight + 4, 520) + "px"; } }
        Array.prototype.forEach.call(tr.querySelectorAll("textarea.cell"), fitCell); return;
      }
      if (e.target.hasAttribute("data-del")) {
        if (cfg.compact && !e.target.dataset.sure) { e.target.dataset.sure = "1"; e.target.textContent = "Sure?"; setTimeout(function () { if (e.target.isConnected) { delete e.target.dataset.sure; e.target.textContent = "Remove"; } }, 4000); return; }
        rows = rows.filter(function (x) { return x._id !== id; }); persist(); render(); toast(cfg.compact ? "Removed" : "Row deleted");
      }
      var a = e.target.getAttribute("data-act");
      if (a != null) cfg.actions[a].run(rows.find(function (x) { return x._id === id; }));
    });
    tools.addEventListener("click", function (e) {
      if (e.target.classList.contains("primary")) {
        var r = { _id: uid() }; cfg.columns.forEach(function (c) { if (!c.compute) r[c.k] = c.type === "select" ? c.options[0] : c.type === "date" ? today() : ""; });
        if (cfg.newRow) cfg.newRow(r);
        rows.unshift(r); persist(); render();
      }
      if (e.target.hasAttribute("data-copy")) copyText(toCsv(cfg.detail ? cfg.columns.concat([{ k: cfg.detail.k, label: "Lead brief" }]) : cfg.columns, rows), "CSV copied");
      if (e.target.hasAttribute("data-dl")) download((cfg.csvName || cfg.key) + "-" + today() + ".csv", toCsv(cfg.detail ? cfg.columns.concat([{ k: cfg.detail.k, label: "Lead brief" }]) : cfg.columns, rows));
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
    { k: "reach", label: "Phone / email" },
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
    { id: "progress", label: "Progress & change log", render: renderProgress },
    { id: "jobs", label: "Your jobs", render: renderJobs },
    { id: "leads", label: "Leads", render: renderLeads },
    { id: "email", label: "Email campaigns", render: renderEmail },
    { id: "chat", label: "Live chat", render: renderChat },
    { id: "brief", label: "Weekly brief", render: renderBrief },
    { id: "inbox", label: "Inbox triage", render: renderInbox },
    { id: "guide", label: "User guide", render: renderGuide }
  ];

  /* The user guide (USER-GUIDE.html in this folder), shown inside the hub. */
  function renderGuide(main) {
    main.innerHTML = head("How to use the hub", "User guide", "Every page, which buttons change the website, and what to do when something goes wrong.",
      '<a class="btn" href="USER-GUIDE.html" target="_blank" rel="noopener">Open in a new tab</a>');
    var frame = el('<iframe class="guide-frame" src="USER-GUIDE.html" title="User guide"></iframe>');
    main.appendChild(frame);
  }

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
    }).concat((function () { var fs = fixState(); return proposals().filter(function (p) { return !p.example && isDueBackFix(fs[p.id]); }).map(function (p) {
      var st = fs[p.id];
      return { chip: '<span class="chip info">Fix</span>', t: p.issue || p.pageTitle || "Fix", s: "Back from In progress, next action due " + fmtDay(st.nextDate) + (st.progressNote ? " · " + st.progressNote : "") };
    }); })()).concat(inbox.slice(0, 5).map(function (m) {
      return { chip: '<span class="chip ' + (m.category === "Lead" ? "flag" : m.category === "Complaint" ? "bad" : "info") + '">' + esc(m.category) + "</span>", t: m.subject, s: m.from + " · " + (m.why || "") };
    }));
    p1.appendChild(el(items.length ? '<div class="list">' + items.map(function (i) {
      return '<div class="list-item">' + i.chip + '<div><div class="t">' + esc(i.t) + '</div><div class="s">' + esc(i.s) + "</div></div><span></span></div>";
    }).join("") + "</div>" : '<div class="empty">Nothing due. Good time for SEO work.</div>'));
    var p2 = panel("Website", audit ? "Last audit " + audit.when : "No audit run yet.");
    p2.appendChild(el('<div class="row"><a class="btn primary" href="#seo" data-seotab="audit">' + (audit ? "Open website & SEO" : "Run the first page audit") + "</a></div>"));
    if (audit) {
      var worst = audit.pages.slice().sort(function (a, b) { return b.issues.length - a.issues.length; }).slice(0, 4);
      p2.appendChild(el('<div class="list">' + worst.map(function (p) {
        return '<div class="list-item"><span class="chip ' + (p.issues.length ? "flag" : "good") + '">' + p.issues.length + '</span><div><div class="t">' + esc(p.title) + '</div><div class="s">' + esc(p.issues.slice(0, 2).join(", ") || "No issues") + "</div></div><span></span></div>";
      }).join("") + "</div>"));
    }
    grid.appendChild(p1); grid.appendChild(p2); main.appendChild(grid);
    var gu = el('<div id="today-google"></div>'); grid.insertAdjacentElement("beforebegin", gu);
    gu.innerHTML = updateNotice(load("google-updates", null));
    googleUpdates(false).then(function (d) { if (gu.isConnected) gu.innerHTML = updateNotice(d); }, function () { /* the status page is optional */ });
  }
  function stat(n, label, flag) {
    return '<div class="stat' + (flag ? " flag" : "") + '"><span class="n">' + esc(n) + '</span><span class="l">' + esc(label) + "</span></div>";
  }


  /* Progress for long checks: a bar, the percentage, time left and a rough finish time.
     Time left starts from a guess per item, then uses the real pace once items finish,
     and counts down every second between updates. */
  function fmtDur(ms) {
    var t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    if (h) return h + " hr " + m + " min";
    if (m) return m < 10 ? m + " min " + sec + " sec" : m + " min";
    return sec + " sec";
  }
  function progressText(done, total, startedAt, perGuess, now) {
    var pct = total ? Math.min(100, Math.floor(done / total * 100)) : 0, el = now - startedAt, left;
    if (done > 0) left = el / done * (total - done);
    else left = Math.max(0, perGuess * total - el);
    return { pct: pct, elapsed: fmtDur(el), left: left, leftText: done >= total ? "" : left < 5000 ? "Nearly done" : "About " + fmtDur(left) + " left", finish: new Date(now + left) };
  }
  function makeProgress(box, label, total, perGuess) {
    var started = Date.now(), done = 0, detail = "", stamp = started, timer = null, closed = false, mine = null;
    function draw() {
      if (closed) return;
      /* Stop if the box has gone, or something else has written into it (an error or the result). */
      if (!box.isConnected || (mine && box.firstElementChild !== mine)) { stopTimer(); closed = true; return; }
      var now = Date.now(), p = progressText(done, total, started, perGuess, stamp);
      var left = Math.max(0, p.left - (now - stamp));
      var leftText = done >= total ? "Finishing off…" : left < 5000 ? "Nearly done" : "About " + fmtDur(left) + " left";
      var finish = new Date(stamp + p.left).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      box.innerHTML = '<div class="notice info progress"><div class="prog-top"><span>' + esc(label) + " " + Math.floor(done) + " of " + total + (detail ? '<span class="muted"> · ' + esc(detail) + "</span>" : "") + '</span><b class="mono">' + p.pct + "%</b></div>" +
        '<div class="prog-bar" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.pct + '"><span style="width:' + p.pct + '%"></span></div>' +
        '<div class="prog-meta muted mono">' + esc(leftText) + (done < total && left >= 5000 ? " · done by about " + finish : "") + " · " + fmtDur(now - started) + " so far</div></div>";
      mine = box.firstElementChild;
    }
    function stopTimer() { if (timer) clearInterval(timer); timer = null; }
    timer = setInterval(draw, 1000); draw();
    return {
      step: function (d, t, det) { done = d; if (t) total = t; if (det != null) detail = det; stamp = Date.now(); draw(); },
      note: function (det) { detail = det; draw(); },
      close: function () { stopTimer(); closed = true; }
    };
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
      '<div class="row"><a class="btn" href="#progress">Progress report</a><a class="btn primary" href="#fixes">Fix queue (' + pendingFixes().length + " waiting)</a></div>");
    renderWpConnect(main);
    renderPerformance(main);
    renderGoogleUpdates(main);
    renderGa4(main);
    renderMobile(main);
    renderDisplayCheck(main);
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
      save("seo-audit", audit); recordSnapshot(audit); drawAudit(audit); updateNav();
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
          var bar = null;
          function phase(label, guess) { if (bar) bar.close(); bar = null; return function (d, n) { if (!bar) bar = makeProgress(status, label, n, guess); bar.step(d, n); }; }
          var prog = phase("Checking live pages", 1500);
          return checkUrls(pages.map(function (p) { return p.link; }), prog).then(function (live) {
            var targets = applyLive(pages, live);
            return (targets.length ? checkUrls(targets, phase("Checking where redirects lead", 1500)) : Promise.resolve({})).then(function (live2) {
              targets.forEach(function (u) { pages.push(liveOnlyRow(u, live2[norm(u)])); });
              if (bar) bar.close(); bar = null;
              status.innerHTML = '<div class="notice info">Checking the site: robots.txt, sitemap, redirects and links…</div>';
              return siteAudit(pages, phase("Checking extra addresses found on the site", 1500)).then(function (res) {
                if (bar) bar.close();
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
                if (bar) bar.close();
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

    var ai = panel("AI search visibility: results", "One row per answer you check. Pinned competitors: " + (window.WPT_AI_COMPETITORS || []).join(", ") + ".");
    if (!load("ai-vis-examples-cleared", false)) { save("ai-visibility", (load("ai-visibility", null) || []).filter(function (r) { return !r._ex; })); save("ai-vis-examples-cleared", true); }
    var aiResults = editableTable({
      key: "ai-visibility", csvName: "ai-visibility", addLabel: "Add result",
      emptyText: "No results yet. Use Log a result on this week's prompts above.",
      columns: [
        { k: "q", label: "Question asked" },
        { k: "engine", label: "Where", type: "select", options: ["ChatGPT", "Google AI Overview", "Gemini", "Perplexity", "Copilot", "Claude"] },
        { k: "named", label: "WPT named?", type: "select", options: ["Not checked", "Yes", "Partly", "No"] },
        { k: "pos", label: "Position", type: "number", num: true },
        { k: "cited", label: "WPT page cited" },
        { k: "others", label: "Who was named instead" },
        { k: "citedOthers", label: "Their pages cited" },
        { k: "checked", label: "Checked", type: "date" }
      ],
      seed: []
    });
    ai.appendChild(aiResults.node);

    syncAiPrompts();
    var wk = aiWeekPrompts(getRows("ai-prompts"), new Date());
    var weekP = panel("AI visibility: this week's prompts", "Week " + wk.week + ". Ten of the " + wk.total + " prompts. All of them get asked every three weeks.");
    var howOpen = load("ai-how-open", true);
    var how = el('<details class="ai-how"' + (howOpen ? " open" : "") + '><summary>How to do this week\'s check (about 20 minutes)</summary><ol>' +
      "<li><b>Copy</b> a prompt. It copies just the question.</li>" +
      "<li>Paste it, exactly as it is, into <b>ChatGPT</b> and <b>Google</b>. Add Copilot and Perplexity if you have time. Don't add anything about West Pier.</li>" +
      '<li class="ai-warn"><b>Your own ChatGPT knows you work at West Pier</b>, so it will rank you higher than a buyer would see. Use a <b>Temporary chat</b> and leave it on <b>Non-personalized</b> (the default, top right). Or open chatgpt.com in a private window without logging in.</li>' +
      "<li>Copy the whole answer. In ChatGPT, use the copy icon under the answer. In Google, select the AI Overview text and copy it.</li>" +
      "<li>Click <b>Log a result</b>, pick where the answer came from, paste it in and click <b>Score it</b>.</li>" +
      "<li>Check the scores. Change anything that's wrong, then <b>Save</b>. The ticks show what's done.</li></ol><p class=\"muted\">Answers change from one go to the next, even for the same question. One answer means little. The pattern over a few weeks is what counts.</p></details>");
    how.addEventListener("toggle", function () { save("ai-how-open", how.open); });
    weekP.appendChild(how);
    var CORE = ["ChatGPT", "Google AI Overview"];
    var wkStart = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDate(d); })();
    function doneFor(q) {
      var rows = getRows("ai-visibility").filter(function (r) { return r.q === q && r.checked >= wkStart && r.named !== "Not checked"; });
      return rows.map(function (r) { return r.engine; }).filter(function (e, i, a) { return a.indexOf(e) === i; });
    }
    var wl = el('<div class="panel-body"></div>');
    var logger = el('<div class="ai-logger" hidden></div>');
    var openId = null;
    function drawWeek() {
      if (!wk.list.length) { wl.innerHTML = '<div class="empty">No active prompts. Add some in the prompt list.</div>'; return; }
      var done = 0;
      var rowsHtml = wk.list.map(function (r) {
        var d = doneFor(r.q); done += CORE.filter(function (c) { return d.indexOf(c) > -1; }).length;
        var ticks = CORE.concat(d.filter(function (e) { return CORE.indexOf(e) < 0; })).map(function (e) {
          var on = d.indexOf(e) > -1;
          return '<span class="chip ' + (on ? "good" : "") + '">' + (on ? "✓ " : "") + esc(e === "Google AI Overview" ? "Google" : e) + "</span>";
        }).join(" ");
        return '<tr data-id="' + esc(r._id) + '"' + (r._id === openId ? ' class="open"' : "") + '><td class="num">' + esc(r.n) + "</td><td>" + esc(r.q) + '<div class="ai-ticks">' + ticks + "</div></td><td>" + esc(r.group) + "</td><td>" + esc(r.page) +
          '</td><td class="row-actions" style="white-space:nowrap"><button type="button" class="btn small" data-aicopy="1">Copy</button> <button type="button" class="btn small primary" data-ailog="1">Log a result</button></td></tr>';
      }).join("");
      var need = wk.list.length * CORE.length;
      wl.innerHTML = '<div class="ai-progress"><b>' + done + " of " + need + "</b> ChatGPT and Google checks done this week" + (done >= need ? ". All done." : ".") + "</div>" +
        '<div class="table-wrap"><table><thead><tr><th class="num">#</th><th>Prompt</th><th>Group</th><th>WPT page that should answer</th><th></th></tr></thead><tbody>' + rowsHtml + "</tbody></table></div>";
    }
    function openLogger(r) {
      openId = r._id;
      var engines = ["ChatGPT", "Google AI Overview", "Copilot", "Perplexity", "Gemini", "Claude"];
      var d = doneFor(r.q), next = engines.find(function (e) { return d.indexOf(e) < 0; }) || "ChatGPT";
      logger.hidden = false;
      logger.innerHTML = '<h3>Log a result</h3><p class="muted">' + esc(r.q) + '</p>' +
        '<div class="form-grid"><label class="field" for="ai-eng">Where the answer came from<select id="ai-eng">' + engines.map(function (e) { return "<option" + (e === next ? " selected" : "") + ">" + e + "</option>"; }).join("") + "</select></label></div>" +
        '<label class="field" for="ai-paste">Paste the whole answer here<textarea id="ai-paste" rows="8" placeholder="Copy the AI\'s full answer and paste it here, links and all."></textarea></label>' +
        '<div class="row"><button type="button" class="btn primary" id="ai-score">Score it</button><button type="button" class="btn" id="ai-cancel">Cancel</button></div><div id="ai-out"></div>';
      logger.querySelector("#ai-cancel").addEventListener("click", function () { logger.hidden = true; openId = null; drawWeek(); });
      logger.querySelector("#ai-score").addEventListener("click", function () {
        var text = logger.querySelector("#ai-paste").value;
        if (!text.trim()) { toast("Paste the answer first."); return; }
        var sc = scoreAiAnswer(text, window.WPT_AI_COMPETITORS || []);
        var out = logger.querySelector("#ai-out");
        out.innerHTML = '<div class="notice ' + (sc.named === "Yes" ? "good" : "info") + '">' +
          (sc.named === "Yes" ? "West Pier is named" + (sc.pos ? ", number " + sc.pos + " of " + sc.of + "." : ".") : sc.named === "Partly" ? "West Pier's website is linked, but the company isn't named." : "West Pier isn't named in this answer.") +
          (sc.pinned.length ? " Competitors named: " + esc(sc.pinned.join(", ")) + "." : "") + "</div>" +
          '<p class="muted">Check these and change anything that\'s wrong.</p><div class="form-grid">' +
          '<label class="field" for="ai-named">WPT named?<select id="ai-named">' + ["Yes", "Partly", "No"].map(function (o) { return "<option" + (o === sc.named ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></label>" +
          '<label class="field" for="ai-pos">Position<input id="ai-pos" type="number" min="1" value="' + esc(sc.pos) + '"></label>' +
          '<label class="field" for="ai-cited">WPT page cited<input id="ai-cited" value="' + esc(sc.cited) + '"></label>' +
          '<label class="field" for="ai-others">Who was named instead<input id="ai-others" value="' + esc(sc.others) + '"></label>' +
          '<label class="field" for="ai-cothers">Their pages cited<input id="ai-cothers" value="' + esc(sc.citedOthers) + '"></label></div>' +
          '<div class="row"><button type="button" class="btn primary" id="ai-save">Save</button></div>';
        out.querySelector("#ai-save").addEventListener("click", function () {
          var v = function (id) { return out.querySelector(id).value.trim(); };
          aiResults.add({ q: r.q, engine: logger.querySelector("#ai-eng").value, named: v("#ai-named"), pos: v("#ai-pos"), cited: v("#ai-cited"), others: v("#ai-others"), citedOthers: v("#ai-cothers"), checked: today(), answer: text.slice(0, 6000) });
          toast("Saved to results"); logger.hidden = true; openId = null; drawWeek();
        });
      });
      drawWeek();
      logger.scrollIntoView({ behavior: "smooth", block: "nearest" });
      logger.querySelector("#ai-paste").focus();
    }
    wl.addEventListener("click", function (e) {
      var tr = e.target.closest("tr"); if (!tr) return;
      var r = getRows("ai-prompts").find(function (x) { return x._id === tr.getAttribute("data-id"); }); if (!r) return;
      if (e.target.hasAttribute("data-aicopy")) copyText(r.q, "Prompt copied. Paste it into ChatGPT or Google.");
      if (e.target.hasAttribute("data-ailog")) openLogger(r);
    });
    drawWeek();
    weekP.appendChild(wl); weekP.appendChild(logger);
    main.appendChild(rank); main.appendChild(weekP); main.appendChild(ai);

    var plist = panel("AI visibility: prompt list", "Every buyer question we track, and the page that should win it. Set Active to No to stop asking one.");
    plist.appendChild(editableTable({
      key: "ai-prompts", csvName: "ai-prompts", addLabel: "Add prompt", compact: true,
      columns: [
        { k: "n", label: "#", type: "number", num: true },
        { k: "q", label: "Prompt" },
        { k: "group", label: "Group", type: "select", options: AI_GROUPS },
        { k: "page", label: "WPT page that should answer" },
        { k: "active", label: "Active", type: "select", options: ["Yes", "No"] }
      ],
      newRow: function (r) { r.n = getRows("ai-prompts").reduce(function (m, x) { return Math.max(m, Number(x.n) || 0); }, 0) + 1; r.group = "Local"; r.active = "Yes"; }
    }).node);
    main.appendChild(plist);

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
    seoTabs(main);
  }

  /* ---------- AI visibility: score a pasted answer ----------
     Paste a whole answer from ChatGPT, Google, Copilot or Perplexity. Works out whether WPT is named,
     where it comes in the list, who else is named and which websites are cited. */
  var AI_BRANDS = ["West Pier Technologies", "Focus Group", "Opus", "Yo Telecom", "Wavenet", "Techvu", "8x8", "RingCentral", "Zoom Phone", "Zoom",
    "Gamma Horizon", "Gamma", "BT Business", "Vodafone Business", "Virgin Media O2 Business", "Microsoft Teams", "Teams Phone", "3CX", "Avaya", "Mitel",
    "Vonage", "Dialpad", "Aircall", "NFON", "Daisy", "Nasstar", "Babble", "Onecom", "Webex", "Cisco", "Talkdesk", "Five9", "Genesys", "Natterbox", "Giacom",
    "Xoomtalk", "Chalvington Group", "Chalvington", "Fluent Group", "Start Communications", "Octotech", "T2K"];
  /* Picture links and site icons ChatGPT adds to its answers. Not sources, and not names. */
  var AI_JUNK_HOST = /^(images\.openai\.com|google\.com|gstatic\.com|encrypted-tbn\d*\.gstatic\.com)$/;
  var AI_NOT_A_NAME = /^(what|how|which|who|where|when|one question|pros|cons|price|pricing|cost|costs|why|best for|key|features?|summary|recommendation|recommended|tips?|notes?|considerations?|things to|questions? to|final|bottom line|support|setup|set-up|reviews?|location|website|contact|overview|conclusion|how to|what to|in short|tl;?dr|local|national|other|also|option|step|sources?|references?|quick|my|our|your|if you|here|for a|for an|ideal)\b/i;
  function aiMdText(t) { return String(t || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|__|`/g, "").replace(/\[\d+\]/g, "").trim(); }
  function aiNoWptLinks(t) { return String(t || "").replace(/(https?:\/\/)?(www\.)?westpierte(ch|le)\.com[^\s)\]]*/gi, " "); }
  function aiIsWpt(t) { return /west\s*pier/i.test(aiNoWptLinks(t)); }
  function aiHosts(text) {
    var urls = [], seen = {};
    text = String(text).replace(/https?:\/\/www\.google\.com\/s2\/favicons\?domain=(https?:\/\/[^\s&)\\]+)[^\s)]*/g, "$1");
    (String(text).match(/https?:\/\/[^\s)\]>"'<]+/g) || []).forEach(function (u) { u = u.replace(/[.,;:!?]+$/, ""); if (!seen[u]) { seen[u] = 1; urls.push(u); } });
    var bare = String(text).replace(/https?:\/\/[^\s)\]>"'<]+/g, " ").match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:co\.uk|org\.uk|com|uk|net|org|io)\b(?:\/[^\s)\]>"'<]*)?/gi) || [];
    bare.forEach(function (u) { u = "https://" + u.replace(/[.,;:!?]+$/, ""); if (!seen[u]) { seen[u] = 1; urls.push(u); } });
    var out = urls.map(function (u) {
      var m = u.match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return null;
      return { host: m[1].toLowerCase(), url: "https://" + m[1].toLowerCase() + (m[2] && m[2] !== "/" ? m[2].replace(/\/+$/, "/") : "/") };
    }).filter(Boolean);
    out = out.filter(function (h) { return !AI_JUNK_HOST.test(h.host); });
    /* A bare "site.com" next to a full link to the same site is just the link's label. */
    return out.filter(function (h) { return !(h.url === "https://" + h.host + "/" && out.some(function (o) { return o.host === h.host && o.url !== h.url; })); });
  }
  function scoreAiAnswer(text, pinned) {
    text = String(text || "");
    var known = AI_BRANDS.concat(pinned || []).filter(function (b, i, a) { return a.indexOf(b) === i; });
    function brandIn(t) {
      var hits = [];
      known.forEach(function (b) {
        var re = new RegExp("(^|[^a-z0-9])" + b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "(?![A-Za-z0-9])", "g"), m;
        while ((m = re.exec(t))) hits.push({ name: b, at: m.index + m[1].length, end: m.index + m[0].length });
      });
      if (aiIsWpt(t)) { var w = aiNoWptLinks(t).search(/west\s*pier/i); hits.push({ name: "West Pier Technologies", at: w, end: w + 9 }); }
      return hits.filter(function (h) { return !hits.some(function (o) { return o !== h && o.at <= h.at && o.end >= h.end && (o.end - o.at) > (h.end - h.at); }); });
    }
    function canon(n) {
      n = aiMdText(n).replace(/[.,;:!?]+$/, "").trim();
      if (aiIsWpt(n)) return "West Pier Technologies";
      var k = known.find(function (b) { return b.toLowerCase() === n.toLowerCase(); });
      return k || n;
    }
    /* 1. Names at the head of list items and headings, in order. */
    var listed = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (/^\s*\[[^\]]*\]\(https?:\/\/(images\.openai\.com|www\.google\.com\/s2)/.test(line)) return;
      var m = line.match(/^(?:#{1,6}\s+|\d{1,2}\\?[.)]\s+|[-*•]\s+)?(.*)$/);
      var marked = /^(#{1,6}\s+|\d{1,2}\\?[.)]\s+)/.test(line), rest = m ? m[1] : "";
      var bold = rest.match(/^\*\*([^*]{2,80})\*\*/) || rest.match(/^\[\*\*([^*]{2,80})\*\*\]/);
      var lead = /^[-*•]\s+/.test(line) || marked || /^\*\*/.test(line);
      if (!lead) return;
      var name;
      if (bold) name = bold[1];
      else if (marked) name = aiMdText(rest).split(/\s[–—-]\s|:|\(|,|\.\s|\s\|\s/)[0];
      else { var b = brandIn(rest.slice(0, 60)); if (!b.length || b[0].at > 2) return; name = b[0].name; }
      if (/\?/.test(name)) return;
      name = canon(name);
      var words = name.split(/\s+/).length;
      if (!name || name.length > 60 || words > 6 || /\?/.test(name) || AI_NOT_A_NAME.test(name) || !/^[A-Z0-9]/.test(name)) return;
      var inLine = brandIn(name); if (inLine.length) name = inLine[0].name === "West Pier Technologies" || aiIsWpt(name) ? "West Pier Technologies" : (inLine[0].name.length >= name.length - 4 ? inLine[0].name : name);
      if (!listed.some(function (x) { return x.toLowerCase() === name.toLowerCase(); })) listed.push(name);
    });
    /* 2. Every known brand, by first mention. */
    var mentioned = [];
    brandIn(text).sort(function (a, b) { return a.at - b.at; }).forEach(function (h) { if (mentioned.indexOf(h.name) < 0) mentioned.push(h.name); });
    var order = listed.length >= 2 ? listed : mentioned;
    var all = order.concat(mentioned.filter(function (b) { return !order.some(function (x) { return x.toLowerCase() === b.toLowerCase(); }); }));
    var hosts = aiHosts(text);
    var wptUrls = hosts.filter(function (h) { return /westpierte(ch|le)\./.test(h.host); }).map(function (h) { return h.url; });
    var otherHosts = []; hosts.forEach(function (h) { if (!/westpierte(ch|le)\./.test(h.host) && otherHosts.indexOf(h.host) < 0) otherHosts.push(h.host); });
    var nameHit = aiIsWpt(text), idx = order.indexOf("West Pier Technologies");
    return {
      named: nameHit ? "Yes" : wptUrls.length ? "Partly" : "No",
      pos: idx > -1 ? String(idx + 1) : "",
      of: order.length,
      cited: wptUrls.filter(function (u, i, a) { return a.indexOf(u) === i; }).join(" "),
      others: all.filter(function (b) { return b !== "West Pier Technologies"; }).join(", "),
      citedOthers: otherHosts.join(", "),
      pinned: (pinned || []).filter(function (p) { return all.indexOf(p) > -1; })
    };
  }

  /* ---------- Website & SEO tabs ----------
     The page has a lot of panels. Group them into tabs so only one group shows at a time.
     A panel is placed by its heading. Anything without a heading (notices) shows on every tab. */
  var SEO_TABS = [
    { id: "audit", label: "Audit", match: /^(Page audit|Find text on the site|Change log)/ },
    { id: "search", label: "Search and traffic", match: /^(Search performance|Google ranking updates|Website traffic and leads|Keyword rankings)/ },
    { id: "ai", label: "AI visibility", match: /^AI (search )?visibility/ },
    { id: "speed", label: "Speed and display", match: /^(Mobile and speed|Display check)/ },
    { id: "content", label: "Content plan", match: /^Content plan/ },
    { id: "wp", label: "WordPress connection", match: /^Connect WordPress/ }
  ];
  function seoTabOf(title) {
    if (!title) return null;
    var t = SEO_TABS.find(function (x) { return x.match.test(title); });
    return t ? t.id : "audit";
  }
  function seoTabs(main) {
    var head = main.firstElementChild;
    var items = Array.prototype.slice.call(main.children, 1).map(function (n) {
      var h = n.querySelector(".panel-head h2");
      return { node: n, tab: seoTabOf(h ? h.textContent.trim() : "") };
    });
    var cur = load("seo-tab", "audit");
    if (!SEO_TABS.some(function (t) { return t.id === cur; })) cur = "audit";
    var bar = el('<nav class="subtabs" aria-label="Website and SEO sections"></nav>');
    function show(id) {
      cur = id; save("seo-tab", id);
      items.forEach(function (it) { it.node.hidden = it.tab !== null && it.tab !== id; });
      bar.innerHTML = SEO_TABS.map(function (t) {
        var n = items.filter(function (it) { return it.tab === t.id; }).length;
        return n ? '<button type="button" data-tab="' + t.id + '"' + (t.id === id ? ' aria-current="true"' : "") + ">" + esc(t.label) + "</button>" : "";
      }).join("");
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]"); if (!b) return;
      show(b.getAttribute("data-tab"));
      var top = bar.getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > top) window.scrollTo(0, top);
    });
    head.insertAdjacentElement("afterend", bar);
    show(cur);
  }
  /* Links that point at one tab, like "Go to the page audit". */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-seotab]");
    if (a) save("seo-tab", a.getAttribute("data-seotab"));
  });


  /* ---------- Quick add: turn a pasted lead email or a rough note into a lead row ---------- */
  var FORM_LABELS = { "call": "call", "callback": "call", "contact": "name", "why it's hot": "why", "why its hot": "why", "why": "why", "name": "name", "full name": "name", "your name": "name", "contact name": "name", "first name": "first", "last name": "last", "surname": "last", "your email": "email", "work email": "email", "mobile": "phone", "company / organisation": "company", "business name": "company", "comments": "message", "how can we help?": "message", "how can we help": "message", "details": "message", "email": "email", "email address": "email", "phone": "phone", "telephone": "phone", "phone number": "phone",
    "company": "company", "company name": "company", "organisation": "company", "organization": "company", "product/service": "product", "product": "product", "service": "product",
    "location": "location", "source page": "page", "message": "message", "enquiry": "message", "submitted": "submitted", "ip address": "_skip", "user agent": "_skip" };
  var PRODUCTS = ["8x8", "3CX", "Gamma", "Horizon", "Zoom Phone", "Zoom", "Teams", "Avaya", "Mitel", "Xima", "SIP", "SoGEA", "FTTP", "Leased line", "Broadband", "Mobile", "Contact centre", "Call recording", "Cyber"];
  var PLACES = ["London", "Brighton", "Hove", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Sheffield", "Newcastle", "Nottingham", "Leicester", "Southampton", "Portsmouth", "Glasgow", "Edinburgh", "Cardiff", "Belfast", "Oxford", "Cambridge", "Reading", "Crawley", "Worthing", "Eastbourne", "Croydon", "Kent", "Surrey", "Sussex", "Essex", "Yorkshire", "Wales", "Scotland", "UK"];
  function isoDate(d) { return isNaN(d) ? "" : d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function addWorkDays(iso, n) { var d = new Date(iso + "T12:00:00"); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return isoDate(d); }
  function findProducts(t) {
    var hit = [];
    PRODUCTS.forEach(function (p) { if (new RegExp("(^|[^a-z0-9])" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)", "i").test(t) && !hit.some(function (h) { return h.toLowerCase().indexOf(p.toLowerCase()) > -1; })) hit.push(p); });
    return hit;
  }
  function titleCase(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
  /* tom.snell@acme.co.uk -> Tom Snell. Only when the address looks like first.last. */
  function nameFromEmail(e) {
    var m = String(e || "").split("@")[0].match(/^([a-z]{2,})[._-]([a-z]{2,})$/i);
    return m ? titleCase(m[1]) + " " + titleCase(m[2]) : "";
  }
  /* acme-group.co.uk -> Acme Group. Skips webmail. */
  function companyFromEmail(e) {
    var d = String(e || "").split("@")[1] || "";
    if (!d || /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|aol|btinternet|sky|virginmedia|talktalk|protonmail)\./i.test(d)) return "";
    return d.split(".")[0].split(/[-_]/).map(titleCase).join(" ");
  }
  function clip(t, n) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t; }
  /* Drop greetings and sign-offs so Notes is just the ask. */
  function tidyMsg(m) {
    return String(m || "").replace(/^\s*(hi|hello|dear|good (morning|afternoon|evening))\b[^\n.!,]{0,30}[,.!]?\s*/i, "")
      .replace(/\b(hope (you('| a)re|you are|all is) (well|good)[^.!]*[.!]\s*)/i, "")
      .replace(/\s*\b(thanks( (in advance|again|all))?|thank you|many thanks|kind regards|best regards|regards|cheers)[,.!]?(\s+[A-Z][\w'’-]+){0,3}\s*$/i, "").trim();
  }
  var SIGNOFF = /^(thanks( (in advance|again|all))?|thank you|many thanks|kind regards|best regards|best wishes|regards|best|cheers)[,.!]?$/i;
  var OWN = /westpierte(ch|le)|connor le ?page|garry bloomfield|mark james/i;
  /* Pasted text from ChatGPT, Outlook or a web page: turn [text](mailto:x) into x, drop citation links. */
  function cleanPaste(raw) {
    return String(raw || "").replace(/\r/g, "")
      .replace(/\[([^\]]+)\]\(mailto:[^)]+\)/g, "$1")
      .replace(/\s*\[([a-z0-9.-]{2,30})\]\(https?:[^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\(https?:[^)]+\)/g, "$1")
      .replace(/^[ \t]*[*•·][ \t]+/gm, "- ").trim();
  }
  /* "Section heading" followed by "- bullet" lines. Returns the bullets under the first heading that matches. */
  function section(lines, re) {
    var i = lines.findIndex(function (l) { return re.test(l) && !/^-\s/.test(l); });
    if (i < 0) return [];
    var out = [];
    for (var j = i + 1; j < lines.length; j++) {
      var l = lines[j];
      if (!l) { if (out.length) break; continue; }
      if (/^-\s/.test(l)) out.push(l.replace(/^-\s+/, ""));
      else if (out.length) break;
    }
    return out;
  }
  function parseLead(raw, todayIso) {
    todayIso = todayIso || today();
    var text = cleanPaste(raw);
    var lines = text.split("\n").map(function (l) { return l.trim(); });
    var f = {}, cur = null;
    lines.forEach(function (l) {
      var key = FORM_LABELS[l.toLowerCase().replace(/:$/, "")];
      var inline = l.match(/^([A-Za-z\/' ]{3,20}):\s*(.+)$/);
      if (key) { cur = key; if (!f[cur]) f[cur] = []; return; }
      if (inline && FORM_LABELS[inline[1].toLowerCase()] && OWN.test(inline[2])) { cur = null; return; }
      if (inline && FORM_LABELS[inline[1].toLowerCase()] && !/^(sent|from|to|cc|subject)$/i.test(inline[1])) {
        cur = FORM_LABELS[inline[1].toLowerCase()]; f[cur] = (f[cur] || []).concat(inline[2]); if (cur !== "message") cur = null; return;
      }
      if (cur && l) f[cur].push(l);
      else if (cur && !l && cur !== "message") cur = null;
    });
    Object.keys(f).forEach(function (k) { f[k] = f[k].join(k === "message" ? "\n" : " ").trim(); });
    if (!f.name && (f.first || f.last)) f.name = [f.first, f.last].filter(Boolean).join(" ");
    /* "Call: Yakub, 07885 624052" and "Callback for Garry: Yakub at Reliant" */
    if (!f.name && f.call) { var cm = f.call.match(/^([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,2})\s*[,(-]/); if (cm) f.name = cm[1]; }
    var headline = (text.match(/^(?:call ?back|follow ?up|lead)[^:\n]{0,30}:\s*([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)?)\s+(?:at|from)\s+(.+)$/im) || []);
    if (!f.name && headline[1]) f.name = headline[1];
    if (!f.company && headline[2]) f.company = headline[2].trim();
    var wants = section(lines, /^what (they|he|she) want|^requirements?\b|^what they need/i);

    /* Who's who. Skip anything that's WPT's own. */
    var emails = (text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).filter(function (e) { return !OWN.test(e); });
    var froms = lines.map(function (l) { return l.match(/^From:\s*(.*?)\s*<?([\w.+-]+@[\w.-]+)>?\s*$/i) || l.match(/^From:\s*(.+)$/i); }).filter(Boolean)
      .map(function (m) { return { name: (m[1] || "").replace(/["']/g, "").trim(), email: m[2] || "" }; })
      .filter(function (x) { return !OWN.test(x.name + " " + x.email); });
    var ours = function (ph) { return /3442645522|1273391200/.test(String(ph).replace(/\D/g, "")); };
    var phoneRe = /(\+44\s?\(?0?\)?\s?|\b0)\d[\d ]{8,11}\d\b/g;
    var phones = ((f.phone || "") + "\n" + text).match(phoneRe) || [];
    phones = phones.filter(function (ph) { return !ours(ph); });
    var email = f.email || (froms[0] && froms[0].email) || emails[0] || "";
    var phone = (phones[0] || "").trim();
    var users = (text.match(/\b(\d{1,5})[ -]?(users?|seats?|handsets|extensions)\b/i) || text.match(/\b(\d{1,5}) (staff|people|employees|sites|lines)\b/i) || [""])[0];

    var isForm = !!(f.name || f.email || f.company);
    var isEmail = !isForm && (froms.length > 0 || /^(subject|sent|to):/im.test(text) || /^(hi|hello|dear|good (morning|afternoon))\b/im.test(text));
    var lead = { date: todayIso, company: "", contact: "", reach: "", source: "Other", interest: "", status: "New", owner: "Garry", next: "Garry to make first contact", nextDate: "", notes: "" };
    var sent = text.match(/^Sent:\s*(.+)$/mi);
    var sentDate = sent ? isoDate(new Date(sent[1].replace(/^[A-Za-z]+,\s*/, ""))) : "";

    if (isForm) {
      lead.contact = f.name || nameFromEmail(email);
      lead.company = f.company || companyFromEmail(email);
      lead.source = /website lead|enquiry form|website form|source page/i.test(text) ? "Website form" : "Other";
      var sub = (f.submitted || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      lead.date = sub ? sub[3] + "-" + ("0" + sub[2]).slice(-2) + "-" + ("0" + sub[1]).slice(-2) : sentDate || todayIso;
      lead.interest = wants.length ? wants.map(function (w) { return clip(w.replace(/,?\s*starting with\s*(an?\s+)?/i, ", ").replace(/^must (work|integrate) with\s*/i, "works with ").replace(/\s*\(.*?\)/g, ""), 40); }).slice(0, 2).join("; ")
        : [f.product || findProducts(f.message || "").join(", "), users, f.location].filter(Boolean).join(", ");
      lead.notes = [f.why ? clip(f.why, 160) : "", clip(tidyMsg(f.message), 220), f.page ? "Came in on: " + clip(f.page.replace(/^https?:\/\/(www\.)?[^\/]+/, ""), 60) : ""].filter(Boolean).join("\n");
      if (/\b(3|three)\s+quotes?\b/i.test(f.message || "")) lead.next = "Garry to make first contact. Competitive: they need 3 quotes";
    } else if (isEmail) {
      /* A normal email or a whole thread. Newest message is on top, so only the top one decides
         who it's from and what the notes say. Older quoted messages are only used for products. */
      var seenBody = false, cut = lines.length;
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (!l) continue;
        var quote = /^On .{4,90}(wrote:?)?$/i.test(l) && /\d/.test(l) || /^-{2,}\s*(original|forwarded)/i.test(l) || /^>/.test(l) || /^_{5,}$/.test(l);
        if (seenBody && (quote || /^(from|sent):/i.test(l))) { cut = i; break; }
        if (/^(hi|hello|dear|good (morning|afternoon|evening))\b/i.test(l)) seenBody = true;
        else if (seenBody === false && !/^(from|to|cc|bcc|sent|date|subject):/i.test(l) && !/^(re|fw|fwd):/i.test(l) && !/<[^>]+@[^>]+>/.test(l) && !OWN.test(l) && /[a-z]{3}.*[.?!]$/i.test(l)) seenBody = true;
      }
      var top = lines.slice(0, cut);
      var topText = top.join("\n");
      /* Sender: "From: Name <email>", or a bare "Name <email>" line as Outlook copies it. */
      var sender = null;
      top.forEach(function (l) {
        if (sender) return;
        var m = l.match(/^(?:From:\s*)?["']?([^<>"@\n]{3,60}?)["']?\s*<([\w.+-]+@[\w.-]+)>/i);
        if (m && !OWN.test(m[1] + m[2])) sender = { name: m[1].replace(/^From:\s*/i, "").trim(), email: m[2] };
      });
      if (!sender && froms[0]) sender = froms[0];
      var bodyStart = top.findIndex(function (l) { return /^(hi|hello|dear|good (morning|afternoon|evening))\b/i.test(l); });
      var body = top.slice(bodyStart > -1 ? bodyStart : 0).filter(function (l) {
        return l && !/^(from|to|cc|bcc|sent|date|subject|phone|tel|mob|mobile|website|web|email|e):/i.test(l) && !/^(re|fw|fwd):/i.test(l) && !(OWN.test(l) && l.length < 40);
      });
      var signIdx = body.findIndex(function (l) { return SIGNOFF.test(l); });
      var sig = signIdx > -1 ? body.slice(signIdx + 1, signIdx + 6) : [];
      var msg = (signIdx > -1 ? body.slice(0, signIdx) : body).filter(function (l) { return !/^(hi|hello|dear|good (morning|afternoon|evening))\b.{0,30}$/i.test(l); }).join(" ");
      var NAME = /^[A-Z][a-z'’-]+(\s+[A-Z][a-z'’-]+){1,2}$/;
      var sigName = "", sigCo = "";
      sig.forEach(function (l) {
        var split = l.split(/\s+[\/|–-]\s+/);   /* "Tom Snell / Standard8" */
        if (!sigName && NAME.test(split[0]) && !OWN.test(l)) { sigName = split[0]; if (split[1]) sigCo = split[1]; }
      });
      if (!sigCo) sigCo = sig.filter(function (l) { return l !== sigName && /\b(ltd|limited|plc|llp|group|trust|council|school|academy|college|university|nhs|hospital|services|solutions|partners|associates|& co)\b/i.test(l); })[0] || "";
      var senderName = sender && sender.name && !/@/.test(sender.name) ? sender.name.replace(/^(.+),\s*(.+)$/, "$2 $1").replace(/\s*[\/|].*$/, "") : "";
      var topEmail = sender && sender.email || ((topText.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).filter(function (e) { return !OWN.test(e); })[0]) || email;
      email = topEmail;
      lead.contact = senderName || sigName || nameFromEmail(email);
      lead.company = sigCo || companyFromEmail(email);
      var subj = (text.match(/^Subject:\s*(?:(?:re|fw|fwd):\s*)*(.+)$/mi) || text.match(/^(?:(?:re|fw|fwd):\s*)+(.+)$/mi) || [])[1] || "";
      var prods = findProducts(subj + " " + msg);
      if (!prods.length) prods = findProducts(text);
      lead.interest = [prods.slice(0, 4).join(", "), users].filter(Boolean).join(", ") || clip(subj, 60);
      lead.notes = [clip(tidyMsg(msg), 220) || (subj ? "Re: " + clip(subj, 60) : ""), cut < lines.length ? "(Part of an email thread.)" : ""].filter(Boolean).join("\n");
      var topSent = topText.match(/^Sent:\s*(.+)$/mi);
      lead.date = (topSent && isoDate(new Date(topSent[1].replace(/^[A-Za-z]+,\s*/, "")))) || todayIso;
      lead.source = /website|enquiry form/i.test(subj) ? "Website form" : /referr/i.test(text) ? "Referral" : "Other";
      if (/\b(3|three)\s+quotes?\b/i.test(msg)) lead.next = "Garry to make first contact. Competitive: they need 3 quotes";
      else if (cut < lines.length && /\bquote/i.test(text)) lead.next = "Garry to follow up the quotes";
    } else {
      /* A rough note: "Name - Company - Place - phone - wants X - 14 users" */
      var chunks = text.split(/\s+[-–|]\s+|\n|;|,(?!\d{3})/).map(function (c) { return c.trim().replace(/^[-–]\s*|\s*[-–]$/g, ""); }).filter(Boolean);
      var used = {};
      chunks.forEach(function (c, i) { if (c.indexOf("@") > -1 || new RegExp(phoneRe.source).test(c)) used[i] = 1; });
      var place = "";
      chunks.forEach(function (c, i) { if (!used[i] && !place && PLACES.some(function (pl) { return pl.toLowerCase() === c.toLowerCase(); })) { place = c; used[i] = 1; } });
      var interestBits = [];
      chunks.forEach(function (c, i) { if (!used[i] && c.length < 60 && (findProducts(c).length || /\b\d+\s*(users|seats|staff|people|handsets|extensions|sites|lines)\b|^wants?\b|^needs?\b|^looking\b/i.test(c))) { interestBits.push(c.replace(/^(wants?|needs?|looking for)\s+/i, "")); used[i] = 1; } });
      var rest = chunks.filter(function (c, i) { return !used[i]; });
      var nameIdx = rest.findIndex(function (c) { return /^[A-Z][a-z'’-]+(\s+[A-Z][a-z'’-]+){1,2}$/.test(c) && !/\b(ltd|limited|shop|group|trust|plc|council|school|academy|services|solutions)\b/i.test(c); });
      if (nameIdx > -1) { lead.contact = rest[nameIdx]; rest.splice(nameIdx, 1); }
      if (rest.length && rest[0].length < 60) lead.company = rest.shift();
      lead.contact = lead.contact || nameFromEmail(email);
      lead.company = lead.company || companyFromEmail(email);
      lead.interest = interestBits.concat(place ? [place] : []).join(", ");
      lead.notes = clip(rest.join(". "), 300);
      lead.source = /website|form/i.test(text) ? "Website form" : /chat/i.test(text) ? "Live chat" : /referr/i.test(text) ? "Referral" : /called|rang|phone call/i.test(text) ? "Phone" : "Other";
    }
    lead.interest = clip(lead.interest, 70);
    var briefFrom = isForm && f.name && !f.call ? lines.findIndex(function (l) { return FORM_LABELS[l.toLowerCase().replace(/:$/, "")] === "name"; }) : -1;
    lead.brief = (briefFrom > 0 ? lines.slice(briefFrom).join("\n") : text).replace(/^\s*(ip address|user agent):.*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
    lead.reach = [phone, email].filter(Boolean).join(" · ");
    lead.nextDate = addWorkDays(todayIso, 1);
    return lead;
  }
  function sameLead(a, b) {
    var em = function (x) { return ((x.reach || "").match(/[\w.+-]+@[\w.-]+/) || [""])[0].toLowerCase(); };
    var co = function (x) { return String(x.company || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    return (em(a) && em(a) === em(b)) || (co(a).length > 3 && co(a) === co(b));
  }
  function quickAddPanel(onAdd) {
    var box = panel("Quick add", "Paste a lead email, or type a rough note like “Michael Smith - Guitartech shop - London - 07432 345434 - wants 3CX - 14 users”. It goes in as a new row for Garry. Check it and tweak any cell after.");
    var form = el('<div style="display:flex;flex-direction:column;gap:10px">' +
      '<label class="field" for="lead-drop">Lead details<textarea id="lead-drop" style="min-height:120px" placeholder="Paste the email or type the details here"></textarea></label>' +
      '<div class="row"><button type="button" class="btn primary" id="lead-add">Add lead</button><span class="muted" id="lead-msg" style="font-size:.86rem"></span></div></div>');
    box.appendChild(form);
    var ta = form.querySelector("#lead-drop"), msg = form.querySelector("#lead-msg");
    function add(force) {
      var raw = ta.value.trim();
      if (!raw) { msg.textContent = "Paste or type the lead first."; return; }
      var lead = parseLead(raw);
      if (!lead.company && !lead.contact && !lead.reach) { msg.textContent = "Couldn't pick out a name, company or contact details. Add one and try again."; return; }
      var dup = getRows("leads").filter(function (r) { return !r._ex && sameLead(r, lead); })[0];
      if (dup && !force) {
        msg.innerHTML = "Looks like this is already in: <b>" + esc(dup.company || dup.contact) + "</b> (" + esc(dup.status) + '). <button type="button" class="btn small" id="lead-force">Add anyway</button>';
        msg.querySelector("#lead-force").addEventListener("click", function () { add(true); });
        return;
      }
      onAdd(lead);
      ta.value = ""; msg.innerHTML = "Added <b>" + esc(lead.company || lead.contact) + "</b> for Garry, chase by " + esc(new Date(lead.nextDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })) + ".";
      toast("Lead added");
    }
    form.querySelector("#lead-add").addEventListener("click", function () { add(false); });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(false); });
    return box;
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
    var t = editableTable({ key: "leads", csvName: "wpt-leads", addLabel: "Add blank row", compact: true,
      detail: { k: "brief", label: "Lead brief (the full story: who they are, what they want, questions for the call)", placeholder: "Paste or write the full lead details here." }, columns: LEAD_COLS, seed: LEAD_SEED, onChange: drawCounts,
      emptyText: "No leads yet. Add one, or send a chat across from the Live chat page.", newRow: function (r) { r.owner = "Garry"; } });
    main.appendChild(quickAddPanel(function (lead) { t.set(t.get().filter(function (r) { return !r._ex; })); t.add(lead); }));
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
  var BRIEF_PROMPT = "Produce a weekly briefing for West Pier Technologies. Review westpiertech.com and search for major, consequential UK telecoms developments across unified communications, contact centre, business mobile, connectivity, IT services, cyber security, and AI automation. Include relevant public-sector and private-sector tenders, procurement notices, contract opportunities, partnership opportunities, and credible lead-generation signals. For each item, explain what changed, why it matters to West Pier Technologies, and practical campaign, content, outreach, positioning, or sales angles. Prioritise genuinely significant updates over minor industry noise, include dates and source links, and clearly separate: Big developments, Tenders and opportunities, Lead signals, Search and AI search changes, and Recommended marketing actions. For Search and AI search changes, check Google Search Central Blog, the Google Search Status Dashboard, the Bing Webmaster Blog, OpenAI's crawler documentation and Search Engine Land for changes in the last week to Google rankings, AI Overviews and AI Mode, Bing and Copilot, and ChatGPT search. Only include changes that affect a small B2B WordPress site, say what to check or change on westpiertech.com, and say \"Nothing this week\" if there is nothing worth acting on.";
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
    p.protected = !!r.protected; p.imgsNoAltList = r.imgs_no_alt || null;
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
      '<div class="list-item"><span class="chip info">Live</span><div>' + (a.checker && a.checkerVersion && a.checkerVersion < 5 ? '<span class="chip bad">Page checker out of date (version ' + a.checkerVersion + ' installed, 5 needed)</span><div class="s" style="margin-top:4px">Replace the code in Snippets, WPT Hub page checker, with everything from docs/wordpress-page-checker.php, then Save and test again. Until then the site checks, Search Console and page editing won\'t work.</div>' : a.checker && a.checkerVersion >= 5 && a.checkerVersion < 11 ? '<span class="chip flag">Page checker version ' + a.checkerVersion + ' (11 adds FAQ blocks; 10 adds the display check and page builds)</span><div class="s" style="margin-top:4px">Everything else works. To push FAQ blocks (and the display check, if older than version 10), replace the code in Snippets, WPT Hub page checker, with the latest from Copy page checker code.</div>' : a.checker ? '<span class="chip good">Page checker ready' + (a.checkerVersion ? " (version " + a.checkerVersion + ")" : "") + '</span><div class="s" style="margin-top:4px">The audit checks redirects and what visitors actually see on each page.</div>' : '<span class="chip flag">Page checker not added</span><div class="s" style="margin-top:4px">Add docs/wordpress-page-checker.php as a second snippet so the audit can spot redirected pages and read Elementor pages properly.</div>') + "</div><span></span></div>" +
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

  /* Every parent path of the given addresses, once each. */
  function parentPages(urls) {
    var out = [], seen = {};
    urls.forEach(function (u) {
      var m = String(u || "").match(/^(https?:\/\/[^\/]+)(\/.*)$/); if (!m) return;
      var parts = m[2].split("?")[0].split("#")[0].split("/").filter(Boolean);
      for (var i = parts.length - 1; i >= 1; i--) {
        var p = m[1] + "/" + parts.slice(0, i).join("/") + "/";
        if (!seen[p]) { seen[p] = true; out.push(p); }
      }
    });
    return out;
  }

  /* Run the site-wide check and extra address checks, then store everything on the audit. */
  function siteAudit(pages, prog) {
    return wpFetch("/wpt-hub/v1/site").then(function (site) {
      var status = {};
      pages.forEach(function (p) { if (p.liveStatus || p.live) status[norm(p.link)] = { status: p.liveStatus || 200, location: p.redirectTo || "" }; });
      var extra = [];
      function want(u) { var k = norm(u); if (!status[k] && extra.indexOf(u) < 0 && extra.length < 250) extra.push(u); }
      /* Parent pages first (/business-phone-systems/8x8/ for /business-phone-systems/8x8/brighton/).
         They hold the location link lists, so if the 250 cap fills before they are read,
         every page they link to looks like it has no links pointing to it. */
      parentPages(pages.map(function (p) { return p.link; })).forEach(want);
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

  /* Password-protected pages only show a form, so the audit leaves them out (page checker 13). */
  function indexable(p) { return !p.redirectTo && p.live && !p.noindex && !p.protected && load("protected-pages", {})[norm(p.link)] !== true; }
  function autoKey(u) { return norm(u).replace(/^[^\/]*/, "").replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home"; }
  function pageRef(p, note) { return { title: String(p.title || "").trim() || shortPath(p.link), link: p.link, note: note || "" }; }

  /* Two pages compete when they share at least two words that say what they're about, once the company
     name and generic words are taken out. A town page and the national page don't compete: one is local. */
  var BOILER = { west: 1, pier: 1, technologies: 1, tech: 1, telecom: 1, telecoms: 1, business: 1, businesses: 1, phone: 1, phones: 1, system: 1, systems: 1, uk: 1, solutions: 1, services: 1, provider: 1, providers: 1, guide: 1, complete: 1, best: 1, top: 1 };
  function aboutWords(t) { return titleWords(t).filter(function (w) { return !BOILER[w] && !/^(19|20)\d\d$/.test(w); }); }
  function townOf(t) { var m = String(t || "").replace(/\|.*$/, "").match(/\bin ([A-Z][\w&' -]+?)\s*$/); return m ? m[1].trim().toLowerCase() : ""; }
  function competes(ta, tb) {
    if (townOf(ta) !== townOf(tb)) return false;
    var a = aboutWords(ta), b = aboutWords(tb);
    if (a.length < 2 || b.length < 2) return false;
    var shared = a.filter(function (w) { return b.indexOf(w) > -1; }).length;
    return shared >= 2 && shared / Math.min(a.length, b.length) >= 0.75;
  }
  /* Titles: page name plus " | West Pier" when it fits, otherwise the page name on its own. */
  function shortTitle(p) {
    var name = String(p.title || "").replace(/\s*[|\u2013\u2014-]\s*West Pier.*$/i, "").trim();
    if (name.length < 15) return "";
    if ((name + " | West Pier").length <= 60) return name + " | West Pier";
    return name.length <= 60 ? name : "";
  }
  /* Long descriptions: keep whole sentences up to 160 characters. */
  function trimDesc(d) {
    var parts = String(d || "").split(/(?<=[.!?])\s+/), acc = "";
    for (var i = 0; i < parts.length; i++) { var next = acc ? acc + " " + parts[i] : parts[i]; if (next.length > 160) break; acc = next; }
    return acc.length >= 70 ? acc : "";
  }
  var LINK_TARGET_SKIP = /privacy|cookie|terms|contact|about|news|get-started|thank|careers|sitemap|feature-comparison/;
  function autoGroups(out, idx, ctx) {
    var kids = [], today = ctx.today;
    function parent(id) { return out.filter(function (x) { return x.id === id; })[0]; }
    function pt(p) { return p.type === "Post" ? "posts" : "pages"; }
    function group(id, label, list, left, leftWhy) {
      var par = parent(id); if (!par) return;
      if ((left || []).length) {
        kids.push({ id: id + "-claude", auto: true, type: "manual", created: today, batch: par.batch, category: par.category, priority: par.priority, pageTitle: "Whole site", link: par.link,
          issue: left.length + " page" + (left.length > 1 ? "s" : "") + " where the hub can't write the " + label.toLowerCase() + " itself", pages: left,
          why: leftWhy || "These need new wording rather than a trim, so Claude writes them. Copy the list and paste it to Claude; the fixes come back here ready to push.", steps: [] });
      }
      if (!list.length) { par._drop = true; return; }
      par.type = "group"; par.groupLabel = label;
      list.forEach(function (k) {
        kids.push(Object.assign({ parent: id, auto: true, created: today, batch: par.batch, category: par.category, priority: par.priority, size: "small", postType: "pages", pageId: 0, why: par.why }, k));
      });
    }
    var tl = [], tleft = [];
    idx.filter(function (p) { return (p.metaTitle || "").length > 60 && !ctx.claude["meta_title|" + norm(p.link)]; }).forEach(function (p) {
      var t = shortTitle(p);
      if (t) tl.push({ id: "t-" + autoKey(p.link), type: "meta_title", postType: pt(p), pageId: p.id || 0, pageTitle: p.title, link: p.link, issue: "Title is " + p.metaTitle.length + " characters", current: p.metaTitle, proposed: t,
        why: "Google shows about 60 characters. This keeps the page name, which is what people search for, and drops the long company name." });
      else tleft.push(pageRef(p, p.metaTitle.length + " characters, page name too long to use on its own"));
    });
    group("auto-titles-long", "Titles", tl, tleft);
    var dl = [], dleft = [];
    idx.filter(function (p) { var d = p.metaDesc || ""; return (d.length < 70 || d.length > 160) && !ctx.claude["meta_description|" + norm(p.link)]; }).forEach(function (p) {
      var t = (p.metaDesc || "").length > 160 ? trimDesc(p.metaDesc) : "";
      if (t) dl.push({ id: "d-" + autoKey(p.link), type: "meta_description", postType: pt(p), pageId: p.id || 0, pageTitle: p.title, link: p.link, issue: "Description is " + p.metaDesc.length + " characters", current: p.metaDesc, proposed: t,
        why: "Google cuts descriptions off around 160 characters. This keeps your own wording and ends on a full sentence." });
      else dleft.push(pageRef(p, (p.metaDesc || "").length ? p.metaDesc.length + " characters" : "no description"));
    });
    group("auto-desc-gap", "Descriptions", dl, dleft);
    group("auto-h1-multiple", "One H1", idx.filter(function (p) { return (p.h1 || []).length > 1; }).map(function (p) {
      return { id: "h1one-" + autoKey(p.link), type: "site_edit", op: "h1_one", postType: pt(p), pageId: p.id || 0, pageTitle: p.title, link: p.link, issue: p.h1.length + " H1s on the page",
        current: "H1s: " + p.h1.join(" / "), proposed: "Keeps \u201c" + p.h1[0] + "\u201d as the H1 and makes the others H2. The wording stays the same; those headings may look a little smaller. Undo puts them back." };
    }), []);
    var al = [], aleft = [];
    idx.filter(function (p) { return p.imagesNoAlt > 0; }).forEach(function (p) {
      if (!p.imgsNoAltList) { aleft.push(pageRef(p, "run the audit again with page checker 13 to list the images")); return; }
      if (!p.imgsNoAltList.length) return;
      al.push({ id: "alt-" + autoKey(p.link), type: "site_edit", op: "alt", postType: pt(p), pageId: p.id || 0, pageTitle: p.title, link: p.link, issue: p.imgsNoAltList.length + " images with no alt text",
        items: p.imgsNoAltList.map(function (src) { return { src: src, alt: altFromFile(src, p.title) }; }), current: p.imgsNoAltList.map(altFile).join("\n"),
        why: "Starting points come from each image's file name. Fix any that don't describe the picture, and blank out any you'd rather leave. Images that aren't in the Media Library (theme or other sites) are skipped." });
    });
    group("auto-alt", "Alt text", al, aleft, "Update the page checker to version 13 (Website & SEO, Copy page checker code), then run the audit again. The hub will list each image and write starting alt text you can push.");
    group("auto-links-redirected", "Link fixes", (ctx.toRedirect || []).map(function (r) {
      return { id: "relink-" + autoKey(r.link) + "-" + autoKey(r._from), type: "site_edit", op: "relink", params: { from: r._from, to: r._to }, postType: pt(r._page), pageId: r._page.id || 0, pageTitle: r.title, link: r.link,
        issue: "Links to an old address", current: r._from, proposed: "Points the link straight at " + r._to + ". The link text stays the same. Undo puts the old address back." };
    }), []);
    group("auto-redirect-temp", "Redirect fixes", (ctx.temp || []).filter(function (r) { return r._rid; }).map(function (r) {
      return { id: "redir301-" + r._rid, type: "site_edit", op: "redirect_code", siteWide: true, params: { redirect_id: r._rid }, pageTitle: r.title, link: r.link, issue: "Redirect " + r.note,
        current: r.title + " (" + r.note + ")", proposed: "Makes it a 301 permanent redirect in Rank Math. Undo sets it back." };
    }), []);
    group("auto-canonical", "Canonical fixes", idx.filter(function (p) { return p.canonical && norm(p.canonical) !== norm(p.link); }).map(function (p) {
      return { id: "canon-" + autoKey(p.link), type: "site_edit", op: "meta", params: { key: "rank_math_canonical_url", value: "" }, postType: pt(p), pageId: p.id || 0, pageTitle: p.title, link: p.link,
        issue: "Tells Google " + shortPath(p.canonical) + " is the real page", current: "Canonical: " + p.canonical, proposed: "Clears the canonical in Rank Math, so this page counts as itself. Skip it if the other page really is the one you want to rank. Undo puts it back." };
    }), []);
    /* Blog posts with few links: suggestions are found when the card opens (they need a search of the site). */
    var few = parent("auto-posts-few-links");
    if (few) {
      few.type = "group"; few.groupLabel = "Add links"; few.producer = "fewLinks";
      few.targets = idx.filter(function (p) { var path = shortPath(p.link); return p.type !== "Post" && path !== "/" && path.split("/").length <= 4 && !LINK_TARGET_SKIP.test(path) && !townOf(p.title); })
        .map(function (p) { return { title: p.title, link: p.link }; }).slice(0, 40);
      few.posts = idx.filter(function (p) { return (few.pages || []).some(function (x) { return norm(x.link) === norm(p.link); }); })
        .map(function (p) { return { title: p.title, link: p.link, links: (p.linksContent || []).map(norm) }; });
    }
    return kids;
  }
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
    if (site.blog_public === 0) out.push({ id: "auto-blog-public", auto: true, created: today, batch: "Found by audit", type: "site_edit", op: "option", siteWide: true, params: { key: "blog_public" }, size: "small", link: home, pageTitle: "Whole site",
      priority: "critical", category: "Indexing", issue: "WordPress is telling search engines not to index the site", current: "Settings, Reading: 'Discourage search engines' is ticked.", proposed: "Unticks it, so Google can index the site again. Undo ticks it again.",
      why: "Google may drop the whole site from results while this is ticked." });
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
      badInMap.filter(function (b) { return /^redirects to /.test(b.note); }).forEach(function (b) {
        var to = (status[norm(b.link)] || {}).location || "";
        out.push({ id: "auto-sitemap-draft-" + autoKey(b.link), auto: true, type: "set_status", status: "draft", size: "small", created: today, batch: "Found by audit", priority: "high", category: "Indexing",
          postType: "pages", pageId: 0, pageTitle: b.title, link: b.link, keepRedirect: to, issue: "Old address still in the sitemap",
          current: "Published, but visitors are redirected to " + shortPath(to), proposed: "Set the old page to draft. Visitors still get redirected to " + shortPath(to) + ", and the old address drops out of the sitemap.",
          why: "The sitemap should only list pages you want in Google. After pushing, the hub checks the redirect still works. If it doesn't, the page goes straight back to published and you're told why." });
      });
      badInMap = badInMap.filter(function (b) { return !/^redirects to /.test(b.note); });
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
      if (!homeRow.bingVerify) out.push({ id: "auto-verify-bing", auto: true, created: today, batch: "Found by audit", type: "site_edit", op: "option", siteWide: true, params: { key: "bing_verify" }, textParam: "value", size: "small", link: home, pageTitle: "Whole site",
        priority: "medium", category: "AI search", issue: "Can't see Bing Webmaster Tools verification", current: "No Bing code on the site.", proposed: "", inputLabel: "Bing's verification code",
        placeholder: "At bing.com/webmasters, add westpiertech.com, choose the HTML Meta Tag option and paste the tag or code here",
        why: "Bing's index feeds Microsoft Copilot. Paste the code and push: the hub puts it in Rank Math and Bing can verify straight away. If you verify by importing from Google Search Console instead, just Reject this." });
      var hs = homeRow.schema || [];
      if (!hs.some(function (t) { return /Organization|LocalBusiness|Corporation|ProfessionalService/.test(t); })) add({ id: "auto-schema-org", priority: "high", category: "AI search", issue: "Home page has no Organisation or LocalBusiness schema", link: homeRow.link,
        why: "This is the structured data that tells Google and AI tools who WPT is, where you are and how to contact you. It feeds the knowledge panel and AI answers about the business.", steps: ["Rank Math, then Titles & Meta, then Local SEO.", "Set 'Person or Company' to Company, fill in name, logo, address, phone 01273 391200 and opening hours.", "Save, purge the cache and run the audit again."] });
    }
    if (site.llms !== 200) out.push({ id: "auto-llms", auto: true, created: today, batch: "Found by audit", type: "site_edit", op: "llms", siteWide: true, textParam: "value", size: "small", link: home, pageTitle: "Whole site",
      priority: "low", category: "AI search", issue: "No llms.txt file", current: "(no llms.txt)", proposed: window.WPT_LLMS || "", placeholder: "The text for llms.txt",
      why: "llms.txt is a short plain-text summary of the site for AI tools: what you do, your key pages and how to contact you. Edit anything in the box, then publish. It goes live at westpiertech.com/llms.txt and Undo takes it down." });

    /* Redirect rules */
    var rules = (site.redirections || []).filter(function (r) { return r.status === "active"; });
    function abs(u) { return /^https?:/.test(u) ? u : home.replace(/\/$/, "") + "/" + String(u || "").replace(/^\//, ""); }
    var chains = [], dead = [], temp = [];
    rules.forEach(function (r) {
      var src = (r.sources || []).map(function (s) { return s.pattern; }).join(", ");
      var t = status[norm(abs(r.url_to))];
      if (t && t.status >= 300 && t.status < 400) chains.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "which redirects again to " + shortPath(t.location) });
      else if (t && t.status >= 400) dead.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "target answers " + t.status });
      if (String(r.header_code) === "302" || String(r.header_code) === "307") temp.push({ title: src + " → " + shortPath(r.url_to), link: abs(r.url_to), note: "uses " + r.header_code, _rid: r.id });
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
        else if (s.status >= 300 && s.status < 400) toRedirect.push({ title: p.title, link: p.link, note: "links to " + shortPath(u) + ", which redirects to " + shortPath(s.location), _page: p, _from: u, _to: s.location });
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
    noH1.forEach(function (r) {
      out.push({ id: "auto-h1-" + autoKey(r.link), auto: true, type: "elementor_h1", size: "small", created: today, batch: "Found by audit", priority: "high", category: "Structure",
        postType: "pages", pageId: 0, pageTitle: r.title, link: r.link, issue: "No H1 heading",
        current: "(no H1 on the live page)", proposed: "The first heading on the page becomes the H1. Its wording and colour stay the same.",
        why: "The H1 is the main heading that tells search engines and AI tools what the page is about. Only the tag on the top heading changes, its wording stays. It may look bigger afterwards, so check the page and use Undo if it looks wrong." });
    });
    var multiH1 = idx.filter(function (p) { return (p.h1 || []).length > 1; }).map(function (p) { return pageRef(p, p.h1.length + " H1s: " + p.h1.slice(0, 3).join(" / ")); });
    if (multiH1.length) add({ id: "auto-h1-multiple", priority: "medium", category: "Structure", issue: multiH1.length + " pages have more than one H1", pages: multiH1,
      why: "One clear main heading per page is easiest for search engines to read. Extra H1s blur what the page is about.", steps: ["Open each page in Elementor.", "Keep one main heading as H1 and change the others to H2.", "Run the audit again."] });
    var canon = idx.filter(function (p) { return p.canonical && norm(p.canonical) !== norm(p.link); }).map(function (p) { return pageRef(p, "canonical says " + shortPath(p.canonical)); });
    if (canon.length) add({ id: "auto-canonical", priority: "high", category: "Indexing", issue: canon.length + " pages tell Google a different address is the real one", pages: canon,
      why: "A canonical pointing elsewhere tells Google to ignore this page and rank the other address instead.", steps: ["Open each page, then Rank Math, then Advanced.", "Clear the Canonical URL box (or set it to the page's own address).", "Save and run the audit again."] });
    idx.concat(pages.filter(function (p) { return p.live && p.noindex; })).filter(function (p) { return p.noindex; }).forEach(function (p) {
      out.push({ id: "auto-noindex-" + norm(p.link).replace(/\W+/g, "-"), auto: true, created: today, batch: "Found by audit", type: "site_edit", op: "meta", params: { key: "rank_math_robots" }, size: "small",
        postType: p.type === "Post" ? "posts" : "pages", pageId: p.id || 0, priority: "high", category: "Indexing", pageTitle: p.title, link: p.link, issue: "Set to noindex, so it won't appear in Google",
        current: "Rank Math tells Google not to show this page.", proposed: "Removes noindex in Rank Math so Google can list the page. Its other robots settings stay as they are. Undo puts noindex back.",
        why: "If this is deliberate, choose Reject and it won't come back. If not, the page is invisible in search." });
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
      if (competes(a.title, b.title)) pairs.push([a, b]);
    }
    pairs.slice(0, 15).forEach(function (pr) {
      add({ id: "auto-cannibal-" + (norm(pr[0].link) + "-" + norm(pr[1].link)).replace(/\W+/g, "-").slice(0, 90), priority: "medium", category: "Content", pageTitle: pr[0].title, link: pr[0].link,
        issue: "May compete with \"" + pr[1].title + "\" for the same searches", pages: [pageRef(pr[0]), pageRef(pr[1])],
        why: "Two pages chasing the same search split the ranking between them, so often neither makes page one.", steps: ["Decide which page should rank for this topic.", "Either merge the other into it and redirect the old address (Rank Math, then Redirections, 301), or rewrite one so it targets a clearly different search.", "Tell Claude which, and it can write the changes."] });
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
    if (noOg.length) out.push({ id: "auto-og-image", auto: true, created: today, batch: "Found by audit", type: "site_edit", op: "option", siteWide: true, params: { key: "og_image" }, textParam: "value", size: "small", link: home, pageTitle: "Whole site",
      priority: "low", category: "Content", issue: noOg.length + " pages have no social sharing image", current: "No default image in Rank Math, so shares show a blank box.", proposed: "", inputLabel: "Address of the image to use",
      placeholder: "Media, then Library, open the image (your logo on brand colours works), click Copy URL to clipboard, paste it here",
      why: "One default image covers every page without its own. You choose the image; the hub sets it in Rank Math. Undo takes it off again." });
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

    /* Push-ready fixes for the cards above. Each card becomes a group the hub can push in one go. */
    var groupKids = autoGroups(out, idx, { toRedirect: toRedirect, temp: temp, today: today, claude: claude });
    out = out.filter(function (x) { return !x._drop; }).concat(groupKids);
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

  /* ---------- Google ranking updates ----------
     Read from Google's Search Status Dashboard. Public, no login, no cost.
     Shown on Today while an update is rolling out or settling, and listed on Search and traffic,
     so a drop in rankings can be checked against Google's own changes. */
  var GU_URL = "https://status.search.google.com/incidents.json";
  var GU_PAGE = "https://status.search.google.com/";
  var GU_SETTLE_DAYS = 14;
  function guDate(iso) { var t = new Date(iso); return isNaN(t) ? "" : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  function updateSummary(list, now) {
    now = now || Date.now();
    var all = (list || []).filter(function (i) { return i && i.begin && (!i.service_name || i.service_name === "Ranking"); }).map(function (i) {
      var b = Date.parse(i.begin), e = i.end ? Date.parse(i.end) : null;
      var state = !e || e > now ? "live" : now - e < GU_SETTLE_DAYS * 864e5 ? "settling" : "done";
      return { name: i.external_desc || "Google update", begin: i.begin, end: i.end || "", state: state, core: /core/i.test(i.external_desc || ""),
        link: i.uri ? "https://status.search.google.com/" + i.uri : GU_PAGE };
    }).sort(function (a, b) { return Date.parse(b.begin) - Date.parse(a.begin); });
    return { all: all, live: all.filter(function (u) { return u.state === "live"; }), settling: all.filter(function (u) { return u.state === "settling"; }) };
  }
  function updateLine(u) {
    if (u.state === "live") return "Rolling out since " + guDate(u.begin) + ". Rankings may jump about until it finishes.";
    if (u.state === "settling") return "Finished " + guDate(u.end) + ". Rankings can keep moving for about two weeks after.";
    return guDate(u.begin) + " to " + guDate(u.end);
  }
  function googleUpdates(force) {
    var c = load("google-updates", null);
    if (!force && c && Date.now() - c.at < 6 * 36e5) return Promise.resolve(c);
    return fetch(GU_URL, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("Google's status page answered " + r.status + "."); return r.json(); })
      .then(function (j) { var d = { at: Date.now(), list: Array.isArray(j) ? j : [] }; save("google-updates", d); return d; })
      .catch(function (e) { if (c) return c; throw e; });
  }
  function renderGoogleUpdates(main) {
    var p = panel("Google ranking updates", "Core and spam updates from Google's Search Status Dashboard. Check here first if rankings or clicks move suddenly.");
    var body = el('<div></div>'); p.appendChild(body); main.appendChild(p);
    function draw(d, err) {
      var s = updateSummary(d ? d.list : []);
      var rows = s.all.slice(0, 8).map(function (u) {
        var chip = u.state === "live" ? '<span class="chip flag">Rolling out</span>' : u.state === "settling" ? '<span class="chip info">Settling</span>' : '<span class="chip good">Done</span>';
        return '<div class="list-item">' + chip + '<div><div class="t"><a href="' + esc(u.link) + '" target="_blank" rel="noopener">' + esc(u.name) + '</a></div><div class="s">' + esc(updateLine(u)) + "</div></div><span></span></div>";
      }).join("");
      body.innerHTML = (err ? '<div class="notice">' + esc(err) + "</div>" : "") +
        (rows ? '<div class="list">' + rows + "</div>" : '<div class="empty">No updates loaded yet.</div>') +
        '<div class="row" style="margin-top:10px"><button type="button" class="btn" id="gu-refresh">Refresh</button>' +
        (d ? '<span class="muted mono" style="font-size:.78rem">Checked ' + esc(new Date(d.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</span>" : "") +
        '<a class="btn" href="' + GU_PAGE + '" target="_blank" rel="noopener">Open Google\'s dashboard</a></div>';
      body.querySelector("#gu-refresh").addEventListener("click", function () { go(true); });
    }
    function go(force) { googleUpdates(force).then(function (d) { draw(d); }, function (e) { draw(load("google-updates", null), "Couldn't reach Google's status page. " + e.message); }); }
    draw(load("google-updates", null)); go(false);
  }
  /* A notice for Today when an update is live or settling. Empty string when there's nothing to say. */
  function updateNotice(d, now) {
    var s = updateSummary(d ? d.list : [], now), u = s.live[0] || s.settling[0];
    if (!u) return "";
    return '<div class="notice' + (u.state === "live" ? "" : " info") + '"><b>Google ' + (u.state === "live" ? "is rolling out the " : "recently finished the ") + esc(u.name) + ".</b> " + esc(updateLine(u)) +
      " If clicks or positions move this week, this is the likely reason. Don't change pages just to chase it.</div>";
  }

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
  /* Security header checks don't change the score, so Google marks them "informative". Kept when they list a problem. */
  var PSI_KEEP_INFO = /^(has-hsts|csp-xss|clickjacking-mitigation|origin-isolation|trusted-types-xss)$/;
  var PSI_SKIP = /^(metrics|screenshot-thumbnails|final-screenshot|main-thread-tasks|network-requests|network-rtt|network-server-latency|diagnostics|script-treemap-data|resource-summary|largest-contentful-paint|first-contentful-paint|speed-index|total-blocking-time|cumulative-layout-shift|interactive|max-potential-fid|first-meaningful-paint)$/;
  function psiKey() { return load("psi-key", ""); }
  function psiData() { return load("psi", null); }
  function psiDesk() { return load("psi-desktop", true) !== false; }
  /* One page. Waits up to 2 minutes for Google, then tries again (up to 3 goes in all) when the
     failure looks temporary: no answer, Google busy (5xx) or the per-minute limit with a key. */
  var PSI_TIMEOUT = 120000, PSI_TRIES = 3, PSI_WAIT = [8000, 20000];
  function psiWait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function psiOnce(url, strategy) {
    var q = "?url=" + encodeURIComponent(url) + "&strategy=" + (strategy || "MOBILE") + "&category=PERFORMANCE&category=ACCESSIBILITY&category=SEO&category=BEST_PRACTICES" + (psiKey() ? "&key=" + encodeURIComponent(psiKey()) : "");
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, PSI_TIMEOUT) : null;
    return fetch(PSI_URL + q, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = (j.error && j.error.message) || ("Google answered " + r.status);
          var e = new Error(m); e.status = r.status;
          if (r.status === 429) { e.limit = true; e.message = psiKey() ? "Google's per-minute limit was hit. It tried again and gave up. Run the failed pages again in a minute." : "Google's limit for checks without a key has been reached. Add a free API key (steps above) and run it again."; }
          if (r.status === 400 && /API key|key not valid|API_KEY/i.test(m)) { e.badKey = true; e.message = "Google didn't accept the API key. Check it was copied in full and that PageSpeed Insights API is enabled for the WPT Hub project."; }
          if (r.status === 403) { e.badKey = true; e.message = "Google refused the key (" + m + "). Check the key's API restriction includes PageSpeed Insights API."; }
          throw e;
        }
        return summarisePsi(j);
      });
    }, function (err) {
      var e = new Error(err && err.name === "AbortError" ? "Google took more than 2 minutes to test this page." : "No answer from Google. Usually the connection dropped, the laptop slept, or Google gave up on a slow page.");
      e.network = true; throw e;
    }).then(function (r) { if (timer) clearTimeout(timer); return r; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function runPsi(url, tries, strategy) {
    tries = tries || 1;
    return psiOnce(url, strategy).catch(function (e) {
      var temporary = e.network || (e.status >= 500) || (e.limit && psiKey());
      if (!temporary || e.badKey || tries >= PSI_TRIES) { e.tries = tries; throw e; }
      return psiWait(PSI_WAIT[tries - 1] || 20000).then(function () { return runPsi(url, tries + 1, strategy); });
    });
  }
  function summarisePsi(j) {
    var lr = j.lighthouseResult || {}, cats = lr.categories || {}, audits = lr.audits || {};
    function sc(c) { return cats[c] && cats[c].score != null ? Math.round(cats[c].score * 100) : null; }
    function num(id) { return audits[id] && audits[id].numericValue != null ? audits[id].numericValue : null; }
    var fails = [];
    Object.keys(audits).forEach(function (id) {
      var a = audits[id];
      var info = PSI_KEEP_INFO.test(id) && a.details && a.details.items && a.details.items.length;
      if (!info && (PSI_SKIP.test(id) || a.score == null || a.score >= 0.9)) return;
      if (!info && !/^(binary|numeric|metricSavings)$/.test(a.scoreDisplayMode || "")) return;
      var items = ((a.details && a.details.items) || []).slice(0, 8).map(function (it) {
        var u = it.url || (it.node && it.node.snippet) || it.source || "";
        if (typeof u === "object") u = u.url || "";
        var text = it.description || it.severity || "";
        if (typeof text === "object") text = text.text || text.value || "";
        return { url: String(u).slice(0, 300), wasted: it.wastedBytes || it.wastedMs || 0, displayed: it.displayedAspectRatio || "", actual: it.actualAspectRatio || "", text: String(text).slice(0, 200) };
      });
      fails.push({ id: id, title: a.title || id, display: a.displayValue || "", score: a.score, items: items, value: a.numericValue != null ? a.numericValue : null });
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
    speedFixes(d).forEach(function (f) { out.push(f); });
    var today = new Date().toISOString().slice(0, 10);
    var rows = Object.keys(d.pages).map(function (u) { return { url: u, r: d.pages[u] }; }).filter(function (x) { return x.r && !x.r.error; });
    function add(o) { o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found by mobile check"; o.category = "Mobile"; o.pageTitle = o.pageTitle || "Mobile"; o.link = o.link || "https://westpiertech.com/"; out.push(o); }
    function pagesWith(fn) { return rows.filter(function (x) { return fn(x.r); }).map(function (x) { return { title: shortPath(x.url), link: x.url, note: fn(x.r) === true ? "" : String(fn(x.r)) }; }); }
    var squash = [];
    rows.forEach(function (x) { var f = failOf(x.r, "image-aspect-ratio"); if (f) f.items.forEach(function (it) { squash.push({ img: it.url, link: x.url, shape: it.displayed ? "shown " + it.displayed + " but really " + it.actual : "" }); }); });
    /* Each squashed image becomes its own push-ready image fix (fit inside the box, nothing cropped). */
    var claudeImg = {}; (window.WPT_PROPOSALS || []).forEach(function (f) { if (f.type === "elementor_style") claudeImg[norm(f.link) + "|" + f.find] = 1; });
    squash.forEach(function (sq) {
      var stem = fileName(sq.img).replace(/\.[a-z0-9]+$/i, "").replace(/-\d+x\d+$/, "").replace(/-scaled$/, "").toLowerCase();
      if (!stem || claudeImg[norm(sq.link) + "|" + stem]) return;
      out.push({ id: "mob-img-" + (shortPath(sq.link) + "-" + stem).replace(/\W+/g, "-").slice(0, 90), auto: true, created: today, batch: "Found by mobile check", category: "Mobile",
        type: "elementor_style", size: "small", priority: "high", postType: "pages", pageId: 0, pageTitle: shortPath(sq.link), link: sq.link, find: stem,
        set: { "object-fit": "contain", "object-fit_tablet": "contain", "object-fit_mobile": "contain", "object-position": "center center" },
        issue: "Squashed image: " + fileName(sq.img),
        current: fileName(sq.img) + (sq.shape ? " is " + sq.shape : " is shown at the wrong shape") + ", so it looks pinched or stretched.",
        proposed: "Same image, same box. Set to fit inside the box at its true shape (centred) on desktop, tablet and phone. Nothing is cropped. Nothing else on the page changes. Undo puts it back.",
        why: "An image forced into the wrong shape looks broken, especially on a phone, and Google counts it against the page's quality." });
    });
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
    var seenImg = {};
    rows.concat(Object.keys(d.desktop || {}).map(function (u) { return { url: u, r: d.desktop[u], dev: "desktop" }; }).filter(function (x) { return x.r && !x.r.error; })).forEach(function (x) {
      var f = failOf(x.r, "image-delivery-insight"); if (f) f.items.forEach(function (it) {
        var k = it.url + "|" + norm(x.url); if (it.wasted <= 50000 || seenImg[k]) return; seenImg[k] = 1;
        heavy.push({ title: fileName(it.url), link: x.url, note: "could save " + Math.round(it.wasted / 1024) + " KB on " + shortPath(x.url) + (x.dev ? " (desktop)" : "") });
      });
    });
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

  /* Grouped fixes for everything else Google flags, mobile and desktop together.
     One fix per problem, every affected page listed inside it. Most share one cause
     (theme, plugins, SiteGround settings), so one change clears them all. */
  var PSI_IDS = {
    render: /^(render-blocking-insight|render-blocking-resources)$/, unused: /^(unused-css-rules|unused-javascript)$/,
    cache: /^(cache-insight|uses-long-cache-ttl)$/, heavy: /^total-byte-weight$/, lowres: /^image-size-responsive$/,
    console: /^errors-in-console$/, headings: /^heading-order$/,
    headers: { "has-hsts": "HSTS", "clickjacking-mitigation": "clickjacking protection (X-Frame-Options)", "csp-xss": "a Content Security Policy", "origin-isolation": "origin isolation (COOP)", "trusted-types-xss": "Trusted Types" }
  };
  function speedFixes(d) {
    var out = [], today = new Date().toISOString().slice(0, 10);
    var sets = [{ dev: "mobile", pages: d.pages || {} }, { dev: "desktop", pages: d.desktop || {} }];
    function each(fn) { sets.forEach(function (st) { Object.keys(st.pages).forEach(function (u) { var r = st.pages[u]; if (r && !r.error) fn(u, r, st.dev); }); }); }
    function failing(r, re) { return (r.fails || []).filter(function (f) { return re.test(f.id); }); }
    /* Collect pages per problem; one line per page, noting mobile, desktop or both. */
    function group(re) {
      var by = {}, files = {};
      each(function (u, r, dev) {
        var fs = failing(r, re); if (!fs.length) return;
        var k = norm(u); by[k] = by[k] || { title: shortPath(u), link: u, notes: [] };
        by[k].notes.push(dev + ": " + fs.map(function (f) { return f.display || f.title; }).join(", "));
        fs.forEach(function (f) { f.items.forEach(function (it) { if (it.url && /^https?:/.test(it.url)) files[fileName(it.url)] = (files[fileName(it.url)] || 0) + 1; }); });
      });
      var pages = Object.keys(by).map(function (k) { var x = by[k]; return { title: x.title, link: x.link, note: x.notes.join(" · ") }; });
      var top = Object.keys(files).sort(function (a, b) { return files[b] - files[a]; }).slice(0, 6);
      return { pages: pages, top: top };
    }
    function add(o) { o.auto = true; o.type = "manual"; o.created = today; o.batch = "Found by speed check"; o.pageTitle = o.pageTitle || "Whole site"; o.link = o.link || (o.pages[0] && o.pages[0].link) || "https://westpiertech.com/"; out.push(o); }
    function topLine(t) { return t.length ? "The files Google names most often: " + t.join(", ") + "." : ""; }

    /* Main content slow to appear (LCP). Google's line: good under 2.5 s, poor over 4 s. Caught even when the overall score looks fine. */
    var lcp = {}, worst = 0;
    each(function (u, r, dev) {
      if (r.lcp == null || r.lcp <= 2500) return;
      var k = norm(u); lcp[k] = lcp[k] || { title: shortPath(u), link: u, notes: [], ms: 0 };
      lcp[k].notes.push(dev + " " + (r.lcp / 1000).toFixed(1) + " s"); lcp[k].ms = Math.max(lcp[k].ms, r.lcp); worst = Math.max(worst, r.lcp);
    });
    var lcpPages = Object.keys(lcp).map(function (k) { return lcp[k]; }).sort(function (a, b) { return b.ms - a.ms; }).map(function (x) { return { title: x.title, link: x.link, note: "main content after " + x.notes.join(", ") }; });
    if (lcpPages.length) add({ id: "spd-lcp", category: "Speed", priority: worst > 4000 ? "high" : "medium", issue: lcpPages.length + " pages are slow to show their main content", pages: lcpPages,
      why: "Largest Contentful Paint (LCP) is when the biggest thing on screen, usually the hero image or heading, appears. Google wants it under 2.5 seconds and counts it towards rankings. A page can score 60 overall and still take 13 seconds here, so this is listed even when the score looks fine. Worst first.",
      steps: ["Clear the render-blocking and unused code fixes in this queue first. They are usually what holds the main content back.", "Make sure the hero image isn't lazy loaded: in SiteGround Optimizer, Media, add the hero images to the lazy load exclusions, or in Elementor set the first image's loading to eager.", "Keep hero images under about 200 KB, in WebP.", "Run the speed check again."] });

    var g = group(PSI_IDS.render);
    if (g.pages.length) add({ id: "spd-render-blocking", category: "Speed", priority: "high", issue: "Files stop " + g.pages.length + " pages showing until they've loaded", pages: g.pages,
      why: "The browser can't draw anything until these CSS and JavaScript files arrive. On a phone that can add 3 seconds or more before anything appears. They come from the theme, Elementor and plugins, so one set of settings fixes every page. " + topLine(g.top),
      steps: ["SiteGround Optimizer, then Frontend, then CSS: turn on Minify CSS, Combine CSS and Preload Combined CSS.", "Same place, JavaScript: turn on Minify JavaScript and Defer Render-blocking JavaScript.", "Elementor, then Settings, then Features: turn on Improved CSS Loading and Inline Font Icons.", "Check a few pages look right on phone and desktop after each change. If one breaks, untick the last setting.", "Run the speed check again."] });

    g = group(PSI_IDS.unused);
    if (g.pages.length) add({ id: "spd-unused-code", category: "Speed", priority: "medium", issue: g.pages.length + " pages load CSS and JavaScript they never use", pages: g.pages,
      why: "Every page downloads code for features it doesn't have, usually plugins that load everywhere. Phones pay for it in time and data. " + topLine(g.top),
      steps: ["Ask Matt to check which plugins load on every page (the files above show which). Chat widgets, sliders and form plugins are common culprits.", "In Elementor, Settings, then Features, turn on Optimized Control Loading and Element Caching.", "Remove any plugin that isn't used. Deactivate first, check the site, then delete.", "Run the speed check again."] });

    g = group(PSI_IDS.cache);
    if (g.pages.length) {
      add({ id: "spd-cache", category: "Speed", priority: "low", issue: g.pages.length + " pages have files that browsers re-download on every visit", pages: g.pages,
        why: "Files with short cache times get fetched again on each visit, so returning visitors wait longer. Files from other companies (Google, chat widgets) can't be changed from our side, so only fix our own. " + topLine(g.top),
        steps: ["SiteGround Optimizer, then Environment: check Browser Caching is on.", "Ask Matt whether any of the files above come from westpiertech.com. If so, set a cache time of a year on them (SiteGround Site Tools, or .htaccess).", "Ignore files from other sites. Run the speed check again."] });
    }

    g = group(PSI_IDS.heavy);
    if (g.pages.length) add({ id: "spd-heavy", category: "Speed", priority: "medium", issue: g.pages.length + " pages are very large to download", pages: g.pages,
      why: "Google flags pages over about 2.5 MB. Big pages are slow on phones and use people's data. It's nearly always images and video.",
      steps: ["Clear the image fixes in this queue first.", "Replace any background video with a still image on phones (Elementor, Responsive settings).", "Run the speed check again."] });

    g = group(PSI_IDS.lowres);
    if (g.pages.length) add({ id: "spd-lowres", category: "Speed", priority: "low", issue: g.pages.length + " pages show images at too low a resolution", pages: g.pages,
      why: "These images are smaller than the space they fill, so they look blurry on sharp phone screens. " + topLine(g.top),
      steps: ["For each image above, upload a version at least twice the width it's shown at (still under 200 KB, in WebP).", "Replace it in Elementor.", "Run the speed check again."] });

    g = group(PSI_IDS.console);
    if (g.pages.length) {
      var first = ""; each(function (u, r) { if (first) return; var f = failing(r, PSI_IDS.console)[0]; if (f && f.items[0]) first = (f.items[0].text || f.items[0].url || "").slice(0, 160); });
      add({ id: "spd-console", category: "Speed", priority: "low", issue: g.pages.length + " pages log errors in the browser", pages: g.pages,
        why: "Something on these pages is broken behind the scenes, usually a plugin or tracking script. It can stop forms or chat working without anyone noticing." + (first ? " First error: " + first : ""),
        steps: ["Send this list to Matt. He can open a page, press F12 and look at the Console tab to see each error.", "Check the contact form and chat on these pages still work.", "Run the speed check again."] });
    }

    g = group(PSI_IDS.headings);
    if (g.pages.length) add({ id: "spd-heading-order", category: "Content", priority: "low", issue: g.pages.length + " pages skip heading levels", pages: g.pages,
      why: "Headings should step down in order (H1, then H2, then H3). Skipping a level confuses screen readers and makes the page structure harder for Google and AI tools to read.",
      steps: ["In Elementor, open each page and check the heading widgets. Change the HTML tag (not the look) so they go H1, H2, H3 in order.", "Run the speed check again."] });

    /* Security headers: one fix for the whole site. */
    var missing = {}, hp = [];
    each(function (u, r) {
      var any = false;
      (r.fails || []).forEach(function (f) { if (PSI_IDS.headers[f.id]) { missing[f.id] = true; any = true; } });
      if (any && !hp.some(function (x) { return norm(x.link) === norm(u); })) hp.push({ title: shortPath(u), link: u, note: "" });
    });
    var miss = Object.keys(missing);
    if (miss.length) add({ id: "sec-headers", category: "Security", priority: "medium", issue: "The website is missing security headers", pages: [], pageTitle: "Whole site (found on " + hp.length + " pages checked)", link: hp[0].link.replace(/^(https?:\/\/[^\/]+).*/, "$1/"),
      why: "Google found weak or missing " + miss.map(function (k) { return PSI_IDS.headers[k]; }).join(", ") + ". These are settings on the server, the same for every page. Public sector buyers and their security teams check them, and a quick scan of our site shows the gaps.",
      steps: ["Ask Matt to add these lines to the top of .htaccess (Rank Math, then General Settings, then Edit .htaccess, or SiteGround File Manager). Take a copy of the file first.",
        "Header always set Strict-Transport-Security \"max-age=31536000\"",
        "Header always set X-Frame-Options \"SAMEORIGIN\"",
        "Header always set X-Content-Type-Options \"nosniff\"",
        "Header always set Referrer-Policy \"strict-origin-when-cross-origin\"",
        "Leave Content Security Policy, origin isolation and Trusted Types for now. Set wrong, they break the site, chat and tracking.",
        "Check the site, a form and the chat still work. Then run the speed check again."] });
    return out;
  }

  function renderMobile(main) {
    var p = panel("Mobile and speed", "Google's own speed test (PageSpeed Insights) on every live page, on phone and desktop. Read-only.");
    var body = el('<div style="display:flex;flex-direction:column;gap:12px"></div>'); p.appendChild(body); main.appendChild(p);
    var stop = false;
    function draw() {
      var d = psiData();
      body.innerHTML =
        '<details' + (psiKey() ? "" : " open") + '><summary class="muted" style="cursor:pointer;font-size:.88rem">API key (free, recommended for checking every page)' + (psiKey() ? " · saved" : "") + "</summary>" +
        '<ol class="steps-list" style="font-size:.88rem;margin-top:8px"><li>In Google Cloud, open your <b>WPT Hub</b> project.</li><li><b>APIs &amp; Services, then Library</b>. Search <b>PageSpeed Insights API</b> and click <b>Enable</b>.</li><li><b>APIs &amp; Services, then Credentials, then Create credentials, then API key</b>. Copy it.</li><li>Click the new key, then under <b>API restrictions</b> choose <b>Restrict key</b> and tick only <b>PageSpeed Insights API</b>. Save.</li><li>Paste it below. It stays in this browser.</li></ol>' +
        '<div class="row" style="margin-top:8px"><label class="field" for="psi-key" style="flex:1;min-width:220px">PageSpeed API key<input id="psi-key" type="password" autocomplete="off" placeholder="' + (psiKey() ? "Saved. Paste a new one to replace it." : "AIza…") + '"></label><button type="button" class="btn" id="psi-save" style="align-self:flex-end">Save key</button></div></details>' +
        '<div class="row"><button type="button" class="btn primary" id="psi-run">Run speed check on all pages</button><button type="button" class="btn" id="psi-stop" hidden>Stop</button>' +
        '<label class="muted" style="font-size:.86rem;display:flex;align-items:center;gap:6px"><input type="checkbox" id="psi-desk"' + (psiDesk() ? " checked" : "") + "> Desktop too</label>" +
        '<span class="muted" style="font-size:.82rem">' + (psiDesk() ? "About 40 minutes for every page, phone and desktop." : "About 20 minutes for every page, phone only.") + " Uses the pages from your last audit.</span></div><div id=\"psi-status\"></div><div id=\"psi-out\"></div>";
      body.querySelector("#psi-save").addEventListener("click", function () { var v = body.querySelector("#psi-key").value.trim(); if (v) { save("psi-key", v); toast("Key saved"); draw(); } });
      body.querySelector("#psi-run").addEventListener("click", function () { runAll(false); });
      body.querySelector("#psi-stop").addEventListener("click", function () { stop = true; });
      body.querySelector("#psi-desk").addEventListener("change", function () { save("psi-desktop", this.checked); draw(); });
      table(d);
    }
    var showAll = false, PSI_SHOW = 10;
    function deskOf(d, u) { return d.desktop && d.desktop[u] ? d.desktop[u] : null; }
    function pageFailed(d, u) { return !!(d.pages[u].error || (d.withDesktop && (!deskOf(d, u) || deskOf(d, u).error))); }
    function table(d) {
      var out = body.querySelector("#psi-out");
      if (!d || !d.pages || !Object.keys(d.pages).length) { out.innerHTML = '<div class="empty">No mobile check yet.</div>'; return; }
      var rows = Object.keys(d.pages).map(function (u) { return { u: u, r: d.pages[u] }; }).sort(function (a, b) { return (a.r.perf == null ? 101 : a.r.perf) - (b.r.perf == null ? 101 : b.r.perf); });
      var ok = rows.filter(function (x) { return !x.r.error; });
      var failed = rows.filter(function (x) { return pageFailed(d, x.u); }).length;
      var dOk = d.withDesktop ? rows.map(function (x) { return deskOf(d, x.u); }).filter(function (r) { return r && !r.error && r.perf != null; }) : [];
      var dAvg = dOk.length ? Math.round(dOk.reduce(function (s, r) { return s + r.perf; }, 0) / dOk.length) : null;
      var avg = ok.length ? Math.round(ok.reduce(function (s, x) { return s + (x.r.perf || 0); }, 0) / ok.length) : 0;
      var poor = ok.filter(function (x) { return x.r.perf < 50; }).length;
      var squashed = ok.filter(function (x) { return failOf(x.r, "image-aspect-ratio"); }).length;
      function chip(v) { return v == null ? "–" : '<span class="chip ' + (v >= 90 ? "good" : v >= 50 ? "flag" : "bad") + '">' + v + "</span>"; }
      var shown = showAll ? rows : rows.slice(0, PSI_SHOW);
      var more = rows.length > PSI_SHOW;
      var toggle = more ? '<div class="row" style="margin-top:8px"><button type="button" class="btn small psi-toggle" aria-expanded="' + showAll + '">' + (showAll ? "Show fewer (worst " + PSI_SHOW + ")" : "Show all " + rows.length + " pages") + "</button>" + (showAll ? "" : '<span class="muted" style="font-size:.82rem">Showing the ' + PSI_SHOW + " slowest.</span>") + "</div>" : "";
      out.innerHTML = '<div class="stats">' + stat(avg + "/100", "Average mobile speed score", avg < 50) + (dAvg != null ? stat(dAvg + "/100", "Average desktop speed score", dAvg < 50) : "") + stat(poor, "Pages under 50", poor > 0) + stat(squashed, "Pages with squashed images", squashed > 0) + stat(ok.length + " of " + rows.length, "Pages checked") + "</div>" +
        (failed ? '<div class="row"><button type="button" class="btn" id="psi-retry">Check the ' + failed + " that failed again</button><span class=\"muted\" style=\"font-size:.82rem\">Keeps the results you already have.</span></div>" : "") +
        '<p class="muted mono" style="font-size:.78rem">Checked ' + esc(new Date(d.when).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })) + (ok[0] && ok[0].r.version ? " · Lighthouse " + esc(ok[0].r.version) : "") + ". Scores vary a few points between runs; look at the trend. 90+ good, 50 to 89 needs work, under 50 poor.</p>" +
        '<div class="table-wrap" id="psi-table"><table><thead><tr><th>Page</th><th class="num">Mobile</th>' + (d.withDesktop ? '<th class="num">Desktop</th>' : "") + '<th class="num">Access.</th><th class="num">SEO</th><th class="num">Main content</th><th class="num">Jumping</th><th>Real visitors</th><th></th></tr></thead><tbody>' +
        shown.map(function (x) {
          var r = x.r;
          var dk = deskOf(d, x.u), dCell = d.withDesktop ? '<td class="num">' + (dk && !dk.error ? chip(dk.perf) : '<span class="muted" title="' + esc(dk ? dk.error : "not checked") + '">–</span>') + "</td>" : "";
          if (r.error) return '<tr><td><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(shortPath(x.u)) + '</a></td><td colspan="' + (d.withDesktop ? 8 : 7) + '" class="muted">' + esc(r.error) + "</td></tr>";
          return '<tr><td><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(shortPath(x.u)) + '</a></td><td class="num">' + chip(r.perf) + "</td>" + dCell + '<td class="num">' + chip(r.a11y) + '</td><td class="num">' + chip(r.seo) + '</td><td class="num">' + (r.lcp ? (r.lcp / 1000).toFixed(1) + " s" : "–") + '</td><td class="num">' + (r.cls != null ? r.cls.toFixed(2) : "–") + "</td><td>" + (r.field ? esc((r.field.overall || "").toLowerCase() || "–") : '<span class="muted">not enough data</span>') + '</td><td><a class="btn small" href="https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(x.u) + '&form_factor=mobile" target="_blank" rel="noopener">Full report</a></td></tr>';
        }).join("") + "</tbody></table></div>" + toggle +
        (load("auto-fixes-mobile", []).length ? '<div class="row" style="margin-top:10px"><a class="btn primary" href="#fixes">' + load("auto-fixes-mobile", []).length + " speed fixes in the Fix queue</a></div>" : "");
      Array.prototype.forEach.call(out.querySelectorAll(".psi-toggle"), function (b) {
        b.addEventListener("click", function () {
          var wasAll = showAll; showAll = !showAll; table(d);
          if (wasAll) { var t = out.querySelector("#psi-table"); if (t && t.scrollIntoView) t.scrollIntoView({ block: "start", behavior: "smooth" }); }
        });
      });
      var rb = out.querySelector("#psi-retry"); if (rb) rb.addEventListener("click", function () { runAll(true); });
    }
    function runAll(failedOnly) {
      var audit = load("seo-audit", null), st = body.querySelector("#psi-status");
      if (!audit) { st.innerHTML = '<div class="notice">Run the page audit first, so the check knows which pages are live.</div>'; return; }
      var old = psiData(), d, urls;
      if (failedOnly === true && old && old.pages) {
        d = old; urls = Object.keys(old.pages).filter(function (k) { return pageFailed(old, k); });
      } else {
        d = { when: new Date().toISOString(), pages: {}, desktop: {}, withDesktop: psiDesk() };
        urls = audit.pages.filter(function (p) { return p.live && !p.redirectTo && !p.noindex; }).map(function (p) { return p.link; }).slice(0, 120);
      }
      if (!urls.length) return;
      var i = 0, done = 0, inARow = 0, why = ""; stop = false;
      d.desktop = d.desktop || {};
      /* What each page still needs: phone, desktop or both. A recheck only redoes the side that failed. */
      var jobs = [];
      urls.forEach(function (u) {
        var again = failedOnly === true;
        if (!again || d.pages[u].error) jobs.push({ u: u, s: "MOBILE" });
        if (d.withDesktop && (!again || !deskOf(d, u) || deskOf(d, u).error)) jobs.push({ u: u, s: "DESKTOP" });
      });
      var bar = makeProgress(st, failedOnly === true ? "Rechecking" : "Checked", jobs.length, 11000);
      body.querySelector("#psi-run").disabled = true; body.querySelector("#psi-stop").hidden = false;
      function next() {
        if (stop || i >= jobs.length) return Promise.resolve();
        var job = jobs[i++], u = job.u, into = job.s === "DESKTOP" ? d.desktop : d.pages;
        return runPsi(u, 1, job.s).then(function (r) { into[u] = r; inARow = 0; }, function (e) {
          into[u] = { error: e.message };
          if (e.badKey || (e.limit && !psiKey())) { stop = true; why = e.message; }
          else if (e.network && ++inARow >= 6) { stop = true; why = "Six pages in a row got no answer from Google, so it stopped rather than mark the rest as failed. Check the internet connection, then click Check the ones that failed again."; }
        }).then(function () { done++; bar.step(done, jobs.length, shortPath(u) + (job.s === "DESKTOP" ? " on desktop" : " on mobile")); save("psi", d); return next(); });
      }
      Promise.all([next(), next()]).then(function () {
        bar.close();
        save("psi", d); save("auto-fixes-mobile", buildMobileFixes(d)); updateNav();
        body.querySelector("#psi-run").disabled = false; body.querySelector("#psi-stop").hidden = true;
        var errs = Object.keys(d.pages).filter(function (k) { return pageFailed(d, k); });
        var firstErr = errs.length ? (d.pages[errs[0]].error || (deskOf(d, errs[0]) || {}).error || "not checked") : "";
        var nf = load("auto-fixes-mobile", []).length;
        st.innerHTML = '<div class="notice ' + (errs.length ? "" : "info") + '">' + (stop && done < jobs.length ? "Stopped after " + done + " of " + jobs.length + " checks. " : "Speed check finished. " + nf + ' fixes are in the <a href="#fixes">Fix queue</a>. ') + (why ? esc(why) : errs.length ? errs.length + " pages couldn't be checked, even after trying each up to three times: " + esc(firstErr) : "") + "</div>";
        table(d);
      });
    }
    draw();
  }


  /* ---------- Display check ----------
     Opens every live page in a small window, first at desktop width and then phone width, with ?wpt_check=1.
     The page checker snippet (version 8) adds a read-only script to that one view, which measures what's
     actually drawn and posts the problems back here. Fixable ones become push-ready fixes. */
  var DISPLAY_KIND = {
    distorted: "Squashed or stretched image", cropped: "Logo or badge cut off", broken: "Broken image",
    button_wrap: "Button text wraps onto two lines", text_clipped: "Text cut off", overflow: "Sticks out past the screen edge", no_alt: "Image with no alt text",
    stranded_punct: "Punctuation on its own line", overflow_box: "Image hangs out of its box", repeat_word: "Same word twice in a heading",
    misaligned: "Doesn't line up with the text above", off_centre: "Box isn't centred", uneven_space: "Much more space below than above",
    broken_word: "Word broken across two lines", loose_lines: "Big gaps between heading lines", big_padding: "Too much empty space in a box",
    invisible_text: "Heading you can't see (same colour as the background)"
  };
  var FIT_SET = { "object-fit": "contain", "object-fit_tablet": "contain", "object-fit_mobile": "contain", "object-position": "center center" };
  function modeOf(w) { return w >= 1025 ? "desktop" : w >= 768 ? "tablet" : "phone"; }
  function describeModes(m) {
    var names = { desktop: "desktop", tablet: "tablets", phone: "phones" }, list = ["desktop", "tablet", "phone"].filter(function (x) { return m.indexOf(x) > -1; }).map(function (x) { return names[x]; });
    return list.length === 3 ? "desktop, tablets and phones" : list.length === 2 ? list.join(" and ") : list[0] + " only";
  }
  var SFX = { desktop: "", tablet: "_tablet", phone: "_mobile" };
  var CSS_KINDS = { broken_word: 1, loose_lines: 1, button_wrap: 1 };
  function displayCss(groups, today) {
    var ids = {}, link = "";
    Object.keys(CSS_KINDS).forEach(function (k) {
      var g = groups[k] || [];
      ids[k] = g.filter(function (x) { return x._pid > 0; }).map(function (x) { return x._pid; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (ids[k].length) link = link || g[0].link;
      groups[k] = g.filter(function (x) { return !(x._pid > 0); });
    });
    function sel(list, parts) { return list.map(function (id) { return parts.map(function (pt) { return "body.page-id-" + id + " " + pt + ", body.postid-" + id + " " + pt; }).join(",\n"); }).join(",\n"); }
    var css = [];
    if (ids.broken_word.length) css.push("/* Words breaking in half on phones: slightly smaller headings */\n@media (max-width: 767px) {\n" + sel(ids.broken_word, ["h1", "h2", "h3", ".elementor-heading-title"]) + " {\n  font-size: clamp(1.4rem, 6.4vw, 2.1rem);\n  overflow-wrap: normal;\n  word-break: normal;\n  hyphens: none;\n}\n}");
    if (ids.loose_lines.length) css.push("/* Big gaps between heading lines */\n" + sel(ids.loose_lines, ["h1", "h2", "h3", "h4", ".elementor-heading-title"]) + " {\n  line-height: 1.2;\n}");
    if (ids.button_wrap.length) css.push("/* Button text wrapping on phones */\n@media (max-width: 767px) {\n" + sel(ids.button_wrap, [".elementor-button", ".wp-block-button__link", ".ct-button"]) + " {\n  padding-left: 14px;\n  padding-right: 14px;\n  font-size: 15px;\n  letter-spacing: 0;\n}\n}");
    if (!css.length) return null;
    var n = ids.broken_word.length + ids.loose_lines.length + ids.button_wrap.length;
    return { id: "disp-css", auto: true, created: today, batch: "Found by display check", category: "Mobile", priority: "medium", type: "site_edit", op: "css", siteWide: true, textParam: "value", size: "small",
      pageTitle: "Display fixes", link: link, issue: "Words breaking, loose heading lines and wrapping buttons on " + n + " page" + (n > 1 ? "s" : ""),
      current: "Seen by the display check on these pages, in places the hub can't edit one widget at a time.", proposed: css.join("\n\n"),
      why: "Small style rules, only on the pages where the problem was seen: headings a touch smaller on phones so words fit, tighter heading line spacing, and slimmer button padding on phones. The words don't change. Undo removes the rules." };
  }
  function buildDisplayFixes(d) {
    var out = []; if (!d || !d.pages) return out;
    var today = new Date().toISOString().slice(0, 10), groups = {};
    var claudeText = {}; (window.WPT_PROPOSALS || []).forEach(function (f) { if (f.find) claudeText[norm(f.link) + "|" + String(f.find).toLowerCase()] = 1; });
    var claude = {}; (window.WPT_PROPOSALS || []).forEach(function (f) { if (f.type === "elementor_style") { claude[norm(f.link) + "|" + (f.element || f.find)] = 1; if (f.widget && f.widget !== "image") claude[norm(f.link) + "|widget:" + f.widget] = 1; } });
    Object.keys(d.pages).forEach(function (u) {
      var pg = d.pages[u]; if (!pg || pg.error) return;
      var seen = {};
      /* Reports come in per screen width. Older saved checks have just desktop and phone lists. */
      var reports = pg.reports || [].concat(pg.desktop ? [{ width: 1366, issues: pg.desktop }] : [], pg.phone ? [{ width: 400, issues: pg.phone }] : []);
      reports.forEach(function (rep) {
        var mode = modeOf(rep.width);
        (rep.issues || []).forEach(function (it) {
          var key = it.kind + "|" + (it.widget.id || "") + "|" + (it.kind === "broken_word" ? it.word : it.file || it.text || "");
          var x = seen[key] || (seen[key] = Object.assign({ modes: [], widths: [], byMode: {} }, it));
          if (x.modes.indexOf(mode) < 0) x.modes.push(mode);
          x.widths.push(rep.width);
          (x.byMode[mode] = x.byMode[mode] || []).push(it);
        });
      });
      Object.keys(seen).forEach(function (k) {
        var it = seen[k], onWhat = describeModes(it.modes);
        var wtype = it.widget.type, wid = it.widget.id;
        var sfx = it.modes.indexOf("desktop") > -1 ? "" : it.modes.indexOf("tablet") > -1 ? "_tablet" : "_mobile", near = it.at && it.at.near ? " (near \u201c" + it.at.near + "\u201d)" : "";
        var base = { auto: true, created: today, batch: "Found by display check", category: "Mobile", size: "small", postType: "pages", pageId: pg.pageId || 0, pageTitle: shortPath(u), link: u, element: wid,
          why: "Found by the display check, which looks at each page the way a visitor sees it. Small layout slips like this make a page look unfinished." };
        function mk(id, o) { var f = Object.assign({}, base, o); f.id = "disp-" + id + "-" + (shortPath(u) + "-" + wid).replace(/\W+/g, "-").slice(0, 80); if (!out.some(function (x) { return x.id === f.id; })) out.push(f); }
        if (wid && it.kind === "broken_word") {
          var setF = {}, sizes = [];
          ["desktop", "tablet", "phone"].forEach(function (m) {
            var items = it.byMode[m]; if (!items) return;
            var fit = Math.min.apply(null, items.map(function (x) { return x.fitSize; }));
            setF["typography_font_size" + SFX[m]] = { unit: "px", size: fit }; sizes.push(m + " " + items[0].fontSize + "px to " + fit + "px");
          });
          mk("word", { type: "elementor_type", priority: "high", category: "Content", set: setF, issue: "\u201c" + it.word + "\u201d breaks in the middle of the word" + near,
            current: it.text + "\n\n\u201c" + it.word + "\u201d splits across two lines on " + onWhat + " (seen at " + it.widths.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return b - a; }).join(", ") + "px wide). The box is too narrow for the word at this text size.",
            proposed: "Makes the text a little smaller so the whole word fits at every width checked: " + sizes.join(", ") + ". Screen types where it didn't break keep their size. The words don't change. Undo puts it back.",
            why: "A word split in half looks broken and is hard to read, and it's usually in the biggest heading on the page." });
          return;
        }
        if (wid && it.kind === "loose_lines") {
          var setL2 = {}; setL2["typography_line_height" + sfx] = { unit: "em", size: 1.2 };
          mk("lines", { type: "elementor_type", priority: "medium", category: "Content", set: setL2, issue: "Big gaps between the lines of a heading" + near,
            current: it.text + "\n\nLine spacing is " + it.ratio + " times the text size (" + it.fontSize + "px text), on " + onWhat + ".",
            proposed: "Sets the line spacing to 1.2 times the text size, so the lines of the heading sit together. Nothing else changes. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "big_padding") {
          var setB = {};
          ["desktop", "tablet", "phone"].forEach(function (m) {
            var items = it.byMode[m]; if (!items) return; var x0 = items[0], o = {};
            if (x0.padTop > x0.padTo) o.top = String(x0.padTo); if (x0.padBottom > x0.padTo) o.bottom = String(x0.padTo);
            setB["padding" + SFX[m]] = o;
          });
          mk("pad", { type: "elementor_layout", priority: "medium", set: setB, issue: "Too much empty space in a box" + near,
            current: it.detail + ", on " + onWhat + ".",
            proposed: "Brings the top and bottom space down to " + Object.keys(setB).map(function (k) { return (k === "padding" ? "desktop" : k === "padding_tablet" ? "tablets" : "phones") + " " + (it.byMode[k === "padding" ? "desktop" : k === "padding_tablet" ? "tablet" : "phone"][0].padTo) + "px"; }).join(", ") + ". The sides and everything inside stay the same. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "stranded_punct") {
          mk("punct", { type: "elementor_tidy", priority: "high", category: "Content", issue: "\u201c" + it.punct + "\u201d sits on its own line" + near,
            current: it.text + "\n\nThe \u201c" + it.punct + "\u201d drops onto a line of its own, on " + onWhat + ".",
            proposed: "Removes the space or line break before the \u201c" + it.punct + "\u201d so it stays with the word before it. The words don't change. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "repeat_word" && !claudeText[norm(u) + "|" + it.text.toLowerCase()]) {
          mk("words", { type: "elementor_set", needsEdit: true, priority: "medium", category: "Content", find: it.text, issue: "\u201c" + it.word + "\u201d twice in one heading" + near,
            current: it.text, proposed: it.text, why: "Repeating a word in a short heading reads clumsily. Rewrite it in the box, then push. Only this heading changes." });
          return;
        }
        if (wid && it.kind === "overflow_box" && wtype === "image") {
          mk("fitbox", { type: "elementor_layout", priority: "medium", set: (function () { var o = {}; o["max_width" + sfx] = { unit: "%", size: 100, sizes: [] }; return o; })(), clearNeg: !!it.negMargin,
            issue: "Image hangs out of its box" + near, current: (it.file || "The image") + " " + (it.detail || "hangs outside its box") + ", on " + onWhat + ".",
            proposed: "Caps the image at the width of its column" + (it.negMargin ? " and removes the negative margin pushing it out" : "") + ", so it sits inside the box. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "misaligned" && (Math.abs(it.marginLeft - it.offset) <= 3 || Math.abs(it.padLeft - it.offset) <= 3)) {
          var useMargin = Math.abs(it.marginLeft - it.offset) <= 3, key = (useMargin ? "_margin" : "_padding") + sfx, setL = {}; setL[key] = { left: "0" };
          mk("align", { type: "elementor_layout", priority: "medium", set: setL, issue: (it.isButton ? "Button" : "Text") + " doesn't line up with the text above" + near,
            current: "\u201c" + it.text + "\u201d " + it.detail + ", on " + onWhat + ". It has " + (useMargin ? it.marginLeft + "px of left margin" : it.padLeft + "px of left padding") + " the rest of the column doesn't.",
            proposed: "Sets its left " + (useMargin ? "margin" : "padding") + " to 0 so it lines up with the text above. Nothing else changes. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "off_centre" && wtype === "container" && Math.abs((it.marginLeft - it.marginRight) - (it.gapLeft - it.gapRight)) <= 4) {
          var avg = Math.round((it.marginLeft + it.marginRight) / 2), setC = {}; setC["margin" + sfx] = { left: String(avg), right: String(avg), unit: "px" };
          mk("centre", { type: "elementor_layout", priority: "medium", set: setC, issue: "Box isn't centred" + near, current: it.detail + ", on " + onWhat + ".",
            proposed: "Sets equal margins (" + avg + "px each side) so the box sits in the middle. Nothing else changes. Undo puts it back." });
          return;
        }
        if (wid && it.kind === "uneven_space" && Object.keys(seen).some(function (k2) { return seen[k2].kind === "big_padding" && seen[k2].widget.id === wid; })) return;
        if (wid && it.kind === "uneven_space" && it.padBottom > it.padTop + 30) {
          var setP = {}; setP["padding" + sfx] = { bottom: String(it.padTop) };
          mk("space", { type: "elementor_layout", priority: "low", set: setP, issue: "Much more space below than above" + near, current: it.detail + " (padding " + it.padTop + "px top, " + it.padBottom + "px bottom), on " + onWhat + ".",
            proposed: "Sets the bottom padding to " + it.padTop + "px to match the top, so the box is balanced. Nothing else changes. Undo puts it back." });
          return;
        }
        var auto = (it.kind === "distorted" || it.kind === "cropped") && wid && (wtype === "image" || (wtype === "media-carousel" && it.bg));
        if (auto && !claude[norm(u) + "|" + wid] && !(wtype !== "image" && claude[norm(u) + "|widget:" + wtype]) && !(it.file && claude[norm(u) + "|" + it.file.replace(/\.[a-z0-9]+$/i, "").replace(/-\d+x\d+$/, "").toLowerCase()])) {
          var fid = "disp-" + (shortPath(u) + "-" + wid).replace(/\W+/g, "-").slice(0, 80);
          if (out.some(function (o) { return o.id === fid; })) return;
          out.push({ id: fid, auto: true, created: today, batch: "Found by display check", category: "Mobile", type: "elementor_style", size: "small",
            priority: it.logo || it.kind === "cropped" ? "high" : "medium", postType: "pages", pageId: pg.pageId || 0, pageTitle: shortPath(u), link: u,
            element: wid, widget: wtype, set: wtype === "media-carousel" ? { image_fit: "contain" } : FIT_SET,
            issue: DISPLAY_KIND[it.kind] + ": " + (it.file || "image") + (it.at && it.at.near ? " (near “" + it.at.near + "”)" : ""),
            current: (it.file || "This image") + (wtype === "media-carousel" ? " in the carousel" : "") + " is " + (it.detail || "the wrong shape") + ", on " + onWhat + ".",
            proposed: wtype === "media-carousel" ? "Every image in this carousel fits inside its tile at its true shape, so nothing is cut off. Tiles stay the same size. Only the carousel's image fit setting changes. Undo puts it back."
              : "Same image, same space. It fits inside at its true shape on desktop, tablet and phone. Nothing is cropped. Only how this image displays changes. Undo puts it back.",
            why: "Found by the display check, which looks at each page the way a visitor sees it. Cut-off or squashed images look careless, especially logos and badges, which are trust signals." });
          return;
        }
        if (it.kind === "repeat_word" && claudeText[norm(u) + "|" + String(it.text || "").toLowerCase()]) return;
        var g = groups[it.kind] = groups[it.kind] || [];
        g.push({ _pid: pg.pageId || 0, title: shortPath(u) + (it.at && it.at.near ? " · near “" + it.at.near + "”" : ""), link: u,
          note: [it.file || (it.text ? "“" + it.text + "”" : ""), it.detail || "", onWhat, wtype ? "Elementor " + wtype : ""].filter(Boolean).join(" · ") });
      });
    });
    var STEPS = {
      distorted: ["Open the page in Elementor and click the image.", "In the Style tab, set Height to Default, or keep the height and set Object Fit to Contain.", "Check the phone view, then Update. Tell Claude if it's inside a widget the hub can't edit yet, and it'll add support."],
      cropped: ["Open the page in Elementor and click the image or carousel.", "Set the image fit (Object Fit or Image Fit) to Contain so the whole image shows.", "Check the phone view, then Update."],
      broken: ["Open the page in Elementor and find the image (it shows as empty or a broken icon).", "Choose the image again from the Media Library, or remove the widget.", "Update."],
      button_wrap: ["Open the page in Elementor and click the button.", "Shorten the text, or in Style reduce the font size or padding on phones (phone icon), so it sits on one line.", "Check the buttons next to it match, then Update."],
      text_clipped: ["Open the page in Elementor and click the text.", "Its box is too small for the words. Remove the fixed width or height, or shorten the text.", "Update."],
      overflow: ["Open the page in Elementor in the phone view (phone icon, bottom left).", "Click the item listed. Look for a fixed width, a negative margin or a wide image, and set it to 100% or auto on phones.", "Update, then run the display check again."],
      broken_word: ["Open the page in Elementor, click the text and switch to the screen size listed (icons at the bottom left).", "In Style, Typography, reduce the font size until the word fits on one line.", "Update."],
      loose_lines: ["Open the page in Elementor and click the heading.", "In Style, Typography, set Line Height to about 1.2em.", "Update."],
      big_padding: ["Open the page in Elementor and click the box.", "In Advanced, reduce the top and bottom padding.", "Update."],
      stranded_punct: ["Open the page in Elementor and click the text.", "Delete the space or line break before the punctuation mark.", "Update."],
      overflow_box: ["Open the page in Elementor and click the image.", "In Advanced, check for a negative margin, and in Style set Max Width to 100%.", "Update."],
      repeat_word: ["Open the page in Elementor and click the heading.", "Reword it so the word isn't used twice.", "Update."],
      misaligned: ["Open the page in Elementor and click the item listed.", "In Advanced, set its left margin and padding to match the text above (usually 0).", "Update."],
      off_centre: ["Open the page in Elementor and click the box (the section or container).", "In Advanced or Layout, make the left and right margins the same, or set the content width so it centres.", "Update."],
      uneven_space: ["Open the page in Elementor and click the box.", "In Advanced, make the bottom padding match the top.", "Update."],
      invisible_text: ["Tell Claude straight away. It writes a repair card that sets the heading back to a colour you can see.", "If you need it fixed before then: open the page in Elementor, click the heading, and in Style set Text Color to the dark navy (#0C1B2C).", "Update, then run the display check again."],
      no_alt: ["Open the image in the Media Library.", "Fill in Alternative Text with a short description of what it shows (or the company name for a logo).", "Save. Google and AI tools use this to understand the image."]
    };
    var PRI = { invisible_text: "critical", broken: "high", overflow: "high", distorted: "medium", cropped: "high", button_wrap: "medium", text_clipped: "medium", no_alt: "low", stranded_punct: "high", broken_word: "high", loose_lines: "medium", big_padding: "medium", overflow_box: "medium", repeat_word: "medium", misaligned: "medium", off_centre: "medium", uneven_space: "low" };
    /* Words breaking, loose heading lines and wrapping buttons outside Elementor widgets the hub can edit:
       one small style fix, scoped to the pages where they were seen. */
    var cssFix = displayCss(groups, today);
    if (cssFix) out.push(cssFix);
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (!g.length) return;
      out.push({ id: "disp-" + k, auto: true, type: "manual", created: today, batch: "Found by display check", category: k === "no_alt" ? "AI search" : "Mobile", priority: PRI[k],
        pageTitle: "Display check", link: g[0].link, issue: g.length + " × " + DISPLAY_KIND[k].toLowerCase(), pages: g,
        why: "Found by the display check, which looks at each page the way a visitor sees it, on desktop and on a phone.", steps: STEPS[k] });
    });
    return out;
  }
  function renderDisplayCheck(main) {
    var p = panel("Display check", "Opens every live page at ten screen widths and looks at it the way a visitor does: words breaking across lines, big gaps and empty space, images (cut off, squashed, broken, hanging out of their box), text (punctuation on its own line, a word repeated in a heading, cut-off text) and layout (things not lining up, boxes off-centre, uneven spacing, wrapped buttons, anything past the screen edge). Read-only.");
    var body = el('<div style="display:flex;flex-direction:column;gap:12px"></div>'); p.appendChild(body); main.appendChild(p);
    var stop = false;
    function draw() {
      var d = load("display", null);
      body.innerHTML = '<div class="row"><button type="button" class="btn primary" id="dc-run">Check every page</button><button type="button" class="btn" id="dc-stop" hidden>Stop</button>' +
        '<span class="muted" style="font-size:.82rem">Loads each page in a small preview here and checks it at ten screen widths, from big monitors down to phones. Stay on this page while it runs. About 15 seconds a page. Needs page checker version 10.</span></div><div id="dc-status"></div><div id="dc-out"></div>';
      body.querySelector("#dc-run").addEventListener("click", run);
      body.querySelector("#dc-stop").addEventListener("click", function () { stop = true; });
      summary(d);
    }
    function summary(d) {
      var out = body.querySelector("#dc-out");
      if (!d || !d.pages) { out.innerHTML = '<div class="empty">No display check yet.</div>'; return; }
      var counts = {}, pages = Object.keys(d.pages), errs = 0;
      pages.forEach(function (u) { var pg = d.pages[u], once = {}; if (pg.error) { errs++; return; } (pg.reports || [{ issues: pg.desktop || [] }, { issues: pg.phone || [] }]).forEach(function (rep) { (rep.issues || []).forEach(function (it) { var k = it.kind + "|" + it.widget.id + "|" + (it.file || it.text || ""); if (once[k]) return; once[k] = 1; counts[it.kind] = (counts[it.kind] || 0) + 1; }); }); });
      var fixes = load("auto-fixes-display", []);
      out.innerHTML = '<div class="stats">' + Object.keys(DISPLAY_KIND).filter(function (k) { return counts[k]; }).map(function (k) { return stat(counts[k], DISPLAY_KIND[k], k !== "no_alt"); }).join("") + stat((pages.length - errs) + " of " + pages.length, "Pages checked") + "</div>" +
        '<p class="muted mono" style="font-size:.78rem">Checked ' + esc(new Date(d.when).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })) + (d.widths ? " · at " + d.widths.length + " screen widths, " + Math.max.apply(null, d.widths) + " to " + Math.min.apply(null, d.widths) + "px" : d.phoneWidth ? " · phone pass at " + d.phoneWidth + "px wide" : "") + (errs ? " · " + errs + " pages didn't report back" : "") + "</p>" +
        (fixes.length ? '<div class="row"><a class="btn primary" href="#fixes">' + fixes.length + " display fixes in the Fix queue</a></div>" : "");
    }
    function run() {
      var audit = load("seo-audit", null), st = body.querySelector("#dc-status");
      if (!audit) { st.innerHTML = '<div class="notice">Run the page audit first, so the check knows which pages are live.</div>'; return; }
      var urls = audit.pages.filter(function (x) { return x.live && !x.redirectTo; }).map(function (x) { return x.link; }).slice(0, 150);
      stop = false;
      var origin = new URL(urls[0]).origin, d = { when: new Date().toISOString(), pages: {} }, waiting = null;
      function onMsg(e) { if (e.origin === origin && e.data && e.data.wpt === "display-check" && waiting) waiting(e.data); }
      window.addEventListener("message", onMsg);
      body.querySelector("#dc-run").disabled = true; body.querySelector("#dc-stop").hidden = false;
      /* Pages load in a frame shown small on this page (desktop 1366px wide, then phone 400px wide).
         If the site won't load in a frame, desktop falls back to a small window. */
      var stage = el('<div class="dc-stage"><div class="dc-scale"><iframe title="Page being checked" sandbox="allow-scripts allow-same-origin"></iframe></div></div>');
      body.insertBefore(stage, body.querySelector("#dc-out"));
      var frame = stage.querySelector("iframe"), popup = null, useFrame = true;
      function size(wd) { frame.style.width = wd + "px"; frame.style.height = (wd < 768 ? 820 : 900) + "px"; var k = Math.min(1, 300 / wd); stage.querySelector(".dc-scale").style.transform = "scale(" + k + ")"; stage.style.height = Math.round((wd < 768 ? 820 : 900) * k) + "px"; stage.style.width = Math.round(wd * k) + "px"; }
      function visit(u) {
        return new Promise(function (res) {
          var t = setTimeout(function () { waiting = null; res(null); }, 45000);
          waiting = function (data) { if (norm(data.url) !== norm(u)) return; clearTimeout(t); waiting = null; res(data); };
          var href = u + (u.indexOf("?") > -1 ? "&" : "?") + "wpt_check=1&r=" + Date.now();
          try { if (useFrame) frame.src = href; else popup.location.href = href; } catch (e) { clearTimeout(t); res(null); }
        });
      }
      /* Each page loads once at 1366px, then the frame is resized to other common screen widths and the
         page is asked to check itself again. Words that break, and layouts that slip, often only do so
         at one size. Tablet and phone widths match Elementor's breakpoints. */
      var WIDTHS = [1366, 1536, 1440, 1280, 1120, 1024, 900, 768, 600, 400], n = 0, total = urls.length, silent = 0;
      var bar = makeProgress(st, "Checking page", total, 30000);
      function recheck(u, wd) {
        return new Promise(function (res) {
          size(wd);
          var t = setTimeout(function () { waiting = null; res(null); }, 15000);
          waiting = function (data) { if (norm(data.url) !== norm(u)) return; clearTimeout(t); waiting = null; res(data); };
          setTimeout(function () { try { frame.contentWindow.postMessage({ wpt: "display-rerun" }, origin); } catch (e) { clearTimeout(t); res(null); } }, 300);
        });
      }
      function doPage(u) {
        var pg = d.pages[u] = { pageId: 0, reports: [] };
        size(WIDTHS[0]);
        ++n; bar.step(n - 1, total, shortPath(u) + " at " + WIDTHS.length + " screen widths");
        return visit(u).then(function (first) {
          if (!first && useFrame && n === 1) {
            /* Site refused to load in a frame: fall back to a small window at desktop width only. */
            popup = window.open("about:blank", "wpt-display-check", "popup=yes,width=1366,height=850");
            if (popup) { useFrame = false; return visit(u).then(function (again) { return [again]; }); }
          }
          if (!first || !useFrame) return [first];
          var got = [first], i = 1;
          function nextWidth() {
            if (stop || i >= WIDTHS.length) return Promise.resolve(got);
            var wd = WIDTHS[i++];
            bar.note(shortPath(u) + " at " + wd + "px wide");
            return recheck(u, wd).then(function (r) { if (r) got.push(r); return nextWidth(); });
          }
          return nextWidth();
        }).then(function (list) {
          list = (list || []).filter(Boolean);
          if (!list.length) { silent++; pg.error = "didn't report back"; }
          list.forEach(function (r) { pg.pageId = r.pageId || pg.pageId; pg.reports.push({ width: r.width, issues: r.issues }); if (r.width < 768) d.phoneWidth = r.width; });
          d.widths = WIDTHS;
        });
      }
      function pass() {
        var i = 0;
        function next() {
          if (stop || i >= urls.length) return Promise.resolve();
          return doPage(urls[i++]).then(function () {
            bar.step(n, total);
            if (silent >= 2 && n <= 2) { stop = true; bar.close(); st.innerHTML = '<div class="notice"><b>Pages aren\'t reporting back.</b> The display check needs page checker version 10. Click Copy page checker code, replace the code in WordPress and save, then try again.</div>'; return; }
            return next();
          });
        }
        return next();
      }
      pass().then(function () {
        bar.close();
        window.removeEventListener("message", onMsg);
        try { if (popup) popup.close(); } catch (e) {}
        stage.remove();
        body.querySelector("#dc-run").disabled = false; body.querySelector("#dc-stop").hidden = true;
        if (!Object.keys(d.pages).some(function (u) { return !d.pages[u].error; })) return;
        save("display", d); var fx = buildDisplayFixes(d); save("auto-fixes-display", fx); updateNav();
        if (!/version 10/.test(st.textContent)) st.innerHTML = '<div class="notice info">Display check finished. ' + fx.length + " fixes are in the Fix queue.</div>";
        summary(d);
      });
    }
    draw();
  }

  /* ---------- Fix queue ---------- */
  var TYPE_LABEL = { meta_title: "SEO title", meta_description: "Meta description", content_replace: "Content change", new_draft: "New draft", manual: "Steps",
    elementor_set: "Page text change", elementor_swap: "Phrase change", elementor_remove: "Remove from page", set_status: "Unpublish page", page_build: "New page build", elementor_style: "Image fix", elementor_tidy: "Punctuation fix", elementor_layout: "Layout fix", elementor_type: "Text size fix", elementor_faq: "FAQ block", elementor_h1: "H1 fix", elementor_h1_look: "H1 colour repair" };
  var SITE_OP_LABEL = { h1: "H1 fix", h1_one: "One H1", alt: "Alt text", relink: "Link fix", menu_add: "Menu link", css: "Display fix", llms: "llms.txt", option: "Site setting", meta: "Page setting", redirect_code: "Redirect fix" };
  function typeLabel(p) { return p.type === "content_set" ? "Page repair" : p.type === "site_edit" ? SITE_OP_LABEL[p.op] || "Site fix" : p.type === "text_swap" ? "Phrase change" : p.type === "group" ? p.groupLabel || "Fixes" : TYPE_LABEL[p.type] || p.type; }
  /* The button says what pushing does. */
  function goLabel(p) {
    if (p.type === "content_set") return "Approve and repair the page";
    if (p.type === "site_edit") return { h1: "Approve and make it the H1", h1_one: "Approve and keep one H1", alt: "Approve and add the alt text", relink: "Approve and fix the link", menu_add: "Approve and add to the menu", css: "Approve and fix the display", llms: "Approve and publish llms.txt", option: p.params && p.params.key === "blog_public" ? "Approve and let Google index the site" : "Approve and save the setting", meta: p.params && p.params.key === "rank_math_robots" ? "Approve and let Google index it" : "Approve and clear it", redirect_code: "Approve and make it permanent" }[p.op] || "Approve and push";
    return p.type === "new_draft" ? "Approve and save as draft" : p.type === "elementor_remove" ? "Approve and remove from page" : p.type === "set_status" ? "Approve and unpublish" : p.type === "elementor_style" ? "Approve and fix the image" : p.type === "elementor_layout" ? "Approve and fix the layout" : p.type === "elementor_tidy" ? "Approve and fix the punctuation" : p.type === "elementor_type" ? "Approve and fix the text size" : p.type === "elementor_faq" ? "Approve and add the FAQ to the page" : p.type === "elementor_h1" ? "Approve and make it the H1" : p.type === "elementor_h1_look" ? "Approve and make the heading visible again" : "Approve and push live";
  }
  /* Fixes whose box only describes what happens, rather than holding text to edit. */
  function fixedText(p) { return /elementor_remove|set_status|elementor_style|elementor_tidy|elementor_layout|elementor_type|elementor_h1|elementor_h1_look|content_set/.test(p.type) || (p.type === "site_edit" && !p.textParam && p.op !== "alt"); }
  /* FAQ fixes are written as plain text so Connor can edit them in the box:
     "Heading: ..." on the first line, then "Q: ..." and "A: ..." pairs. Answers can run over several lines. */
  function parseFaq(text) {
    var heading = "", items = [], cur = null;
    String(text || "").replace(/\r/g, "").split("\n").forEach(function (line) {
      var m;
      if ((m = line.match(/^\s*heading\s*:\s*(.*)$/i)) && !items.length && !cur) { heading = m[1].trim(); return; }
      if ((m = line.match(/^\s*q\s*:\s*(.*)$/i))) { cur = { q: m[1].trim(), a: "" }; items.push(cur); return; }
      if ((m = line.match(/^\s*a\s*:\s*(.*)$/i)) && cur) { cur.a = m[1].trim(); return; }
      if (cur && cur.a && line.trim()) cur.a += " " + line.trim();
    });
    items.forEach(function (it, i) {
      if (it.q.length < 5 || it.a.length < 10) throw new Error("Question " + (i + 1) + " needs both a question (Q:) and an answer (A:). Nothing was changed.");
    });
    if (items.length < 2 || items.length > 12) throw new Error("An FAQ block needs between 2 and 12 questions, each starting Q: with its answer on a line starting A:. Nothing was changed.");
    return { heading: heading, items: items };
  }
  function needsV11(err) {
    if (/no route|unknown edit type|doesn't say which text/i.test(err.message)) throw new Error("FAQ blocks need version 11 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then click Save and test: it should say version 11. Then try again.");
    throw err;
  }
  function needsV13(err) {
    if (/no route|unknown edit type/i.test(err.message)) throw new Error("This fix needs version 13 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then click Save and test: it should say version 13. Then push again.");
    throw err;
  }
  function needsV12(err) {
    if (/no heading widget to turn into the H1|appears in more than one place|no route|unknown edit type/i.test(err.message)) throw new Error("This fix needs version 12 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then click Save and test: it should say version 12. Then push again.");
    throw err;
  }
  function needsV9(err) {
    if (/no route|unknown edit type|doesn't say which text|can only change image size/i.test(err.message)) throw new Error("This fix needs version 10 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then click Save and test: it should say version 10. Then try again.");
    throw err;
  }
  function needsV7(err) {
    /* An older snippet doesn't know "style", falls through to the text search and says the text isn't there. */
    if (/can only change image size and cropping/i.test(err.message)) throw new Error("The code in WordPress is an older copy that can't fix carousels yet. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then click Save and test: it should say version 8. Then try again.");
    if (/no route|unknown edit type|which image or what to change|text this fix looks for/i.test(err.message)) throw new Error("Image fixes need version 7 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again.");
    throw err;
  }
  function needsV4(err) {
    if (/no route|unknown edit type/i.test(err.message)) throw new Error("Page editing needs the latest page checker snippet. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again.");
    throw err;
  }
  var PRI_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  var PRI_CHIP = { critical: "bad", high: "flag", medium: "info", low: "" };
  function proposals() {
    syncFixProgress();
    var list = (window.WPT_PROPOSALS || []).concat(load("auto-fixes", []), load("auto-fixes-gsc", []), load("auto-fixes-ga4", []), load("auto-fixes-claims", []), load("auto-fixes-rules", []), load("auto-fixes-mobile", []), load("auto-fixes-display", []), load("auto-fixes-links", []));
    return list.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      return (PRI_ORDER[a.p.priority || "medium"] - PRI_ORDER[b.p.priority || "medium"]) || a.i - b.i;
    }).map(function (x) { return x.p; });
  }
  function fixState() { return load("fix-state", {}); }
  function setFix(id, patch) {
    /* Every change of state is time-stamped, so Done can list the newest first and each card shows when it happened. */
    if (patch && /^(pushed|done|undone|rejected)$/.test(patch.status || "") && !patch.ts) patch = Object.assign({ ts: Date.now() }, patch);
    var s = fixState(); s[id] = Object.assign({}, s[id] || {}, patch); save("fix-state", s);
  }
  /* When a fix last moved: the stamp if there is one, otherwise the date shown on older cards. */
  function fixTime(st) {
    if (!st) return 0;
    if (st.ts) return st.ts;
    var txt = st.status === "undone" ? st.undoneAt : st.status === "pushed" ? st.pushedAt : st.doneAt;
    var t = Date.parse(String(txt || st.pushedAt || st.doneAt || "").replace(",", ""));
    return isNaN(t) ? (st.doneTs || 0) : t;
  }
  function stampText(ts) { return new Date(ts).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function newestFirst(list, s) {
    return list.map(function (p, i) { return { p: p, i: i, t: fixTime(s[p.id]) }; }).sort(function (a, b) { return b.t - a.t || a.i - b.i; }).map(function (x) { return x.p; });
  }
  function pendingFixes() {
    var s = fixState();
    return proposals().filter(function (p) { return !p.example && !p.parent && cardMode(p) !== "job" && isOpenFix(s[p.id]); });
  }
  /* In progress: a fix you've started, parked until its next action date.
     On that date it comes back to the top of Waiting for you. */
  function localDay(d) { d = d || new Date(); var m = d.getMonth() + 1, n = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (n < 10 ? "0" : "") + n; }
  function addDays(iso, n) { var p = iso.split("-"); return localDay(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function fmtDay(iso) { var p = String(iso || "").split("-"); if (p.length !== 3) return iso || ""; return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
  function isParkedFix(st) { return !!(st && st.status === "inprogress" && st.nextDate && st.nextDate > localDay()); }
  function isDueBackFix(st) { return !!(st && st.status === "inprogress" && !isParkedFix(st)); }
  function isOpenFix(st) { return !(st && st.status) || isDueBackFix(st); }
  function cardState(st) { st = st || {}; if (st.status !== "inprogress") return st; var c = Object.assign({}, st); delete c.status; return c; }
  function sortFixGroup(list, s, view) {
    var dated = function (p) { var st = s[p.id]; return st && st.status === "inprogress" ? st.nextDate || "" : null; };
    return list.map(function (p, i) { return { p: p, i: i, d: dated(p) }; }).sort(function (a, b) {
      if (view === "waiting" && (a.d == null) !== (b.d == null)) return a.d == null ? 1 : -1;
      if (a.d != null && b.d != null && a.d !== b.d) return a.d < b.d ? -1 : 1;
      return a.i - b.i;
    }).map(function (x) { return x.p; });
  }
  function parkFix(id, nextDate, note) {
    var st = fixState()[id] || {};
    setFix(id, { status: "inprogress", nextDate: nextDate, progressNote: note || "", progressSince: st.status === "inprogress" && st.progressSince ? st.progressSince : localDay() });
  }
  function unparkFix(id) {
    var s = fixState(); if (s[id]) { delete s[id].status; delete s[id].nextDate; delete s[id].progressNote; delete s[id].progressSince; } save("fix-state", s);
  }
  /* Adds the In progress strip and button to any fix card. */
  function progressControls(card, p, st, redraw) {
    var ip = st && st.status === "inprogress", due = ip && isDueBackFix(st);
    if (ip) {
      var strip = el('<div class="notice ' + (due ? "" : "info") + ' progress-strip"></div>');
      strip.innerHTML = (due ? "<b>Back from In progress.</b> Next action was due " + esc(fmtDay(st.nextDate)) + "."
        : "<b>In progress</b> since " + esc(fmtDay(st.progressSince)) + ". Comes back to the queue on " + esc(fmtDay(st.nextDate)) + ".") +
        (st.progressNote ? '<div style="margin-top:4px"><b>Next action:</b> ' + esc(st.progressNote) + "</div>" : "");
      var head = card.querySelector(".panel-head");
      if (head && head.nextSibling) card.insertBefore(strip, head.nextSibling); else card.insertBefore(strip, card.firstChild);
    }
    var actions = card.querySelector(".fix-actions"); if (!actions) return;
    var btn = el('<button type="button" class="btn ip">' + (ip ? (due ? "Still in progress" : "Change date") : "In progress") + "</button>");
    actions.appendChild(btn);
    if (ip && !due) {
      var back = el('<button type="button" class="btn small">Back in the queue now</button>');
      actions.appendChild(back);
      back.addEventListener("click", function () { unparkFix(p.id); toast("Back in Waiting for you"); redraw(); updateNav(); });
    }
    btn.addEventListener("click", function () {
      if (card.querySelector(".ip-form")) return;
      var tomorrow = addDays(localDay(), 1);
      var def = ip && st.nextDate > localDay() ? st.nextDate : addDays(localDay(), 7);
      var form = el('<div class="ip-form panel" style="padding:12px;display:flex;flex-direction:column;gap:8px">' +
        '<label class="field">Date for the next action<input type="date" class="ip-date" min="' + tomorrow + '" value="' + def + '" required></label>' +
        '<label class="field">What happens next (optional)<input type="text" class="ip-note" placeholder="e.g. Chase Matt for Google account access" value="' + esc(ip ? st.progressNote || "" : "") + '"></label>' +
        '<div class="row"><button type="button" class="btn primary ip-save">Save</button><button type="button" class="btn small ip-cancel">Cancel</button>' +
        '<span class="muted" style="font-size:.84rem">On that date it goes back to the top of Waiting for you.</span></div><div class="ip-msg"></div></div>');
      actions.parentNode.insertBefore(form, actions.nextSibling);
      form.querySelector(".ip-cancel").addEventListener("click", function () { form.remove(); });
      form.querySelector(".ip-save").addEventListener("click", function () {
        var d = form.querySelector(".ip-date").value;
        if (!d || d <= localDay()) { form.querySelector(".ip-msg").innerHTML = '<div class="notice">Pick a date after today.</div>'; return; }
        parkFix(p.id, d, form.querySelector(".ip-note").value.trim());
        toast("In progress until " + fmtDay(d)); redraw(); updateNav();
      });
    });
  }
  /* Progress log. A fix can carry "tracks" in proposals.js (one per vendor or strand of work), each with
     a status, a next step and dated log entries written by Claude. Connor adds his own entries and can
     change a track's status in the hub; those stay in this browser.
     A fix's "progress" block ({update, nextDate, note}) puts it In progress once per update stamp,
     the same way job updates work. A new stamp also lets Claude's track statuses take over again. */
  var TRACK_STATUS = ["To do", "Waiting on them", "Done", "Not possible"];
  var TRACK_CHIP = { "To do": "flag", "Waiting on them": "info", "Done": "good", "Not possible": "" };
  function syncFixProgress() {
    var applied = load("fix-progress-applied", {}), changed = false;
    (window.WPT_PROPOSALS || []).forEach(function (p) {
      var g = p.progress;
      if (!g || !g.update || applied[p.id] === g.update) return;
      var st = fixState()[p.id] || {};
      if (!/^(done|pushed|rejected)$/.test(st.status || "") && g.nextDate && g.nextDate > localDay()) parkFix(p.id, g.nextDate, g.note || "");
      var ts = load("fix-track-status", {}); delete ts[p.id]; save("fix-track-status", ts);
      applied[p.id] = g.update; changed = true;
    });
    if (changed) save("fix-progress-applied", applied);
  }
  function trackStatus(p, t) { var ts = (load("fix-track-status", {})[p.id] || {}); return ts[t.name] || t.status || "To do"; }
  function setTrackStatus(id, name, status) { var ts = load("fix-track-status", {}); ts[id] = ts[id] || {}; ts[id][name] = status; save("fix-track-status", ts); }
  function fixLogEntries(p, name) {
    var t = (p.tracks || []).filter(function (x) { return x.name === name; })[0];
    var mine = ((load("fix-log", {})[p.id] || {})[name || ""] || []).map(function (e) { return Object.assign({ mine: true }, e); });
    var all = ((t && t.log) || []).map(function (e, i) { return Object.assign({ n: i }, e); }).concat(mine.map(function (e, i) { return Object.assign({ n: 1000 + i }, e); }));
    return all.sort(function (a, b) { return a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.n - a.n; });
  }
  function addFixLog(id, name, date, text) {
    var l = load("fix-log", {}); l[id] = l[id] || {}; var k = name || ""; l[id][k] = l[id][k] || [];
    l[id][k].push({ date: date, text: text }); save("fix-log", l);
  }
  function deleteFixLog(id, name, date, text) {
    var l = load("fix-log", {}), k = name || "", rows = (l[id] || {})[k] || [];
    for (var i = rows.length - 1; i > -1; i--) if (rows[i].date === date && rows[i].text === text) { rows.splice(i, 1); break; }
    save("fix-log", l);
  }
  function hasFixLog(p) { var l = load("fix-log", {})[p.id] || {}; return !!(p.tracks && p.tracks.length) || Object.keys(l).some(function (k) { return l[k].length; }); }
  function progressLog(card, p, st, redraw) {
    var ip = st && st.status === "inprogress";
    if (!hasFixLog(p) && !ip) return;
    var tracks = p.tracks || [], sel = load("fix-log-tab", {})[p.id];
    if (!tracks.some(function (t) { return t.name === sel; })) sel = tracks.length ? tracks[0].name : "";
    var box = el('<div class="progress-log"></div>');
    var actions = card.querySelector(".fix-actions");
    if (actions) card.insertBefore(box, actions); else card.appendChild(box);
    function draw() {
      var t = tracks.filter(function (x) { return x.name === sel; })[0], entries = fixLogEntries(p, sel), status = t ? trackStatus(p, t) : "";
      box.innerHTML = '<b style="font-size:.9rem">Progress log</b>' +
        (tracks.length ? '<div class="row log-tabs" role="tablist">' + tracks.map(function (x) {
          var s = trackStatus(p, x);
          return '<button type="button" role="tab" class="btn small' + (x.name === sel ? " primary" : "") + '" data-track="' + esc(x.name) + '" aria-selected="' + (x.name === sel) + '">' + esc(x.name) + ' <span class="chip ' + TRACK_CHIP[s] + '">' + esc(s) + "</span></button>";
        }).join("") + "</div>" : "") +
        (t ? '<div class="row" style="font-size:.86rem"><label class="field" style="flex-direction:row;align-items:center;gap:6px">Status <select class="log-status">' +
          TRACK_STATUS.map(function (s) { return "<option" + (s === status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></label>" +
          (t.next ? '<span><b>Next:</b> ' + esc(t.next) + "</span>" : "") + "</div>" : "") +
        (entries.length ? '<ul class="log-list">' + entries.map(function (e) {
          return '<li><span class="mono muted">' + esc(fmtDay(e.date)) + "</span> " + esc(e.text) +
            (e.mine ? ' <button type="button" class="btn small log-del" data-date="' + esc(e.date) + '" data-text="' + esc(e.text) + '">Delete</button>' : ' <span class="chip">Claude</span>') + "</li>";
        }).join("") + "</ul>" : '<p class="muted" style="font-size:.86rem">Nothing logged yet.</p>') +
        '<div class="row log-add"><input type="date" class="log-date" value="' + localDay() + '" max="' + localDay() + '">' +
        '<input type="text" class="log-text" placeholder="What happened, e.g. Emailed Paul, chased ticket" style="flex:1;min-width:200px">' +
        '<button type="button" class="btn small primary log-save">Add to log</button></div>';
    }
    draw();
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-track")) { sel = b.getAttribute("data-track"); var m = load("fix-log-tab", {}); m[p.id] = sel; save("fix-log-tab", m); draw(); }
      else if (b.classList.contains("log-del")) { deleteFixLog(p.id, sel, b.getAttribute("data-date"), b.getAttribute("data-text")); draw(); }
      else if (b.classList.contains("log-save")) {
        var text = box.querySelector(".log-text").value.trim(), date = box.querySelector(".log-date").value || localDay();
        if (!text) { box.querySelector(".log-text").focus(); return; }
        addFixLog(p.id, sel, date, text); toast("Added to the log"); draw();
      }
    });
    box.addEventListener("change", function (e) {
      if (e.target.classList.contains("log-status")) { setTrackStatus(p.id, sel, e.target.value); toast(sel + ": " + e.target.value); draw(); }
    });
  }
  function logChange(entry) { if (!entry.date) entry.date = today(); var l = load("change-log", []); l.unshift(entry); save("change-log", l); }

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
      if (!rows.length && p.postType === "pages" && !p._triedPosts) return resolveId(Object.assign({}, p, { postType: "posts", _triedPosts: true })).then(function (id) { p.postType = "posts"; return id; });
      throw new Error("Couldn't find this page by its address (" + p.link + "). It may have moved. Nothing was changed.");
    });
  }
  function norm(u) { return String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase(); }

  function pushFix(p, text) {
    if (p.example) return Promise.reject(new Error("This is an example. It can't be pushed."));
    if (p.type === "site_edit" && p.siteWide) return pushSite(p, text);
    /* Replacement-rule fixes are rebuilt from the live page just before pushing, so a fix saved by an
       older version of the hub (or before the page changed) can't push stale wording. */
    if (p.batch === "Automatic replacement" && !p._fresh) {
      return ruleFixes().then(function (list) {
        var f = list.filter(function (x) { return x.id === p.id; })[0];
        if (!f) throw new Error("That phrase isn't on the page any more, so there's nothing to change. Click Check the site again now.");
        return pushFix(Object.assign({}, f, { _fresh: true }), text == null || text === p.proposed ? f.proposed : text);
      });
    }
    if (p.type !== "new_draft" && !p.keepRedirect && p.link && !p._liveChecked && hasChecker()) {
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
    if (p.type === "elementor_tidy" || p.type === "elementor_layout" || p.type === "elementor_type") {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: p.type === "elementor_tidy" ? "tidy" : p.type === "elementor_type" ? "type" : "layout", element: p.element, set: p.set || {}, clear_negative_margin: p.clearNeg ? 1 : 0 } })
        .then(function (r) { return { before: p.current, after: p.proposed, backup: r.backup }; }, needsV9);
    }
    if (p.type === "content_set") return pushRepair(p);
    if (p.type === "site_edit") return pushSite(p, text);
    if (p.type === "text_swap") {
      /* Elementor pages swap inside the widget; anything else changes the page text. */
      return pushFix(Object.assign({}, p, { type: "elementor_swap" }), text).catch(function (err) {
        if (!/isn't built with Elementor/.test(err.message)) throw err;
        return pushFix(Object.assign({}, p, { type: "content_replace", current: p.find }), text);
      });
    }
    if (p.type === "elementor_h1") {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: "h1", element: p.element || "" } })
        .then(function (r) { return { before: r.before, after: r.after, backup: r.backup }; }, function (err) {
          if (/isn't built with Elementor/.test(err.message)) return pushSite(Object.assign({}, p, { type: "site_edit", op: "h1" }), "");
          return needsV12(err);
        });
    }
    if (p.type === "elementor_h1_look") {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: "h1_look", find: p.find, level: p.level || 2 } })
        .then(function (r) { return { before: r.before, after: r.after, backup: r.backup }; }, function (err) {
          if (/Unknown edit type|no route/i.test(err.message)) throw new Error("This repair needs page checker version 16. On the Website & SEO page click Copy page checker code, replace the code in Snippets, WPT Hub page checker, save, then push again. Nothing was changed.");
          throw err;
        });
    }
    if (p.type === "elementor_faq") {
      var faq;
      try { faq = parseFaq(text); } catch (e) { return Promise.reject(e); }
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: "faq", heading: faq.heading, items: faq.items, before: p.before || "" } })
        .then(function (r) { return { before: r.before || "(no FAQ on the page)", after: r.after, backup: r.backup }; }, needsV11);
    }
    if (p.type === "elementor_style") {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: "style", find: p.find || "", element: p.element || "", set: p.set, widget: p.widget || "image", all: p.all ? 1 : 0 } })
        .then(function (r) { return { before: p.current, after: p.proposed, backup: r.backup }; }, needsV7);
    }
    if (p.type === "elementor_set" || p.type === "elementor_remove" || p.type === "elementor_swap") {
      if (p.type === "elementor_remove" && p.level == null) return Promise.reject(new Error("Choose exactly what to remove first (the options above), so nothing else on the page goes with it."));
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: p.pageId, op: p.type === "elementor_set" ? "set" : p.type === "elementor_swap" ? "swap" : "remove", find: p.find, replace: text, level: p.level, scope: p.scope || "", every: p.every ? 1 : 0 } })
        .then(function (r) { return { before: r.before, after: r.after, backup: r.backup }; }, p.every ? needsV12 : needsV4);
    }
    if (p.type === "set_status") {
      return wpFetch(base + p.pageId + "?context=edit&_fields=id,status").then(function (cur) {
        return wpFetch(base + p.pageId, { method: "POST", body: { status: p.status || "draft" } }).then(function (r) {
          if (r.status !== (p.status || "draft")) throw new Error("WordPress didn't change the page status. Nothing was changed.");
          var res = { before: cur.status, after: r.status };
          if (!p.keepRedirect || !hasChecker()) return res;
          /* The old address must still redirect. If the redirect lived on the page itself, put the page back. */
          return checkUrls([p.link]).then(function (live) {
            var l = live[norm(p.link)];
            if (isRedirect(l) && norm(l.location) === norm(p.keepRedirect)) return res;
            return wpFetch(base + p.pageId, { method: "POST", body: { status: cur.status } }).then(function () {
              throw new Error("Setting the page to draft stopped the redirect to " + shortPath(p.keepRedirect) + " working, so the page has been put back as it was. The redirect must be set on the page itself. Ask Matt to add it in Rank Math, then Redirections, then push again.");
            });
          });
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
  /* Ask WordPress which heading would become the H1, without changing anything. */
  /* Repair a page by putting its whole text back. Uses the page checker's exact write when it's there
     (version 15), otherwise WordPress's own editor route. Either way the page is read back afterwards and
     must match byte for byte, or the old text goes back and the push fails. */
  function pushRepair(p) {
    var base = "/wp/v2/" + p.postType + "/" + p.pageId;
    function verify() {
      return wpFetch(base + "?context=edit&_fields=id,content").then(function (cur) {
        var raw = (cur.content && cur.content.raw) || "";
        if (raw !== p.code) throw new Error("WordPress didn't keep the page text exactly (" + raw.length + " of " + p.code.length + " characters match the original).");
        return raw.length;
      });
    }
    return pushSite(Object.assign({}, p, { op: "content_set", params: { content: p.code } }), "").then(function (r) {
      return verify().then(function () { return r; });
    }, function (err) {
      if (!/version 13|no route|unknown edit type/i.test(err.message)) throw err;
      return wpFetch(base + "?context=edit&_fields=id,content").then(function (cur) {
        var before = (cur.content && cur.content.raw) || "";
        return wpFetch(base, { method: "POST", body: { content: p.code } }).then(function () {
          return verify().then(function (n) { return { before: before, after: n + " characters, checked byte for byte", restBefore: before }; }, function (e) {
            return wpFetch(base, { method: "POST", body: { content: before } }).then(function () { throw new Error(e.message + " The page has been put back as it was. Update the page checker to version 15 and push again."); });
          });
        });
      });
    });
  }
  function pushSite(p, text) {
    var body = Object.assign({ op: p.op, post_id: p.siteWide ? 0 : p.pageId || 0 }, p.params || {});
    if (p.textParam) body[p.textParam] = text;
    if (p.op === "alt") body.items = parseAltText(text, p.items || []);
    return wpFetch("/wpt-hub/v1/site-edit", { method: "POST", body: body }).then(function (r) {
      return { before: r.before, after: r.after, backup: r.backup, skipped: r.skipped || [] };
    }, needsV13);
  }
  /* Alt text is edited as one line per image: "file name: description". */
  function altFromFile(src, pageTitle) {
    var f = decodeURIComponent(String(src || "").split("/").pop().split("?")[0]).replace(/\.[a-z0-9]+$/i, "").replace(/-\d+x\d+$/, "").replace(/-(scaled|e\d+)$/i, "");
    var words = f.split(/[-_\s.]+/).filter(function (w) { return w && !/^(img|dsc|dscn|pxl|image|photo|picture|screenshot|copy|final|web|min|scaled|\d+|[a-f0-9]{8,})$/i.test(w); });
    if (words.length < 1) return "";
    var t = words.join(" ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function altFile(src) { return decodeURIComponent(String(src || "").split("/").pop().split("?")[0]); }
  function altText(items) { return items.map(function (it) { return altFile(it.src) + ": " + (it.alt || ""); }).join("\n"); }
  function parseAltText(text, items) {
    var byFile = {}; String(text || "").split("\n").forEach(function (l) { var i = l.indexOf(":"); if (i > 0) byFile[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    return items.map(function (it) { var f = altFile(it.src); return { src: it.src, alt: f in byFile ? byFile[f] : it.alt || "" }; }).filter(function (it) { return it.alt.length >= 3; });
  }
  function previewH1(p) {
    var go = p.pageId > 0 ? Promise.resolve(p.pageId) : resolveId(p);
    return go.then(function (id) {
      return wpFetch("/wpt-hub/v1/elementor-edit", { method: "POST", body: { post_id: id, op: "h1", dry_run: 1 } }).then(function (r) {
        if (!r.dry_run) throw new Error("Update the page checker snippet to version 11 to preview this fix.");
        return r;
      }, function (err) {
        if (/isn't built with Elementor/.test(err.message)) return { notElementor: true };
        return needsV11(err);
      });
    });
  }
  /* Put back an earlier version of an Elementor page from its revisions (page checker 14). Versions with
     more embedded content (PDF viewers, videos, forms) than the page has now are flagged. */
  function revisionTool(p, box) {
    var wrap = el('<div class="notice info" style="display:block">Loading the saved versions of this page\u2026</div>');
    box.appendChild(wrap);
    var go = p.pageId > 0 ? Promise.resolve(p.pageId) : resolveId(p);
    go.then(function (id) {
      return wpFetch("/wpt-hub/v1/elementor-revisions?post_id=" + id).then(function (d) {
        if (!d.revisions || !d.revisions.length) { wrap.innerHTML = "WordPress has no earlier versions of this page with an Elementor layout. Ask Matt whether SiteGround has a backup from before " + esc(new Date().toLocaleDateString("en-GB")) + "."; return; }
        wrap.innerHTML = "<b>Saved versions of this page</b>, newest first. Versions marked <b>has what's missing</b> have embedded content or page code the page has lost. Pick the newest one from before the change went wrong. The version on the page now is kept, so this can be undone too." +
          '<div class="rev-list" style="display:flex;flex-direction:column;gap:6px;margin-top:8px"></div>';
        var list = wrap.querySelector(".rev-list");
        d.revisions.forEach(function (r) {
          var more = r.embeds > d.current.embeds || (r.slashes || 0) > (d.current.slashes || 0);
          var row = el('<div class="row" style="justify-content:space-between;gap:8px"><span>' + esc(new Date(r.date.replace(" ", "T")).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })) + (r.author ? " \u00b7 " + esc(r.author) : "") +
            " \u00b7 " + r.embeds + " embedded" + (more ? ' <span class="chip good">has what\'s missing</span>' : "") + '</span><button type="button" class="btn small">Restore this version</button></div>');
          var b = row.querySelector("button");
          b.addEventListener("click", function () {
            if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to restore"; return; }
            b.disabled = true; b.textContent = "Restoring\u2026";
            wpFetch("/wpt-hub/v1/elementor-revisions", { method: "POST", body: { post_id: id, revision_id: r.id } }).then(function (res) {
              var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
              logChange({ id: p.id + "-restore", when: when, page: p.pageTitle, link: p.link, type: "Restore", action: res.after + " (undo id " + res.backup + ")" });
              wrap.innerHTML = "<b>Restored.</b> " + esc(res.after) + '. Open the page to check it. <button type="button" class="btn small danger">Undo the restore</button>';
              wrap.querySelector("button").addEventListener("click", function () {
                wpFetch("/wpt-hub/v1/elementor-undo", { method: "POST", body: { post_id: id, backup: res.backup, force: 1 } }).then(function () { wrap.innerHTML = "Restore undone."; }, function (e) { wrap.innerHTML = '<span class="notice">' + esc(e.message) + "</span>"; });
              });
              toast("Earlier version restored");
            }, function (e) { b.disabled = false; delete b.dataset.sure; b.textContent = "Restore this version"; wrap.appendChild(el('<div class="notice">' + esc(/no route/i.test(e.message) ? "Restoring needs version 15 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again." : e.message) + "</div>")); });
          });
          list.appendChild(row);
        });
      });
    }).catch(function (e) { wrap.className = "notice"; wrap.innerHTML = esc(/no route/i.test(e.message) ? "Restoring needs version 15 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again." : e.message); });
  }
  function undoFix(p, st, force) {
    if (!(p.pageId > 0) && st.pageId) p = Object.assign({}, p, { pageId: st.pageId });
    /* Site fixes (page checker 13) keep their copy under an id starting with "s". */
    if (st.backup && /^s\d/.test(st.backup)) return wpFetch("/wpt-hub/v1/site-undo", { method: "POST", body: { backup: st.backup, force: force ? 1 : 0 } });
    if (p.type === "text_swap") p = Object.assign({}, p, { type: st.backup ? "elementor_swap" : "content_replace" });
    if (p.type === "content_set") return wpFetch(base + p.pageId, { method: "POST", body: { content: st.before || "" } });
    var base = "/wp/v2/" + p.postType + "/";
    if (p.type === "elementor_set" || p.type === "elementor_remove" || p.type === "elementor_swap" || p.type === "elementor_style" || p.type === "elementor_tidy" || p.type === "elementor_layout" || p.type === "elementor_type" || p.type === "elementor_faq" || p.type === "elementor_h1" || p.type === "elementor_h1_look") {
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
      ["All", "Leads", "Content", "Mobile", "Speed", "Security", "Structure", "Indexing", "AI search"].map(function (o) { return "<option" + (o === area ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></label></div>");
    main.appendChild(filt);
    filt.querySelector("select").addEventListener("change", function (e) { area = e.target.value; save("fix-area", area); draw(); });
    var a = wpAuth();
    if (!a || !a.pass || !a.ok) main.appendChild(el('<div class="notice"><b>WordPress isn\'t connected yet.</b> You can read and edit fixes, but pushing needs the connection set up on the <a href="#seo" data-seotab="wp">Website & SEO</a> page.</div>'));
    /* Something broken on a page? Put back an earlier saved version, from right here. */
    var rt = el('<details class="panel" style="padding:10px 14px"><summary style="cursor:pointer;font-size:.9rem"><b>Something broken on a page?</b> Restore an earlier version</summary>' +
      '<div class="row" style="margin-top:8px"><label class="field" style="flex:1;min-width:220px">Page address<input class="rt-url" placeholder="https://westpiertech.com/feature-comparison/"></label><button type="button" class="btn primary rt-go" style="align-self:flex-end">Show saved versions</button></div><div class="rt-out"></div></details>');
    main.appendChild(rt);
    rt.querySelector(".rt-go").addEventListener("click", function () {
      var u = rt.querySelector(".rt-url").value.trim(), out = rt.querySelector(".rt-out");
      if (!/^https?:\/\//.test(u)) { out.innerHTML = '<div class="notice">Paste the full page address, starting https://</div>'; return; }
      out.innerHTML = "";
      revisionTool({ id: "restore-" + autoKey(u), link: u, postType: "pages", pageId: 0, pageTitle: shortPath(u) }, out);
    });
    var tabs = el('<div class="row" role="tablist"></div>'); main.appendChild(tabs);
    var list = el('<div style="display:flex;flex-direction:column;gap:14px"></div>'); main.appendChild(list);

    function draw() {
      var s = fixState(), all = proposals().filter(function (p) { return area === "All" || (p.category || "Content") === area; });
      var groups = {
        waiting: sortFixGroup(all.filter(function (p) { return !p.parent && cardMode(p) !== "job" && isOpenFix(s[p.id]); }), s, "waiting"),
        inprogress: sortFixGroup(all.filter(function (p) { return !p.parent && cardMode(p) !== "job" && isParkedFix(s[p.id]); }), s, "inprogress"),
        pushed: newestFirst(all.filter(function (p) { return s[p.id] && /^(pushed|undone|done)$/.test(s[p.id].status); }), s),
        rejected: newestFirst(all.filter(function (p) { return s[p.id] && s[p.id].status === "rejected"; }), s)
      };
      var names = { waiting: "Waiting for you", inprogress: "In progress", pushed: "Done", rejected: "Not doing" };
      tabs.innerHTML = Object.keys(groups).map(function (g) {
        return '<button type="button" role="tab" class="btn' + (g === view ? " primary" : "") + '" data-view="' + g + '" aria-selected="' + (g === view) + '">' + names[g] + " (" + groups[g].length + ")</button>";
      }).join("");
      if (!groups[view]) view = "waiting";
      var items = groups[view];
      if (!items.length) {
        list.innerHTML = '<div class="panel"><div class="empty">' + (view === "waiting" ? "No fixes waiting. Send Claude the audit (Copy as CSV on the Website & SEO page) and ask for the next batch." : view === "inprogress" ? "Nothing in progress. Click In progress on a fix you've started and pick a date for the next action." : "Nothing here yet.") + "</div></div>";
        return;
      }
      list.innerHTML = "";
      items.forEach(function (p) {
        var raw = s[p.id] || {}, card = fixCard(p, cardState(raw), draw);
        progressLog(card, p, raw, draw);
        if (view === "waiting" || view === "inprogress") progressControls(card, p, raw, draw);
        list.appendChild(card);
      });
    }
    tabs.addEventListener("click", function (e) { var v = e.target.getAttribute("data-view"); if (v) { view = v; save("fix-view", v); draw(); } });
    draw();
    updateNav();
  }

  function headChips(p, st) {
    return '<div class="row">' + '<span class="chip ' + PRI_CHIP[p.priority || "medium"] + '">' + PRI_LABEL[p.priority || "medium"] + "</span>" +
      '<span class="chip info">' + esc(typeLabel(p)) + "</span>" + '<span class="chip">' + esc(p.category || "Content") + "</span>" +
      (p.auto ? '<span class="chip">Found by audit</span>' : "") + (p.example ? '<span class="chip ex">example</span>' : "") +
      (st.status === "done" ? '<span class="chip good">Done</span>' : "") + (st.reopened && !st.status ? '<span class="chip bad">Still found on the last audit</span>' : "") +
      timeChip(p, st) + "</div>";
  }
  /* Date and time on every card: when it was pushed, done or undone, or when Claude wrote it. */
  function timeChip(p, st) {
    var raw = fixState()[p.id] || {}, t = fixTime(raw), what = { pushed: "Pushed", undone: "Undone", done: "Done", rejected: "Closed" }[raw.status];
    if (what && t) return '<span class="chip time" title="' + esc(new Date(t).toISOString()) + '">' + what + " " + esc(stampText(t)) + "</span>";
    if (!p.created) return "";
    var c = Date.parse(String(p.created).replace(" ", "T"));
    if (isNaN(c)) return '<span class="chip time">Written ' + esc(p.created) + "</span>";
    return '<span class="chip time">Written ' + esc(/\d:\d/.test(p.created) ? stampText(c) : new Date(c).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })) + "</span>";
  }
  function offerAlreadyDone(p, box, redraw) {
    var b = el('<div class="row" style="margin-top:8px"><span class="muted" style="font-size:.86rem">If this has already been sorted, close it.</span><button type="button" class="btn small primary">Close it, already sorted</button></div>');
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
        pages.map(function (x) { return '<li><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(String(x.title || "").trim() || shortPath(x.link) || "(no address)") + "</a>" + (x.note ? ' <span class="muted">· ' + esc(x.note) + "</span>" : "") + "</li>"; }).join("") + "</ul></details>" : "") +
      '<div><b style="font-size:.9rem">How to fix it</b><ol class="steps-list">' + (p.steps || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>" +
      '<div class="fix-actions row"></div>';
    var actions = card.querySelector(".fix-actions");
    if (!st.status) {
      actions.innerHTML = '<button type="button" class="btn primary">Mark as done</button><button type="button" class="btn rej">Not doing this</button>' + (pages.length ? '<button type="button" class="btn small copy-claude">Copy list for Claude</button>' : "");
      var cc = actions.querySelector(".copy-claude");
      if (cc) cc.addEventListener("click", function () {
        var txt = "From the hub Fix queue: " + p.issue + "\n" + pages.map(function (x) { return "- " + x.link + (x.note ? " (" + x.note + ")" : ""); }).join("\n") + "\nPlease write these as fixes I can push.";
        copyText(txt, "Copied. Paste it into Claude.");
      });
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


  /* ---------- New page builds ----------
     Claude writes the page; the hub copies an existing page's design (sections, fonts, sizes, colours)
     into a NEW draft, swaps in the new text and hands back a preview link. Never publishes. */
  function pageStyle(p) {
    return resolveId({ link: p.template, postType: "pages" }).then(function (id) {
      return wpFetch("/wpt-hub/v1/page-style?template_id=" + id).then(function (r) { r.templateId = id; return r; }, needsV6);
    });
  }
  function needsV6(err) {
    if (/no route/i.test(err.message)) throw new Error("Page builds need version 6 of the page checker. Click Copy page checker code on the Website & SEO page, replace the code in WordPress and save, then try again.");
    throw err;
  }
  function buildPage(p) {
    if (p.example) return Promise.reject(new Error("This is an example. It can't be built."));
    if (!p.ready || !(p.edits || []).length) return Promise.reject(new Error("The page text isn't written yet. Send Claude the facts and the build will arrive here."));
    var parent = p.parent ? resolveId({ link: p.parent, postType: "pages" }) : Promise.resolve(0);
    return Promise.all([resolveId({ link: p.template, postType: "pages" }), parent]).then(function (ids) {
      return wpFetch("/wpt-hub/v1/page-build", { method: "POST", body: { template_id: ids[0], parent_id: ids[1], title: p.newTitle, slug: p.slug, edits: p.edits, seo_title: p.seoTitle || "", seo_description: p.seoDescription || "" } });
    }).then(function (r) {
      if (r.status !== "draft") throw new Error("WordPress made the page but it isn't a draft. Check it in WordPress now.");
      return r;
    }, needsV6);
  }
  function binDraft(id) { return wpFetch("/wp/v2/pages/" + id, { method: "DELETE" }); }
  function styleHtml(s) {
    var sw = function (c) { return '<span class="swatch" style="background:' + esc(String(c).split(" ")[0]) + '"></span>'; };
    var fonts = (s.fonts || []).map(function (f) { return "<li><b>" + esc(f.name) + ":</b> " + esc([f.family, f.size, f.weight].filter(Boolean).join(", ") || "theme default") + "</li>"; }).join("");
    var cols = (s.colors || []).map(function (c) { return '<li class="row" style="gap:6px">' + sw(c.color) + esc(c.name) + ' <span class="mono muted">' + esc(c.color) + "</span></li>"; }).join("");
    var rows = (s.layout || []).map(function (r) {
      if (r.widget === "section") return '<tr class="sec"><td colspan="4"><b>Section</b>' + (r.background ? " " + sw(r.background) + ' <span class="mono muted">' + esc(r.background) + "</span>" : "") + (r.bg_image ? ' <span class="muted">· background image</span>' : "") + "</td></tr>";
      var f = r.font || {};
      return "<tr><td class=\"mono\">" + esc(r.widget + (r.tag ? " " + r.tag : "")) + "</td><td>" + esc([f.family, f.size, f.weight].filter(Boolean).join(", ") || "default") + (f.global ? '<div class="muted" style="font-size:.75rem">' + esc(f.global) + "</div>" : "") + "</td><td>" + (r.color ? sw(r.color) + ' <span class="mono" style="font-size:.75rem">' + esc(r.color) + "</span>" : "") + "</td><td>" + esc(r.text || (r.image ? "(image)" : "")) + "</td></tr>";
    }).join("");
    return '<div class="cols2"><div><b style="font-size:.88rem">Site fonts</b><ul class="where">' + (fonts || "<li class=\"muted\">None set in Elementor</li>") + '</ul></div><div><b style="font-size:.88rem">Site colours</b><ul class="where" style="list-style:none;padding-left:0">' + (cols || "<li class=\"muted\">None set in Elementor</li>") + "</ul></div></div>" +
      '<div class="table-wrap" style="max-height:360px;overflow:auto"><table><thead><tr><th>Block</th><th>Font, size, weight</th><th>Colour</th><th>Text now</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }
  function buildCard(p, st, redraw) {
    var card = el('<article class="panel fix"></article>');
    var built = st.status === "built", binned = st.status === "binned";
    var edits = p.edits || [];
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' +
      headChips(p, st).replace("</div>", (built ? '<span class="chip good">Draft ready for review</span>' : !p.ready ? '<span class="chip flag">Waiting on facts</span>' : "") + "</div>") +
      "<h2>" + esc(p.issue) + "</h2></div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "") + " · " + esc(p.created || "") + "</span></div>" +
      '<p style="font-size:.9rem"><b>Why it matters:</b> ' + esc(p.why) + "</p>" +
      '<div class="list">' +
        '<div class="list-item"><span class="chip">Page</span><div><div class="t">' + esc(p.newTitle || "") + '</div><div class="s mono">' + esc(p.address || "") + "</div></div><span></span></div>" +
        '<div class="list-item"><span class="chip">Design</span><div><div class="t">Copies the look of <a href="' + esc(p.template) + '" target="_blank" rel="noopener">' + esc(p.templateTitle || p.template) + "</a></div>" +
          '<div class="s">Same sections, fonts, text sizes, colours and spacing. That page itself isn\'t touched.</div></div><button type="button" class="btn small look">Check the look</button></div>' +
      "</div>" +
      '<div class="look-box"></div>' +
      (p.ready ? '<details><summary style="cursor:pointer;font-size:.88rem"><b>What the build changes (' + edits.length + ")</b></summary><ol class=\"steps-list\">" + edits.map(function (e) {
        return "<li>" + (e.op === "remove" ? "Remove the block with “" + esc(e.find) + "”" : "“" + esc(e.find) + "” becomes:<pre class=\"was\">" + esc(e.replace) + "</pre>") + "</li>"; }).join("") + "</ol></details>"
        : '<div><b style="font-size:.9rem">Waiting on</b><ol class="steps-list">' + (p.waitingOn || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>") +
      '<div class="fix-actions row"></div><div class="fix-msg"></div>';
    var actions = card.querySelector(".fix-actions"), msg = card.querySelector(".fix-msg"), look = card.querySelector(".look-box");
    var lookBtn = card.querySelector(".look");
    lookBtn.addEventListener("click", function () {
      if (look.innerHTML) { look.innerHTML = ""; lookBtn.textContent = "Check the look"; return; }
      look.innerHTML = '<div class="notice info">Reading the page design from WordPress. Nothing changes…</div>';
      pageStyle(p).then(function (s) { look.innerHTML = styleHtml(s); lookBtn.textContent = "Hide the look"; })
        .catch(function (err) { look.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
    });
    var LABEL = "Push new page build for review";
    if (built) {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">Built ' + esc(st.builtAt || "") + ". Not live. Only people logged in to WordPress can see it.</span>" +
        '<a class="btn primary" href="' + esc(st.preview) + '" target="_blank" rel="noopener">Preview the draft</a>' +
        '<a class="btn small" href="' + esc(st.editLink) + '" target="_blank" rel="noopener">Edit in Elementor</a>' +
        '<button type="button" class="btn small danger bin">Bin this draft</button>';
      var bin = actions.querySelector(".bin");
      bin.addEventListener("click", function () {
        if (!bin.dataset.sure) { bin.dataset.sure = "1"; bin.textContent = "Click again to bin it"; return; }
        bin.disabled = true;
        binDraft(st.draftId).then(function () {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "binned", binnedAt: when });
          logChange({ id: p.id, when: when, page: p.newTitle, link: p.address, type: TYPE_LABEL[p.type], action: "Draft binned" });
          toast("Draft moved to the bin in WordPress"); redraw(); updateNav();
        }).catch(function (err) { bin.disabled = false; msg.innerHTML = '<div class="notice"><b>Couldn\'t bin it.</b> ' + esc(err.message) + "</div>"; });
      });
    } else if (binned || st.status === "rejected") {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (binned ? "Draft binned " + esc(st.binnedAt || "") : "Not doing this") + '</span><button type="button" class="btn small">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].status; save("fix-state", s); redraw(); updateNav(); });
    } else {
      actions.innerHTML = '<button type="button" class="btn primary go"' + (p.ready && !p.example ? "" : " disabled") + ">" + LABEL + "</button>" +
        '<button type="button" class="btn rej">Not doing this</button>' +
        (p.ready ? "" : '<span class="muted" style="font-size:.86rem">Switches on once Claude has written the page.</span>');
      actions.querySelector(".go").addEventListener("click", function () {
        var btn = actions.querySelector(".go"); btn.disabled = true; btn.textContent = "Building the draft…";
        buildPage(p).then(function (r) {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "built", builtAt: when, draftId: r.id, preview: r.preview, editLink: r.edit });
          logChange({ id: p.id, when: when, page: p.newTitle, link: r.preview, type: TYPE_LABEL[p.type], action: "Draft built for review" });
          toast("Draft built. Nothing is live."); redraw(); updateNav();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = LABEL;
          msg.innerHTML = '<div class="notice"><b>Not built.</b> ' + esc(err.message) + "</div>";
        });
      });
      actions.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    }
    return card;
  }


  /* The claims check card: one row per page still making a false claim, each with the fix that clears it.
     Push from here, or check again. No "mark as done": the card goes when the site is clean. */
  /* The claim phrases a page was flagged for. Older saved checks only have them in the note. */
  function claimPageTerms(page) {
    if (page.terms && page.terms.length) return page.terms;
    var m = String(page.note || "").match(/^says: (.*?) \u00b7 /);
    return m ? m[1].split(/,\s*/) : [];
  }
  /* Only a fix that actually takes the claim off the page counts. Before v0.28.0 any open fix on the same
     page was shown here, so the Contact page offered its H1 fix for "West Pier Telecom". */
  function claimFixFor(page, s) {
    var terms = claimPageTerms(page).map(function (t) { return t.toLowerCase(); });
    var all = proposals().filter(function (x) {
      if (x.id === "auto-claims" || x.example || x.type === "manual" || x.type === "page_build" || norm(x.link) !== norm(page.link)) return false;
      if (s[x.id] && s[x.id].status && s[x.id].status !== "undone") return false;
      if (x.type === "set_status") return true;
      var hay = (String(x.find || "") + " " + String(x.current || "")).toLowerCase();
      return terms.some(function (t) { return t && hay.indexOf(t) > -1 && String(x.proposed || "").toLowerCase().indexOf(t) === -1; });
    });
    return all[0] || null;
  }
  /* Connor types the right wording once on the card. It's saved as a replacement rule, so every later
     audit fixes the phrase on any page by itself, then this page's fix is built and pushed. */
  function pushClaimReplace(page, term, replace) {
    var rules = claimRules().filter(function (r) { return r.find.toLowerCase() !== term.toLowerCase(); });
    rules.push({ find: term, replace: replace }); save("claim-rules", rules);
    return ruleFixes().then(function (fixes) {
      var fix = fixes.filter(function (f) { return norm(f.link) === norm(page.link) && f.find.toLowerCase() === term.toLowerCase(); })[0];
      if (!fix) throw new Error("The hub couldn't find \u201c" + term + "\u201d on this page any more. Click Check the site again now.");
      return pushFix(fix, fix.proposed).then(function (r) { return { fix: fix, r: r }; });
    });
  }
  function claimsCard(p, st, redraw) {
    var s = fixState(), pages = p.pages || [];
    var card = el('<article class="panel fix"></article>');
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' + headChips(p, st).replace(">Steps<", ">Claims check<") +
      "<h2>" + esc(p.issue) + "</h2></div>" +
      '<span class="mono muted" style="font-size:.75rem">Last checked ' + esc(p.created || "") + "</span></div>" +
      '<p style="font-size:.9rem"><b>Why it matters:</b> ' + esc(p.why) + "</p>" +
      '<div class="claim-rows"></div>' +
      '<div class="fix-actions row"><button type="button" class="btn primary recheck">Check the site again now</button><button type="button" class="btn rej">Not doing this</button>' +
      '<span class="muted" style="font-size:.86rem">Pages that are now clean drop off. The card goes when none are left.</span></div><div class="fix-msg"></div>';
    var rowsBox = card.querySelector(".claim-rows"), msg = card.querySelector(".fix-msg");
    /* After a push the site is checked again straight away. Clean pages drop off, and when none are left
       the card goes and the pushed fixes sit in Done. */
    function recheckAfterPush() {
      runClaimsCheck().then(function (left) {
        toast(left.length ? left.length + " page" + (left.length > 1 ? "s" : "") + " still to fix" : "All clear. Moved to Done.");
        redraw(); updateNav();
      }, function () {});
    }
    pages.forEach(function (pg) {
      var fix = claimFixFor(pg, s);
      var row = el('<div class="claim-row"><div class="claim-what"><a href="' + esc(pg.link) + '" target="_blank" rel="noopener"><b>' + esc(pg.title) + '</b></a><div class="muted" style="font-size:.82rem">' + esc(pg.note) + "</div>" +
        (fix ? '<div style="font-size:.84rem;margin-top:4px"><b>Fix:</b> ' + esc(TYPE_LABEL[fix.type] || fix.type) + (fix.type === "set_status" ? " (saved as a draft, nothing deleted, Undo puts it back)" : fix.proposed ? ": “" + esc(String(fix.proposed).slice(0, 140)) + "”" : "") + "</div>" : "") +
        '</div><div class="claim-act"></div></div>');
      var act = row.querySelector(".claim-act");
      var donePush = proposals().filter(function (x) { return x.id !== "auto-claims" && norm(x.link) === norm(pg.link) && s[x.id] && s[x.id].status === "pushed"; })[0];
      if (!fix && donePush) {
        act.innerHTML = '<span class="chip good">Fix pushed ' + esc(s[donePush.id].pushedAt || "") + '</span><div class="muted" style="font-size:.8rem;margin-top:4px">Check again to clear it.</div>';
      } else if (!fix) {
        var term = claimPageTerms(pg)[0] || "";
        var rule = claimRules().filter(function (r) { return r.find.toLowerCase() === term.toLowerCase(); })[0];
        act.innerHTML = '<label class="field" style="font-size:.82rem">Replace \u201c' + esc(term) + '\u201d with<input class="claim-new" value="' + esc(rule ? rule.replace : "") + '" placeholder="the right wording"></label>' +
          '<button type="button" class="btn small primary" style="margin-top:6px">Approve and push</button>';
        var rb = act.querySelector("button"), ri = act.querySelector(".claim-new");
        rb.addEventListener("click", function () {
          var val = ri.value.trim();
          if (!val) { ri.focus(); msg.innerHTML = '<div class="notice">Type the right wording first. It\'s saved, so the next audit fixes it on any page by itself.</div>'; return; }
          if (!rb.dataset.sure) { rb.dataset.sure = "1"; rb.textContent = "Click again to push"; return; }
          rb.disabled = true; rb.textContent = "Pushing\u2026";
          pushClaimReplace(pg, term, val).then(function (o) {
            var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
            setFix(o.fix.id, { status: "pushed", before: o.r.before, after: o.r.after, pushedAt: when, pageId: o.r.pageId || o.fix.pageId, backup: o.r.backup || "" });
            logChange({ id: o.fix.id, when: when, page: o.fix.pageTitle, link: o.fix.link, type: TYPE_LABEL[o.fix.type], action: "Pushed live" });
            act.innerHTML = '<span class="chip good">Done</span>'; toast("Live on the site. Checking the page again\u2026"); updateNav(); recheckAfterPush();
          }).catch(function (err) {
            rb.disabled = false; delete rb.dataset.sure; rb.textContent = "Approve and push";
            msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + "</div>";
          });
        });
      } else if (fix.type === "elementor_remove" && (fixState()[fix.id] || {}).level == null) {
        act.innerHTML = '<a class="btn small" href="#fixes" data-jump="' + esc(fix.id) + '">Choose what to remove</a>';
      } else {
        var label = fix.type === "set_status" ? "Approve and unpublish" : "Approve and push";
        act.innerHTML = '<button type="button" class="btn small primary">' + label + "</button>";
        var b = act.querySelector("button");
        b.addEventListener("click", function () {
          if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to push"; return; }
          b.disabled = true; b.textContent = "Pushing…";
          var cur = fixState()[fix.id] || {};
          pushFix(fix, cur.edited != null ? cur.edited : fix.proposed).then(function (r) {
            var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
            setFix(fix.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, editLink: r.editLink || "", pageId: r.pageId || fix.pageId, backup: r.backup || "" });
            logChange({ id: fix.id, when: when, page: fix.pageTitle, link: fix.link, type: TYPE_LABEL[fix.type], action: fix.type === "set_status" ? "Unpublished" : "Pushed live" });
            act.innerHTML = '<span class="chip good">Done</span>';
            toast(fix.type === "set_status" ? "Page unpublished. Undo is in Done." : "Live on the site. Checking the page again\u2026"); recheckAfterPush();
            updateNav();
          }).catch(function (err) {
            b.disabled = false; delete b.dataset.sure; b.textContent = label;
            msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + "</div>";
          });
        });
      }
      rowsBox.appendChild(row);
    });
    card.querySelector(".recheck").addEventListener("click", function () {
      var b = card.querySelector(".recheck"); b.disabled = true; b.textContent = "Checking every page…";
      runClaimsCheck().then(function (left) {
        toast(left.length ? left.length + " page" + (left.length > 1 ? "s" : "") + " still to fix" : "All clear. No false claims found.");
        redraw(); updateNav();
      }).catch(function (err) { b.disabled = false; b.textContent = "Check the site again now"; msg.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
    });
    card.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    return card;
  }

  /* Pages with no links pointing to them. The hub finds a sentence on another page that already uses the
     page's topic words, and writes a fix that turns those words into a link. Connor approves and it goes
     live, one link at a time or all at once. Nothing to mark as done: the next audit clears the card. */
  var LINK_STOP = { the: 1, and: 1, for: 1, with: 1, our: 1, your: 1, from: 1, into: 1, what: 1, how: 1, why: 1, are: 1, is: 1, a: 1, an: 1, of: 1, to: 1, in: 1, on: 1, at: 1, by: 1, or: 1, vs: 1, uk: 0, complete: 1, guide: 1, page: 1, west: 1, pier: 1, technologies: 1, telecom: 1, best: 1, top: 1, new: 1 };
  function linkPhrases(title) {
    var t = String(title || "").replace(/\s*[|–—-]\s*West Pier.*$/i, "").replace(/\b(19|20)\d\d\b/g, "").replace(/[:?!.,()‘’“”"']/g, " ").replace(/\s+/g, " ").trim();
    var w = t.split(" ").filter(Boolean), out = [];
    function keep(ph) { ph = ph.trim(); if (ph.length >= 3 && out.indexOf(ph) === -1) out.push(ph); }
    /* "Phone Systems" on its own says nothing about which page it leads to. */
    function generic(g) { return g.every(function (x) { return /^(phone|phones|system|systems|business|businesses|services?|solutions?|software|support|brighton|sussex|uk)$/i.test(x); }); }
    if (w.length >= 2 && w.length <= 6) keep(t);
    /* Short phrases first: two words like "Engage Voice" turn up in body text far more often than long ones. */
    function grams(n) {
      for (var i = 0; i + n <= w.length && n < w.length; i++) {
        var g = w.slice(i, i + n);
        if (LINK_STOP[g[0].toLowerCase()] || LINK_STOP[g[n - 1].toLowerCase()] || generic(g)) continue;
        keep(g.join(" "));
      }
    }
    grams(2);
    /* One word only when it's a product name (3CX, UCaaS, VoIP), never a plain word like "feature". */
    w.forEach(function (x) { if (x.length >= 3 && !LINK_STOP[x.toLowerCase()] && (/\d/.test(x) || /^[A-Za-z][a-z]*[A-Z]/.test(x) || /^[A-Z]{2,}$/.test(x))) keep(x); });
    grams(3); grams(4);
    return out.slice(0, 10);
  }
  /* The phrase exactly as written in the snippet, so the swap matches the page's own capitals. */
  /* Where the phrase starts in the snippet, whole words only (-1 if it isn't there). */
  function phraseAt(snippet, ph) {
    var sn = String(snippet || ""), low = sn.toLowerCase(), q = String(ph || "").toLowerCase(), at = low.indexOf(q);
    while (at > -1) {
      var bef = sn.charAt(at - 1) || " ", aft = sn.charAt(at + q.length) || " ", first = sn.charAt(at), last = sn.charAt(at + q.length - 1);
      var okB = !/[a-z0-9]/i.test(bef) || (/[a-z]/.test(bef) && /[A-Z]/.test(first));
      var okA = !/[a-z0-9]/i.test(aft) || (/[a-z]/.test(last) && /[A-Z]/.test(aft));
      if (okB && okA) return at;
      at = low.indexOf(q, at + 1);
    }
    return -1;
  }
  /* A few words either side of the phrase, so the swap finds this exact spot even when the phrase is
     used elsewhere on the page. Stops at a sentence end or where two blocks of text join, as the page's
     own markup may sit there. */
  function linkContext(snippet, at, len) {
    var sn = String(snippet || ""), L = at, R = at + len;
    function stopAt(i) { var a = sn.charAt(i - 1), b = sn.charAt(i); return /[.!?:;]/.test(a) || (/[a-z0-9)]/.test(a) && /[A-Z]/.test(b)); }
    var l = at;
    while (l > 0 && at - l < 45 && !stopAt(l)) l--;
    if (l === 0 && at > 0) { var sp = sn.indexOf(" ", 0); l = sp > -1 && sp < at ? sp + 1 : at; }
    else if (l > 0 && at - l >= 45) { var sp2 = sn.indexOf(" ", l); l = sp2 > -1 && sp2 < at ? sp2 + 1 : at; }
    var r = R;
    while (r < sn.length && r - R < 45 && !stopAt(r) && !/[.!?:;]/.test(sn.charAt(r))) r++;
    if (r >= sn.length && R < sn.length) { var sp3 = sn.lastIndexOf(" ", sn.length - 1); r = sp3 > R ? sp3 : R; }
    else if (r - R >= 45) { var sp4 = sn.lastIndexOf(" ", r); r = sp4 > R ? sp4 : R; }
    return { before: sn.slice(l, at).replace(/^\s+/, ""), after: sn.slice(R, r).replace(/\s+$/, "") };
  }
  /* Whole words only, so "Feature" never matches inside "features". */
  function phraseIn(snippet, ph) {
    var sn = String(snippet || ""), low = sn.toLowerCase(), q = String(ph || "").toLowerCase(), at = low.indexOf(q);
    while (at > -1) {
      /* Text from blocks is joined with no space ("Contact UsWest Pier"), so a lower-to-capital change counts as a word break too. */
      var bef = sn.charAt(at - 1) || " ", aft = sn.charAt(at + q.length) || " ", first = sn.charAt(at), last = sn.charAt(at + q.length - 1);
      var okB = !/[a-z0-9]/i.test(bef) || (/[a-z]/.test(bef) && /[A-Z]/.test(first));
      var okA = !/[a-z0-9]/i.test(aft) || (/[a-z]/.test(last) && /[A-Z]/.test(aft));
      if (okB && okA) return sn.slice(at, at + q.length);
      at = low.indexOf(q, at + 1);
    }
    return "";
  }
  /* Map widgets look places up by name. The hub doesn't change them, so they don't count as the page saying it. */
  function textHits(rows) {
    return (rows || []).map(function (r) { return Object.assign({}, r, { hits: (r.hits || []).filter(function (h) { return h.widget !== "google_maps"; }) }); }).filter(function (r) { return r.hits.length; });
  }
  var LINK_V = 2;
  function linkFix(orphan, row, hit, ph) {
    var at = phraseAt(hit.snippet, ph), exact = phraseIn(hit.snippet, ph), id = "link-" + autoKey(orphan.link) + "-" + autoKey(row.link);
    var c = linkContext(hit.snippet, at, exact.length);
    var a = c.before + '<a href="' + orphan.link + '">' + exact + "</a>" + c.after;
    exact = c.before + exact + c.after;
    return { id: id, auto: true, parent: "auto-orphans", target: orphan.link, created: today(), batch: "Links to hidden pages", type: row.elementor ? "elementor_swap" : "content_replace",
      size: "small", priority: "high", category: "Structure", postType: row.type === "post" ? "posts" : "pages", pageId: row.post_id, pageTitle: row.title, link: row.link,
      find: exact, current: exact, proposed: a, snippet: hit.snippet, lv: LINK_V, anchor: phraseIn(hit.snippet, ph),
      issue: "Link “" + phraseIn(hit.snippet, ph) + "” to " + (orphan.title || shortPath(orphan.link)),
      why: "Gives " + (orphan.title || "this page") + " a link from a page Google already reads. Only those words become a link; nothing else on " + row.title + " changes." };
  }
  /* Up to two spots per hidden page, each on a different page, never the page itself or another hidden page. */
  function suggestLinks(orphan, orphanLinks, skip) {
    var found = [], used = {}; used[norm(orphan.link)] = 1;
    (skip || []).forEach(function (u) { used[u] = 1; });
    return linkPhrases(orphan.title).reduce(function (pr, ph) {
      return pr.then(function () {
        if (found.length >= 2) return;
        return findText(ph).then(function (rows) {
          rows.forEach(function (r) {
            if (found.length >= 2 || used[norm(r.link)] || orphanLinks[norm(r.link)]) return;
            var hit = linkHit(r, ph);
            if (!hit) return;
            used[norm(r.link)] = 1; found.push(linkFix(orphan, r, hit, ph));
          });
        }, function () {});
      });
    }, Promise.resolve()).then(function () { return found; });
  }
  function linksFor(orphan) {
    var st0 = fixState();
    return proposals().filter(function (x) {
      if (x.parent && x.auto && x.lv !== LINK_V && !(st0[x.id] && st0[x.id].status)) return false;
      return !x.example && x.type !== "manual" && (norm(x.target || "") === norm(orphan.link) || String(x.proposed || "").indexOf('href="' + orphan.link + '"') > -1 || String(x.proposed || "").indexOf('href="' + orphan.link.replace(/\/$/, "") + '"') > -1);
    });
  }
  /* Is a page password-protected? WordPress says so in its content. Remembered once known. */
  function checkLocked(pg) {
    var known = load("protected-pages", {});
    if (norm(pg.link) in known) return Promise.resolve(known[norm(pg.link)]);
    var slug = shortPath(pg.link).replace(/\/$/, "").split("/").pop();
    if (!slug) return Promise.resolve(false);
    function ask(type) { return wpFetch("/wp/v2/" + type + "?slug=" + encodeURIComponent(slug) + "&_fields=id,link,content").then(function (rows) { return (rows || []).filter(function (r) { return norm(r.link) === norm(pg.link); })[0]; }); }
    return ask("pages").then(function (r) { return r || ask("posts"); }).then(function (r) {
      var locked = !!(r && r.content && r.content.protected);
      var k2 = load("protected-pages", {}); k2[norm(pg.link)] = locked; save("protected-pages", k2);
      return locked;
    });
  }
  function orphansCard(p, st, redraw) {
    var pages = p.pages || [], orphanLinks = {};
    pages.forEach(function (x) { orphanLinks[norm(x.link)] = 1; });
    var card = el('<article class="panel fix"></article>');
    card.innerHTML =
      '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' + headChips(p, st).replace(">Steps<", ">Add links<") +
      "<h2>" + esc(p.issue) + "</h2></div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "Found by audit") + " · " + esc(p.created || "") + "</span></div>" +
      '<p style="font-size:.9rem"><b>Why it matters:</b> ' + esc(p.why) + " Each fix below turns words already on another page into a link. Nothing else changes, and Undo is in Done.</p>" +
      '<div class="claim-rows"></div>' +
      '<div class="fix-actions row"><button type="button" class="btn primary all">Approve and push all</button><button type="button" class="btn rej">Not doing this</button>' +
      '<span class="muted" style="font-size:.86rem">The next audit clears pages that now have a link.</span></div><div class="fix-msg"></div>';
    var rowsBox = card.querySelector(".claim-rows"), msg = card.querySelector(".fix-msg");
    var sugs = load("auto-fixes-links", []), queue = [], rowShows = [];
    function leaveKey(pg) { return "orphan-leave-" + autoKey(pg.link); }
    function isLocked(pg) { return load("protected-pages", {})[norm(pg.link)] === true; }
    /* A page is sorted once it has a live link, you've chosen to leave it, or it's password-protected
       (a link to a locked page doesn't help anyone). */
    function resolved(pg, s) { return isLocked(pg) || !!(s[leaveKey(pg)] && s[leaveKey(pg)].status) || linksFor(pg).some(function (x) { return s[x.id] && s[x.id].status === "pushed"; }); }
    function pushOne(fix, act) {
      var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      return pushFix(fix, fix.proposed).then(function (r) {
        setFix(fix.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, pageId: r.pageId || fix.pageId, backup: r.backup || "" });
        logChange({ id: fix.id, when: when, page: fix.pageTitle, link: fix.link, type: "Add a link", action: "Link added: " + fix.issue });
        act.innerHTML = '<span class="chip good">Live</span>';
      });
    }
    pages.forEach(function (pg) {
      var row = el('<div class="claim-row"><div class="claim-what"><a href="' + esc(pg.link) + '" target="_blank" rel="noopener"><b>' + esc(pg.title) + '</b></a><div class="muted" style="font-size:.82rem">' + esc(shortPath(pg.link)) + '</div><div class="link-fixes"></div></div><div class="claim-act"></div></div>');
      var box = row.querySelector(".link-fixes"), rowAct = row.querySelector(".claim-act");
      function show() {
        var s = fixState(), mine = linksFor(pg);
        var live = mine.filter(function (x) { return s[x.id] && s[x.id].status === "pushed"; });
        var open = mine.filter(function (x) { return !(s[x.id] && s[x.id].status); });
        if (isLocked(pg)) {
          row.classList.add("is-fixed");
          rowAct.innerHTML = '<span class="chip">Left: password-protected</span>';
          box.innerHTML = '<div class="muted" style="font-size:.82rem;margin-top:4px">Visitors only see a password box, so the hub won\'t link to it.' + (live.length ? " The link already added sends people to a locked page:" : "") + "</div>";
          live.forEach(function (x) {
            var u = el('<button type="button" class="btn small danger" style="margin-top:6px">Undo the link from ' + esc(x.pageTitle) + "</button>");
            u.addEventListener("click", function () {
              u.disabled = true; u.textContent = "Undoing\u2026";
              undoFix(x, fixState()[x.id] || {}).then(function () {
                var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
                setFix(x.id, { status: "undone", undoneAt: when });
                logChange({ id: x.id, when: when, page: x.pageTitle, link: x.link, type: "Add a link", action: "Undone: link to a password-protected page" });
                toast("Link removed"); show();
              }, function (e) { u.disabled = false; u.textContent = "Undo the link from " + x.pageTitle; msg.innerHTML = '<div class="notice"><b>Couldn\'t undo.</b> ' + esc(e.message) + "</div>"; });
            });
            box.appendChild(u);
          });
          return 1;
        }
        if (s[leaveKey(pg)] && s[leaveKey(pg)].status && !live.length) {
          row.classList.add("is-fixed");
          rowAct.innerHTML = '<span class="chip">Left as it is</span> <button type="button" class="btn small">Put back</button>';
          rowAct.querySelector("button").addEventListener("click", function () { var s2 = fixState(); delete s2[leaveKey(pg)]; save("fix-state", s2); show(); find(false); });
          box.innerHTML = "";
          return 1;
        }
        box.innerHTML = ""; rowAct.innerHTML = live.length ? '<span class="chip good">Fixed: ' + live.length + " link" + (live.length > 1 ? "s" : "") + " live</span>" : '<button type="button" class="btn small leave">Leave this page</button>';
        var lv = rowAct.querySelector(".leave");
        if (lv) lv.addEventListener("click", function () { setFix(leaveKey(pg), { status: "rejected" }); show(); allDone(); });
        /* One link from a live page is enough to stop it being hidden, so a fixed page folds away. */
        row.classList.toggle("is-fixed", live.length > 0);
        if (live.length) { box.innerHTML = '<div class="muted" style="font-size:.82rem;margin-top:4px">Linked from ' + live.map(function (x) { return esc(x.pageTitle); }).join(", ") + ".</div>"; return live.length; }
        open.forEach(function (fix) {
          var f = el('<div class="row" style="justify-content:space-between;gap:8px;margin-top:6px;font-size:.84rem"><div><b>From</b> <a href="' + esc(fix.link) + '" target="_blank" rel="noopener">' + esc(fix.pageTitle) + "</a>: " +
            (fix.snippet ? "…" + esc(fix.snippet).replace(esc(fix.anchor || fix.find), "<u>" + esc(fix.anchor || fix.find) + "</u>") + "…" : esc(fix.issue)) + '</div><div class="row" style="gap:6px"><button type="button" class="btn small primary">Approve and push</button><button type="button" class="btn small skip">Skip</button></div></div>');
          var b = f.querySelector(".primary"), act = f.querySelector(".row");
          queue.push({ fix: fix, act: act });
          b.addEventListener("click", function () {
            b.disabled = true; b.textContent = "Pushing…";
            pushOne(fix, act).then(function () { toast("Link live"); show(); allDone(); updateNav(); }, function (err) {
              b.disabled = false; b.textContent = "Approve and push";
              msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + (fix.auto ? " Click Skip and the hub will look for another spot." : "") + "</div>";
            });
          });
          f.querySelector(".skip").addEventListener("click", function () { setFix(fix.id, { status: "rejected" }); find(true); });
          box.appendChild(f);
        });
        if (!open.length && !live.length) box.innerHTML = '<div class="muted" style="font-size:.82rem;margin-top:4px">Looking for a sentence to link from…</div>';
        return open.length + live.length;
      }
      function find(force) {
        if (show() && !force) return;
        var none = load("orphan-none", {});
        if (!force && none[norm(pg.link)] === today() + "|" + VERSION) { box.innerHTML = '<div class="muted" style="font-size:.82rem;margin-top:4px">No page mentions this topic in a way that suits a link. Use Copy list for Claude and it will write one.</div>'; return; }
        var s = fixState(), tried = linksFor(pg).filter(function (x) { return x.auto && s[x.id] && s[x.id].status === "rejected"; }).map(function (x) { return norm(x.link); });
        suggestLinks(pg, orphanLinks, tried).then(function (found) {
          var keep = load("auto-fixes-links", []).filter(function (x) { return norm(x.target) !== norm(pg.link) || (fixState()[x.id] || {}).status; });
          save("auto-fixes-links", keep.concat(found.filter(function (f) { return !keep.some(function (k) { return k.id === f.id; }); })));
          if (!found.length) { var nn = load("orphan-none", {}); nn[norm(pg.link)] = today() + "|" + VERSION; save("orphan-none", nn); }
          if (!show()) box.innerHTML = '<div class="muted" style="font-size:.82rem;margin-top:4px">No page mentions this topic in a way that suits a link. Use Copy list for Claude and it will write one.</div>';
        }, function (err) { box.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
      }
      rowsBox.appendChild(row);
      rowShows.push(show);
      checkLocked(pg).then(function (locked) { if (locked) { show(); allDone(); } else find(false); }, function () { find(false); });
    });
    /* When every page has a live link the card moves to Done by itself. The next audit reopens it if
       Google's view of the site disagrees. */
    function allDone() {
      var s = fixState(), left = pages.filter(function (pg) { return !resolved(pg, s); });
      if (left.length) return false;
      var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      setFix(p.id, { status: "done", doneAt: when, doneTs: Date.now(), reopened: false });
      logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: "Add a link", action: "Every hidden page now has a link" });
      toast("Every page is sorted. Moved to Done."); redraw(); updateNav();
      return true;
    }
    var allBtn = card.querySelector(".all");
    allBtn.addEventListener("click", function () {
      var s = fixState(), todo = queue.filter(function (q) { return !(s[q.fix.id] && s[q.fix.id].status) && q.act.isConnected; });
      if (!todo.length) { msg.innerHTML = '<div class="notice info">Nothing waiting to push yet.</div>'; return; }
      if (!allBtn.dataset.sure) { allBtn.dataset.sure = "1"; allBtn.textContent = "Click again to push " + todo.length + " link" + (todo.length > 1 ? "s" : ""); return; }
      allBtn.disabled = true; var okN = 0, bad = [];
      todo.reduce(function (pr, q) {
        return pr.then(function () { allBtn.textContent = "Pushing " + (okN + bad.length + 1) + " of " + todo.length + "…"; return pushOne(q.fix, q.act).then(function () { okN++; }, function (e) { bad.push(q.fix.pageTitle + ": " + e.message); }); });
      }, Promise.resolve()).then(function () {
        allBtn.disabled = false; delete allBtn.dataset.sure; allBtn.textContent = "Approve and push all";
        toast(okN + " link" + (okN === 1 ? "" : "s") + " live"); rowShows.forEach(function (f) { f(); }); updateNav();
        if (allDone()) return;
        if (bad.length) msg.innerHTML = '<div class="notice"><b>' + bad.length + " not pushed.</b> " + bad.map(esc).join("<br>") + " Click Skip on those and the hub will find another spot.</div>";
      });
    });
    Array.prototype.slice.call(rowsBox.querySelectorAll(".is-fixed")).forEach(function (r) { rowsBox.appendChild(r); });
    var copy = el('<button type="button" class="btn small">Copy list for Claude</button>');
    card.querySelector(".fix-actions").insertBefore(copy, card.querySelector(".fix-actions span"));
    copy.addEventListener("click", function () {
      copyText("From the hub Fix queue: " + p.issue + "\n" + pages.map(function (x) { return "- " + x.link; }).join("\n") + "\nPlease write link fixes I can push for any the hub couldn't find a spot for.", "Copied. Paste it into Claude.");
    });
    card.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    return card;
  }

  /* Every card in the Fix queue is one of four kinds. No card is closed by ticking it off:
     push   the hub makes the change (Approve and push)
     decide a choice only Connor can make, and the button is the choice
     claude Claude writes new wording; the card closes itself when the audit stops finding the problem
     job    work off the website (listings, hosting, Matt's templates), kept in Your jobs instead */
  var JOB_RE = /^(auto-robots|auto-sitemap-missing$|auto-sitemap-bad|auto-sitemap-missing-pages|auto-variant|auto-verify-google|auto-redirect-dead|auto-redirect-chain|auto-slow|auto-schema|mob-slow|mob-images|mob-viewport|mob-cwv-field|ga4-no-leads)/;
  function cardMode(p) {
    if (p.type !== "manual" || p.id === "auto-claims" || p.id === "auto-orphans") return "push";
    if (!p.auto || JOB_RE.test(p.id)) return "job";
    if (/^(auto-cannibal-|gsc-split-)/.test(p.id)) return "decide";
    return "claude";
  }
  function cardHead(p, st, label) {
    return '<div class="panel-head"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">' + headChips(p, st).replace(">Steps<", ">" + esc(label) + "<") +
      "<h2>" + esc(p.issue) + "</h2>" + (p.pageTitle && p.pageTitle !== "Whole site" && !(p.pages || []).length ? '<p class="muted" style="font-size:.86rem"><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.pageTitle) + "</a></p>" : "") + "</div>" +
      '<span class="mono muted" style="font-size:.75rem">' + esc(p.batch || "") + " · " + esc(p.created || "") + "</span></div>" +
      (p.why ? '<p style="font-size:.9rem"><b>Why it matters:</b> ' + esc(p.why) + "</p>" : "");
  }
  function whereList(pages) {
    if (!(pages || []).length) return "";
    return "<details" + (pages.length <= 6 ? " open" : "") + '><summary style="cursor:pointer;font-size:.88rem"><b>Where (' + pages.length + ")</b></summary><ul class=\"where\">" +
      pages.map(function (x) { return '<li><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(String(x.title || "").trim() || shortPath(x.link)) + "</a>" + (x.note ? ' <span class="muted">· ' + esc(x.note) + "</span>" : "") + "</li>"; }).join("") + "</ul></details>";
  }
  function claudeText(p) {
    return "From the hub Fix queue: " + p.issue + "\n" + (p.why ? p.why + "\n" : "") + (p.pages || [{ link: p.link }]).map(function (x) { return "- " + x.link + (x.note ? " (" + x.note + ")" : ""); }).join("\n") +
      "\nPlease write these as fixes I can push from the hub.";
  }
  function claudeCard(p, st, redraw) {
    var card = el('<article class="panel fix"></article>');
    card.innerHTML = cardHead(p, st, "Claude writes") + whereList(p.pages) +
      '<p class="muted" style="font-size:.86rem">The hub can\'t write new wording itself. Copy this for Claude: the fixes come back here ready to push. This card closes itself once the audit or check stops finding the problem.</p>' +
      '<div class="fix-actions row"></div>';
    var actions = card.querySelector(".fix-actions");
    if (!st.status) {
      actions.innerHTML = '<button type="button" class="btn primary">Copy for Claude</button><button type="button" class="btn rej">Not doing this</button>';
      actions.querySelector(".primary").addEventListener("click", function () { copyText(claudeText(p), "Copied. Paste it into Claude."); });
      actions.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    } else {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (st.status === "rejected" ? "Not doing this" : "Closed " + esc(st.doneAt || "")) + '</span><button type="button" class="btn small">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].status; save("fix-state", s); redraw(); updateNav(); });
    }
    return card;
  }
  function decideCard(p, st, redraw) {
    var card = el('<article class="panel fix"></article>');
    card.innerHTML = cardHead(p, st, "Your call") + whereList(p.pages) +
      '<p class="muted" style="font-size:.86rem">Only you can decide this. If the pages answer different questions, keep both and the hub stops flagging them. If they really overlap, Claude writes the merge and redirect as fixes you can push.</p><div class="fix-actions row"></div>';
    var actions = card.querySelector(".fix-actions");
    if (!st.status) {
      actions.innerHTML = '<button type="button" class="btn primary keep">Keep both, they\'re different</button><button type="button" class="btn merge">Merge them (copy for Claude)</button>';
      actions.querySelector(".keep").addEventListener("click", function () {
        var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
        setFix(p.id, { status: "rejected", decided: "keep", doneAt: when });
        logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: "Decision", action: "Kept both: " + p.issue });
        toast("Kept both. The hub won't flag this pair again."); redraw(); updateNav();
      });
      actions.querySelector(".merge").addEventListener("click", function () {
        copyText("From the hub Fix queue: these two pages compete for the same searches. Please merge them: keep the stronger one, move anything useful from the other into it, and write a 301 redirect, as fixes I can push.\n" + (p.pages || []).map(function (x) { return "- " + x.link; }).join("\n"), "Copied. Paste it into Claude.");
      });
    } else {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (st.decided === "keep" ? "Kept both" : "Not doing this") + '</span><button type="button" class="btn small">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) { delete s[p.id].status; delete s[p.id].decided; } save("fix-state", s); redraw(); updateNav(); });
    }
    return card;
  }

  /* A group card holds a list of small fixes for one problem (titles, alt text, extra H1s and so on).
     Push them one by one or all at once. Skip any you don't want. When none are left, the card moves to Done. */
  function groupKids(p) {
    var st0 = fixState();
    return proposals().filter(function (x) { return x.parent === p.id && !(x.target && x.lv !== LINK_V && !(st0[x.id] && st0[x.id].status)); });
  }
  function editableKid(k) { return k.type === "meta_title" || k.type === "meta_description" || k.op === "alt"; }
  function groupCard(p, st, redraw) {
    var card = el('<article class="panel fix"></article>');
    card.innerHTML = cardHead(p, st, p.groupLabel || "Fixes") + '<div class="claim-rows"></div><div class="fix-actions row"></div><div class="fix-msg"></div>';
    var rowsBox = card.querySelector(".claim-rows"), actions = card.querySelector(".fix-actions"), msg = card.querySelector(".fix-msg");
    var kids = groupKids(p), boxes = {};
    if (st.status) {
      actions.innerHTML = '<span class="muted" style="font-size:.86rem">' + (st.status === "rejected" ? "Not doing this" : "Done " + esc(st.doneAt || "") + ". Each change is in Done with its own Undo.") + '</span><button type="button" class="btn small">Put back in the queue</button>';
      actions.querySelector("button").addEventListener("click", function () { var s = fixState(); if (s[p.id]) delete s[p.id].status; save("fix-state", s); redraw(); updateNav(); });
      return card;
    }
    if (p.producer === "fewLinks" && !kids.length) {
      var tried = load("few-links-searched", "");
      if (tried !== (p.created || "x")) {
        rowsBox.innerHTML = '<div class="notice info">Looking for sentences in these posts that mention your service pages…</div>';
        fewLinksProducer(p, function (i, n) { rowsBox.innerHTML = '<div class="notice info">Looking for sentences in these posts that mention your service pages (' + i + " of " + n + ")…</div>"; }).then(function (found) {
          var keep = load("auto-fixes-links", []).filter(function (x) { return x.parent !== p.id || (fixState()[x.id] || {}).status; });
          save("auto-fixes-links", keep.concat(found)); save("few-links-searched", p.created || "x"); redraw(); updateNav();
        }, function (err) { rowsBox.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
        return card;
      }
    }
    /* Nothing the hub could write (for example no sentence mentions a service page): Claude writes these. */
    if (!kids.length) return claudeCard(p, st, redraw);
    function finish() {
      var all = groupKids(p), s = fixState(), open = all.filter(function (k) { return !(s[k.id] && s[k.id].status); });
      if (!all.length || open.length) return false;
      var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      setFix(p.id, { status: "done", doneAt: when, doneTs: Date.now() });
      logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: p.groupLabel || "Fixes", action: "All done: " + p.issue });
      toast("All done. Moved to Done."); redraw(); updateNav();
      return true;
    }
    function pushKid(k, row) {
      var cur = fixState()[k.id] || {}, box = boxes[k.id];
      var value = box ? box.value : cur.edited != null ? cur.edited : k.proposed;
      var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      return pushFix(k, value).then(function (r) {
        setFix(k.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, pageId: r.pageId || k.pageId, backup: r.backup || "" });
        logChange({ id: k.id, when: when, page: k.pageTitle, link: k.link, type: typeLabel(k), action: "Pushed live: " + k.issue });
        row.querySelector(".kid-act").innerHTML = '<span class="chip good">Live</span>' + (r.skipped && r.skipped.length ? '<div class="muted" style="font-size:.78rem">' + r.skipped.length + " not in the Media Library, skipped</div>" : "");
      });
    }
    var shown = 0;
    kids.forEach(function (k) {
      var ks = fixState()[k.id] || {};
      if (ks.status) return;
      shown++;
      var val = ks.edited != null ? ks.edited : k.op === "alt" && k.items ? altText(k.items) : k.proposed;
      var row = el('<div class="claim-row"' + (editableKid(k) ? ' style="flex-direction:column;align-items:stretch"' : "") + '><div class="claim-what" style="flex:1;min-width:0"><a href="' + esc(k.link) + '" target="_blank" rel="noopener"><b>' + esc(k.pageTitle || shortPath(k.link)) + '</b></a> <span class="muted" style="font-size:.8rem">' + esc(k.issue || "") + "</span>" +
        (k.current && k.op !== "alt" ? '<div class="muted" style="font-size:.8rem;margin-top:2px">Now: ' + esc(String(k.current).slice(0, 220)) + "</div>" : "") +
        (editableKid(k) ? (k.op === "alt" ? '<textarea class="kid-box" style="width:100%;box-sizing:border-box;min-height:' + Math.min(220, 40 + 22 * (k.items || []).length) + 'px;margin-top:6px">' + esc(val) + "</textarea>" : '<input class="kid-box" style="margin-top:6px;width:100%;box-sizing:border-box" value="' + esc(val) + '">') + (k.type === "meta_title" || k.type === "meta_description" ? '<span class="hint mono" style="font-size:.75rem"></span>' : "")
          : '<div style="font-size:.84rem;margin-top:4px"><b>Fix:</b> ' + esc(String(k.display || val || "").slice(0, 300)) + "</div>") +
        '</div><div class="kid-act row" style="gap:6px;align-self:center"><button type="button" class="btn small primary">Approve and push</button><button type="button" class="btn small skip">Skip</button></div></div>');
      var box = row.querySelector(".kid-box"), hint = row.querySelector(".hint");
      if (box) {
        boxes[k.id] = box;
        var showHint = function () { if (hint) hint.textContent = lengthHint(k.type, box.value); };
        showHint(); box.addEventListener("input", function () { showHint(); setFix(k.id, { edited: box.value }); });
      }
      var b = row.querySelector(".primary");
      b.addEventListener("click", function () {
        b.disabled = true; b.textContent = "Pushing…";
        pushKid(k, row).then(function () { toast("Live on the site"); updateNav(); finish(); }, function (err) {
          b.disabled = false; b.textContent = "Approve and push";
          msg.innerHTML = '<div class="notice"><b>' + esc(k.pageTitle || "") + ": not pushed.</b> " + esc(err.message) + " Skip it if it isn't wanted.</div>";
        });
      });
      row.querySelector(".skip").addEventListener("click", function () { setFix(k.id, { status: "rejected" }); row.remove(); finish(); updateNav(); });
      rowsBox.appendChild(row);
    });
    if (!shown) {
      if (finish()) return card;
      rowsBox.innerHTML = '<div class="muted" style="font-size:.86rem">Nothing left to push.</div>';
    }
    actions.innerHTML = '<button type="button" class="btn primary all">Approve and push all (' + shown + ')</button><button type="button" class="btn rej">Not doing this</button>' +
      '<span class="muted" style="font-size:.86rem">Every change keeps a copy, and each one has its own Undo in Done.</span>';
    var allBtn = actions.querySelector(".all");
    allBtn.addEventListener("click", function () {
      var s = fixState(), todo = groupKids(p).filter(function (k) { return !(s[k.id] && s[k.id].status); });
      if (!todo.length) return;
      if (!allBtn.dataset.sure) { allBtn.dataset.sure = "1"; allBtn.textContent = "Click again to push " + todo.length; return; }
      allBtn.disabled = true; var okN = 0, bad = [];
      todo.reduce(function (pr, k) {
        return pr.then(function () {
          allBtn.textContent = "Pushing " + (okN + bad.length + 1) + " of " + todo.length + "…";
          var row = Array.prototype.filter.call(rowsBox.children, function (r) { return r.querySelector("a") && r.querySelector("a").getAttribute("href") === k.link && r.querySelector(".kid-act button"); })[0] || el('<div><div class="kid-act"></div></div>');
          return pushKid(k, row).then(function () { okN++; }, function (e) { bad.push((k.pageTitle || shortPath(k.link)) + ": " + e.message); });
        });
      }, Promise.resolve()).then(function () {
        toast(okN + " pushed"); updateNav();
        if (finish()) return;
        allBtn.disabled = false; delete allBtn.dataset.sure; allBtn.textContent = "Approve and push all";
        if (bad.length) msg.innerHTML = '<div class="notice"><b>' + bad.length + " not pushed.</b><br>" + bad.map(esc).join("<br>") + "<br>Skip any that aren't wanted and the card moves to Done.</div>";
      });
    });
    actions.querySelector(".rej").addEventListener("click", function () { setFix(p.id, { status: "rejected" }); toast("Moved to Not doing"); redraw(); updateNav(); });
    return card;
  }

  /* Which words on a page can become a link: body text only, never headings, buttons or the page title. */
  function linkHit(r, ph) {
    return (r.hits || []).filter(function (h) {
      return (h.widget === "text-editor" || h.widget === "content" || /(^|\.)(editor|description_text|tab_content|content|text)$/.test(h.field || "") && !/heading|button|page title/.test(h.widget)) && phraseIn(h.snippet, ph);
    })[0];
  }
  /* Blog posts with few links: look for each service page's name in the posts, and link the first mention. */
  function fewLinksProducer(p, onProgress) {
    var posts = {}, out = [], per = {};
    (p.posts || []).forEach(function (x) { posts[norm(x.link)] = x; });
    var targets = p.targets || [];
    return targets.reduce(function (pr, t, i) {
      return pr.then(function () {
        if (onProgress) onProgress(i + 1, targets.length);
        var phs = linkPhrases(t.title).slice(0, 2);
        return phs.reduce(function (pr2, ph) {
          return pr2.then(function () {
            return findText(ph).then(function (rows) {
              rows.forEach(function (r) {
                var post = posts[norm(r.link)]; if (!post) return;
                var key = norm(r.link), tk = norm(t.link);
                if (key === tk || post.links.indexOf(tk) > -1 || (per[key] || 0) >= 3) return;
                if (out.some(function (f) { return norm(f.link) === key && norm(f.target) === tk; })) return;
                var hit = linkHit(r, ph); if (!hit) return;
                var f = linkFix(t, r, hit, ph);
                f.id = "pl-" + autoKey(r.link) + "-" + autoKey(t.link); f.parent = p.id; f.batch = "Links from blog posts"; f.priority = "medium";
                f.issue = "Link “" + f.anchor + "” to " + t.title;
                f.why = "Passes ranking strength from the post to a service page and gives readers a next step. Only those words become a link.";
                f.current = "…" + hit.snippet + "…";
                f.display = "“" + f.anchor + "” becomes a link to " + shortPath(t.link);
                out.push(f); per[key] = (per[key] || 0) + 1;
              });
            }, function () {});
          });
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () { return out; });
  }

  function fixCard(p, st, redraw) {
    if (p.id === "auto-claims" && !st.status) return claimsCard(p, st, redraw);
    if (p.id === "auto-orphans" && !st.status) return orphansCard(p, st, redraw);
    if (p.type === "group") return groupCard(p, st, redraw);
    if (p.type === "manual" && cardMode(p) === "decide") return decideCard(p, st, redraw);
    if (p.type === "manual" && cardMode(p) === "claude") return claudeCard(p, st, redraw);
    if (p.type === "manual") return st.status ? manualCard(p, st, redraw) : claudeCard(p, st, redraw);
    if (p.type === "page_build") return buildCard(p, st, redraw);
    var text = st.edited != null ? st.edited : p.op === "alt" && p.items ? altText(p.items) : p.proposed;
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
      '<label class="field" for="fix-' + esc(p.id) + '">' + (done ? "What went live" : fixedText(p) ? "What will happen" : p.needsEdit ? "Your new wording (change it, then push)" : p.type === "elementor_faq" ? "Questions and answers (edit any of them, keep the Q: and A: labels)" : p.op === "alt" ? "Alt text, one image per line (edit any of them; leave one blank to skip it)" : p.inputLabel || "Proposed (you can edit this)") +
      '<textarea id="fix-' + esc(p.id) + '"' + (done || fixedText(p) ? " readonly" : "") + (p.placeholder ? ' placeholder="' + esc(p.placeholder) + '"' : "") + (p.type === "elementor_faq" || p.op === "llms" ? ' style="min-height:360px"' : /content_replace|new_draft|elementor_set/.test(p.type) || p.op === "alt" || p.op === "css" ? ' style="min-height:140px"' : "") + ">" + esc(done ? (st.after || (p.type === "elementor_remove" ? "(removed)" : "")) : text) + "</textarea>" +
      (isMeta ? '<span class="hint mono"></span>' : "") + "</label></div>" +
      '<p class="muted" style="font-size:.86rem"><b>Why:</b> ' + esc(p.why) + "</p>" +
      '<div class="fix-actions row"></div><div class="fix-msg"></div>';
    var ta = card.querySelector("textarea"), hint = card.querySelector(".hint"), actions = card.querySelector(".fix-actions"), msg = card.querySelector(".fix-msg");
    function showHint() { if (hint) hint.textContent = lengthHint(p.type, ta.value); }
    showHint();
    if (!done) ta.addEventListener("input", function () { showHint(); setFix(p.id, { edited: ta.value }); });

    if (!st.status && p.type === "elementor_h1" && !p.example) {
      var a1 = wpAuth();
      if (a1 && a1.ok) previewH1(p).then(function (h) {
        if (h.notElementor) {
          ta.value = "This page isn't built with Elementor. The top heading in the page text becomes the H1, keeping its wording. If the page has no heading (like the blog page), the page name is added as the H1. Undo puts it back.";
          return;
        }
        card.querySelector("pre.was").textContent = "No H1. The first heading is an " + h.tag.toUpperCase() + ":\n\u201c" + h.text + "\u201d";
        ta.value = "\u201c" + h.text + "\u201d becomes the H1. The wording stays the same.";
      }).catch(function (err) { msg.innerHTML = '<div class="notice">' + esc(err.message) + "</div>"; });
    }
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
        '<button type="button" class="btn primary go"' + (p.example ? " disabled" : "") + ">" + goLabel(p) + "</button>" +
        '<button type="button" class="btn rej">Reject</button>' + (st.edited != null ? '<button type="button" class="btn small reset">Reset to Claude\'s version</button>' : "");
      actions.querySelector(".go").addEventListener("click", function () {
        var sure = actions.querySelector(".sure");
        if (sure && !sure.checked) { msg.innerHTML = '<div class="notice">Tick the box to confirm you\'ve read this change.</div>'; return; }
        var value = ta.value;
        if (p.needsEdit && value.trim() === String(p.current).trim()) { msg.innerHTML = '<div class="notice">Change the wording in the box first, then push.</div>'; return; }
        if (!value.trim() && !fixedText(p) && p.type !== "meta_description") { msg.innerHTML = '<div class="notice">' + (p.placeholder ? "Fill in the box first." : "The proposed text is empty.") + "</div>"; return; }
        var btn = actions.querySelector(".go"); btn.disabled = true; btn.textContent = "Pushing…";
        var lv = fixState()[p.id] && fixState()[p.id].level;
        pushFix(p.type === "elementor_remove" ? Object.assign({}, p, { level: lv == null ? null : lv, scope: "" }) : p, value).then(function (r) {
          var when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
          setFix(p.id, { status: "pushed", before: r.before, after: r.after, pushedAt: when, editLink: r.editLink || "", pageId: r.pageId || p.pageId, backup: r.backup || "" });
          if (r.skipped && r.skipped.length) toast(r.skipped.length + " image" + (r.skipped.length > 1 ? "s" : "") + " skipped: not in the Media Library");
          logChange({ id: p.id, when: when, page: p.pageTitle, link: p.link, type: typeLabel(p), action: p.type === "site_edit" ? (SITE_OP_LABEL[p.op] || "Site fix") + " pushed" : p.type === "new_draft" ? "Draft saved" : p.type === "elementor_remove" ? "Removed from page" : p.type === "set_status" ? "Unpublished" : p.type === "elementor_style" ? "Image fixed" : p.type === "elementor_layout" ? "Layout fixed" : p.type === "elementor_tidy" ? "Punctuation fixed" : p.type === "elementor_type" ? "Text size fixed" : p.type === "elementor_faq" ? "FAQ added" : p.type === "elementor_h1" ? "H1 set" : p.type === "elementor_h1_look" ? "H1 colour repaired" : "Pushed live" });
          toast(p.type === "new_draft" ? "Saved as a draft in WordPress" : "Live on the site");
          redraw(); updateNav();
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = goLabel(p);
          msg.innerHTML = '<div class="notice"><b>Not pushed.</b> ' + esc(err.message) + "</div>";
          if (p.type !== "elementor_style" && /isn't on the page any more|isn't on the page/.test(err.message)) offerAlreadyDone(p, msg, redraw);
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
        (st.status === "pushed" && p.type !== "new_draft" ? '<button type="button" class="btn small danger undo">Undo</button>' : "") +
        (!p.siteWide && !/^(meta_title|meta_description|set_status|new_draft)$/.test(p.type) ? '<button type="button" class="btn small revs">Page not right? Restore an earlier version</button>' : "");
      var rv = actions.querySelector(".revs");
      if (rv) rv.addEventListener("click", function () { rv.remove(); revisionTool(Object.assign({}, p, { pageId: p.pageId || st.pageId }), msg); });
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
  /* "west pier technologies" typed in lower case comes out as "West Pier Technologies" where the page
     used capitals. Wording typed with any capitals is kept exactly as typed. */
  function matchCase(rep, found) {
    rep = String(rep || ""); found = String(found || "");
    if (rep !== rep.toLowerCase() || !/[A-Z]/.test(found)) return rep;
    if (found === found.toUpperCase()) return rep.toUpperCase();
    var words = found.split(/\s+/).filter(function (w) { return /[a-z]/i.test(w); });
    if (words.length > 1 && words.every(function (w) { return /^[A-Z]/.test(w); })) return rep.replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); });
    return /^[A-Z]/.test(found) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
  }
  function ruleFixes() {
    var rules = claimRules(), today = new Date().toISOString().slice(0, 10), out = [];
    var claude = {}; (window.WPT_PROPOSALS || []).forEach(function (f) { if (f.find) claude[norm(f.link) + "|" + f.find.toLowerCase()] = true; });
    return rules.reduce(function (pr, rule) {
      return pr.then(function () {
        return findText(rule.find).then(function (rows) {
          textHits(rows).forEach(function (r) {
            if (claude[norm(r.link) + "|" + rule.find.toLowerCase()]) return;
            var hit = r.hits[0] || {};
            /* Use the phrase exactly as the page writes it, and match its capitals in the new wording. */
            var exact = phraseIn(hit.snippet, rule.find) || rule.find, rep = matchCase(rule.replace, exact);
            out.push({ id: "rule-" + (norm(r.link) + "-" + rule.find).replace(/\W+/g, "-").slice(0, 100), auto: true, created: today, batch: "Automatic replacement",
              type: r.elementor ? "elementor_swap" : "content_replace", size: "small", priority: "critical", category: "Content",
              postType: r.type === "post" ? "posts" : "pages", pageId: r.post_id, pageTitle: r.title, link: r.link, find: exact, every: !!r.elementor,
              issue: "Says \u201c" + exact + "\u201d", current: r.elementor ? "\u2026" + (hit.snippet || exact) + "\u2026" : exact, proposed: rep,
              why: "Matches one of your automatic replacement rules on the Website & SEO page. Only this phrase changes, everywhere it appears on the page (map addresses are left alone). The rest of the text stays as it is." });
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
      return pr.then(function () { return findText(t).then(function (rows) { textHits(rows).forEach(function (r) { (found[r.link] = found[r.link] || { r: r, terms: [] }).terms.push(t); }); }); });
    }, Promise.resolve()).then(function () {
      var today = new Date().toISOString().slice(0, 10), fixes = [];
      var pages = Object.keys(found).map(function (k) { var x = found[k]; return { title: x.r.title, link: x.r.link, terms: x.terms, note: "says: " + x.terms.join(", ") + " · " + x.r.hits.map(function (h) { return "\u201c" + h.snippet.slice(0, 120) + "\u201d"; }).join(" ") }; });
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
    var l = load("change-log", []);
    var p = panel("Change log", "Every change the hub has made to the website, newest first.",
      l.length ? '<button type="button" class="btn small" id="log-copy">Copy as CSV</button>' : "");
    p.appendChild(el(l.length ? '<div class="table-wrap"><table><thead><tr><th>When</th><th>Page</th><th>Change</th><th>What happened</th></tr></thead><tbody>' +
      l.map(function (x) { return '<tr><td class="mono">' + esc(x.when) + '</td><td><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.page) + "</a></td><td>" + esc(x.type) + "</td><td>" + esc(x.action) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" : '<div class="empty">No changes made yet. Approve a fix in the Fix queue and it shows up here.</div>'));
    var c = p.querySelector("#log-copy");
    if (c) c.addEventListener("click", function () {
      copyText(toCsv([{ k: "when", label: "When" }, { k: "page", label: "Page" }, { k: "link", label: "URL" }, { k: "type", label: "Change" }, { k: "action", label: "What happened" }], l), "Change log copied as CSV");
    });
    main.appendChild(p);
  }

  /* ---------- Progress & change log ----------
     Every audit saves a snapshot of the scores (one per day, the latest run that day wins).
     The page compares any two snapshots so improvements show as numbers and percentages.
     Checks read the audit's own issue labels, so they match what the audit table shows. */
  var PROGRESS_CHECKS = [
    { k: "thin", label: "Thin pages (under 300 words)", re: /^Thin content/ },
    { k: "noDesc", label: "Missing meta descriptions", re: /^No (custom )?meta description/ },
    { k: "descLen", label: "Meta description too long or short", re: /^Meta description (too long|short)/ },
    { k: "titleLong", label: "Title tag over 60 characters", re: /^Title tag over/ },
    { k: "h1", label: "No H1, or more than one", re: /^(No H1|\d+ H1s)/ },
    { k: "noH2", label: "No H2 subheadings", re: /^No H2/ },
    { k: "noAlt", label: "Pages with images missing alt text", re: /missing alt text/ },
    { k: "fewLinks", label: "Few internal links", re: /^Few internal links/ },
    { k: "stale", label: "Not updated in over a year", re: /^Not updated/ },
    { k: "noindex", label: "Hidden from Google (noindex)", re: /^Set to noindex/ },
    { k: "canonical", label: "Canonical points elsewhere", re: /^Canonical points/ },
    { k: "broken", label: "Pages not loading properly", re: /^(Live page answers|Live check failed)/ }
  ];
  /* Changes that actually altered the site. Undos, binned drafts and "marked done" don't count. */
  var COUNTED_CHANGE = /^(Pushed live|Draft saved|Draft built|Removed from page|Unpublished|Image fixed|Layout fixed|Punctuation fixed|Text size fixed)/;
  var MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };
  /* Change log rows from before v0.19 only have "19 Oct 2026, 14:30". Turn that into 2026-10-19. */
  function logDate(x) {
    if (x.date) return x.date;
    var m = /(\d{1,2}) (\w{3,4}) (\d{4})/.exec(x.when || "");
    if (!m || !MONTHS[m[2]]) return "";
    return m[3] + "-" + ("0" + MONTHS[m[2]]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  }
  function fmtDate(iso) {
    if (!iso) return "–";
    var d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function avgSpeed(map) {
    var ok = Object.keys(map || {}).map(function (k) { return map[k]; }).filter(function (r) { return r && !r.error && r.perf != null; });
    return ok.length ? Math.round(ok.reduce(function (s, r) { return s + r.perf; }, 0) / ok.length) : null;
  }
  /* Pure: works out one snapshot from an audit plus the other tracked data. */
  function buildSnapshot(audit, date, kwRows, aiRows, psi) {
    var pages = audit.pages.filter(function (x) { return !x.redirectTo; });
    if (!pages.length) return null;
    var counts = {}, failed = 0;
    PROGRESS_CHECKS.forEach(function (c) {
      counts[c.k] = pages.filter(function (x) { return x.issues.some(function (i) { return c.re.test(i); }); }).length;
      failed += counts[c.k];
    });
    var perPage = {};
    pages.forEach(function (x) { perPage[x.link] = { t: x.title, n: x.issues.length }; });
    var kw = (kwRows || []).filter(function (r) { return !r._ex && Number(r.pos) > 0; });
    var ai = (aiRows || []).filter(function (r) { return !r._ex && r.named && r.named !== "Not checked"; });
    return {
      date: date, when: audit.when, site: audit.site,
      pages: pages.length,
      issues: pages.reduce(function (n, x) { return n + x.issues.length; }, 0),
      score: Math.round((1 - failed / (pages.length * PROGRESS_CHECKS.length)) * 1000) / 10,
      clear: pages.filter(function (x) { return !x.issues.length; }).length,
      counts: counts, perPage: perPage,
      kwTracked: kw.length,
      kwAvg: kw.length ? Math.round(kw.reduce(function (n, r) { return n + Number(r.pos); }, 0) / kw.length * 10) / 10 : null,
      kwTop10: kw.filter(function (r) { return Number(r.pos) <= 10; }).length,
      aiChecked: ai.length,
      aiNamed: ai.filter(function (r) { return r.named === "Yes"; }).length,
      speedMobile: psi ? avgSpeed(psi.pages) : null,
      speedDesktop: psi && psi.withDesktop ? avgSpeed(psi.desktop) : null
    };
  }
  function snapHistory() { return (load("seo-history", []) || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function recordSnapshot(audit, date) {
    if (!audit || !audit.pages || !audit.pages.length) return null;
    var snap = buildSnapshot(audit, date || today(), getRows("keywords"), getRows("ai-visibility"), psiData());
    if (!snap) return null;
    var h = snapHistory().filter(function (s) { return s.date !== snap.date; });
    h.push(snap); save("seo-history", h);
    return snap;
  }
  /* First time the page opens: the audit already saved becomes the baseline, dated the day it ran. */
  function ensureBaseline() {
    if (snapHistory().length) return;
    var a = load("seo-audit", null);
    if (a && a.pages && a.pages.length) recordSnapshot(a, logDate({ when: a.when }) || today());
  }
  /* For measures where lower is better (issues, positions), a drop counts as an improvement. */
  function delta(base, now, lowerBetter, unit) {
    if (base == null || now == null || isNaN(base) || isNaN(now)) return { txt: "–", pct: "–", cls: "flat" };
    var d = Math.round((now - base) * 10) / 10;
    var better = lowerBetter ? d < 0 : d > 0;
    var cls = d === 0 ? "flat" : better ? "up" : "down";
    var txt = d === 0 ? "no change" : (d > 0 ? "+" : "") + d + (unit || "");
    var pctTxt = "–";
    if (d === 0) pctTxt = "0%";
    else if (base !== 0) pctTxt = Math.round(Math.abs(d) / Math.abs(base) * 100) + "% " + (better ? "better" : "worse");
    else pctTxt = better ? "better" : "worse";
    return { txt: txt, pct: pctTxt, cls: cls };
  }
  function metricRows(a, b) {
    var rows = [
      { label: "Website health score", a: a.score, b: b.score, lower: false, unit: "%", note: "Share of all page checks passed" },
      { label: "Issues found", a: a.issues, b: b.issues, lower: true },
      { label: "Pages with no issues", a: a.clear, b: b.clear, lower: false }
    ];
    PROGRESS_CHECKS.forEach(function (c) { rows.push({ label: c.label, a: (a.counts || {})[c.k], b: (b.counts || {})[c.k], lower: true }); });
    rows.push({ label: "Average mobile speed score", a: a.speedMobile, b: b.speedMobile, lower: false, note: "From the last speed check before each snapshot" });
    rows.push({ label: "Average desktop speed score", a: a.speedDesktop, b: b.speedDesktop, lower: false });
    rows.push({ label: "Keyword average position", a: a.kwAvg, b: b.kwAvg, lower: true, note: "Tracked searches on Website & SEO" });
    rows.push({ label: "Keywords in Google's top 10", a: a.kwTop10, b: b.kwTop10, lower: false });
    rows.push({ label: "AI answers naming WPT", a: a.aiNamed, b: b.aiNamed, lower: false });
    return rows;
  }
  /* Website changes made after the start date, up to and including the end date. */
  function changesBetween(log, a, b) {
    return (log || []).filter(function (x) {
      if (!COUNTED_CHANGE.test(x.action || "")) return false;
      var d = logDate(x); return d && d > a.date && d <= b.date;
    }).length;
  }
  function changesSoFar(log, b) {
    return (log || []).filter(function (x) { var d = logDate(x); return COUNTED_CHANGE.test(x.action || "") && d && d <= b.date; }).length;
  }
  function pageMoves(a, b) {
    var out = [];
    Object.keys(b.perPage || {}).forEach(function (link) {
      var before = (a.perPage || {})[link], now = b.perPage[link];
      if (!before) { out.push({ link: link, t: now.t, a: "new", b: now.n, d: 0, isNew: true }); return; }
      if (before.n !== now.n) out.push({ link: link, t: now.t, a: before.n, b: now.n, d: now.n - before.n });
    });
    return out.sort(function (x, y) { return (x.isNew ? 1 : 0) - (y.isNew ? 1 : 0) || x.d - y.d; });
  }
  function fmtVal(v, unit) { return v == null ? "–" : v + (unit || ""); }
  function reportText(a, b, log) {
    var lines = ["WPT website progress report", "Compared " + fmtDate(a.date) + " (start) with " + fmtDate(b.date) + " (latest)", ""];
    metricRows(a, b).forEach(function (m) {
      if (m.a == null && m.b == null) return;
      var d = delta(m.a, m.b, m.lower, m.unit === "%" ? " pts" : "");
      lines.push(m.label + ": " + fmtVal(m.a, m.unit) + " to " + fmtVal(m.b, m.unit) + (d.pct !== "–" ? " (" + d.pct + ")" : ""));
    });
    lines.push("", "Website changes made in this period: " + changesBetween(log, a, b));
    var moved = pageMoves(a, b).filter(function (p) { return p.d < 0; }).slice(0, 5);
    if (moved.length) {
      lines.push("", "Most improved pages:");
      moved.forEach(function (p) { lines.push("- " + p.t + ": " + p.a + " issues down to " + p.b); });
    }
    return lines.join("\n");
  }

  function renderProgress(main) {
    ensureBaseline();
    var hist = snapHistory(), log = load("change-log", []);
    main.innerHTML = head("Website & SEO", "Progress & change log", "How the website's scores have moved since the first audit, and every change the hub has made. Built to show Garry.",
      hist.length > 1 ? '<button type="button" class="btn primary" id="rep-copy">Copy report for Garry</button>' : "");

    if (!hist.length) {
      var e = panel("No baseline yet", "Run the page audit on Website & SEO. That first run becomes the starting point every later report is measured against.");
      e.appendChild(el('<div class="row"><a class="btn primary" href="#seo" data-seotab="audit">Go to the page audit</a></div>'));
      main.appendChild(e); renderChangeLog(main); return;
    }

    var sel = load("progress-compare", {});
    var has = function (d) { return hist.some(function (s) { return s.date === d; }); };
    var aDate = has(sel.a) ? sel.a : hist[0].date, bDate = has(sel.b) ? sel.b : hist[hist.length - 1].date;
    var a = hist.filter(function (s) { return s.date === aDate; })[0], b = hist.filter(function (s) { return s.date === bDate; })[0];
    var two = hist.length > 1 && aDate !== bDate;

    var opts = function (cur) { return hist.map(function (s) { return '<option value="' + s.date + '"' + (s.date === cur ? " selected" : "") + ">" + esc(fmtDate(s.date)) + " · " + s.score + "%</option>"; }).join(""); };
    var cmp = el('<div class="compare-row">' +
      '<label class="field" for="cmp-a">Compare from<select id="cmp-a">' + opts(aDate) + "</select></label>" +
      '<label class="field" for="cmp-b">To<select id="cmp-b">' + opts(bDate) + "</select></label>" +
      '<button type="button" class="btn" id="snap-now">Save today\'s snapshot</button></div>');
    main.appendChild(cmp);
    cmp.addEventListener("change", function () { save("progress-compare", { a: cmp.querySelector("#cmp-a").value, b: cmp.querySelector("#cmp-b").value }); route(); });
    cmp.querySelector("#snap-now").addEventListener("click", function () {
      var au = load("seo-audit", null); if (!au) return toast("Run an audit first");
      recordSnapshot(au, today()); save("progress-compare", {}); toast("Snapshot saved for " + fmtDate(today())); route();
    });

    if (hist.length === 1) main.appendChild(el('<div class="notice info"><b>Baseline saved ' + esc(fmtDate(a.date)) + '.</b> These are your starting scores. Run the audit again next week and this page will show how much each one has moved, in numbers and percentages.</div>'));

    function tile(label, now, d) {
      return '<div class="stat"><span class="n">' + esc(now) + '</span><span class="l">' + esc(label) + "</span>" +
        (two ? '<span class="d ' + d.cls + '">' + esc(d.txt) + (d.pct !== "–" ? " · " + esc(d.pct) : "") + "</span>" : "") + "</div>";
    }
    var nChanges = two ? changesBetween(log, a, b) : changesSoFar(log, b);
    main.appendChild(el('<div class="stats">' +
      tile("Website health score", b.score + "%", delta(a.score, b.score, false, " pts")) +
      tile("Issues found", b.issues, delta(a.issues, b.issues, true)) +
      tile("Pages with no issues", b.clear + " of " + b.pages, delta(a.clear, b.clear, false)) +
      '<div class="stat"><span class="n">' + nChanges + '</span><span class="l">Website changes made ' + (two ? "since " + esc(fmtDate(a.date)) : "so far") + "</span></div></div>"));

    if (hist.length > 1) {
      var chartP = panel("Health score over time", "Every saved snapshot. Hover the line for the figures.");
      chartP.appendChild(lineChart(hist.map(function (s) { return { d: s.date, v: s.score }; }), "Health score", function (v) { return Math.round(v) + "%"; }));
      main.appendChild(chartP);
    }

    var card = panel("Scorecard", two ? fmtDate(a.date) + " compared with " + fmtDate(b.date) + ". Green is better, red is worse." : "Starting scores. Changes appear after the next audit.");
    card.appendChild(el('<div class="table-wrap"><table><thead><tr><th>Measure</th><th class="num">' + esc(fmtDate(a.date)) + "</th>" + (two ? '<th class="num">' + esc(fmtDate(b.date)) + '</th><th class="num">Change</th><th class="num">Improvement</th>' : "") + "</tr></thead><tbody>" +
      metricRows(a, b).map(function (m) {
        var d = delta(m.a, m.b, m.lower, m.unit === "%" ? " pts" : "");
        return "<tr><td>" + esc(m.label) + (m.note ? '<div class="hint">' + esc(m.note) + "</div>" : "") + '</td><td class="num">' + esc(fmtVal(m.a, m.unit)) + "</td>" +
          (two ? '<td class="num">' + esc(fmtVal(m.b, m.unit)) + '</td><td class="num"><span class="delta ' + d.cls + '">' + esc(d.txt) + '</span></td><td class="num"><span class="delta ' + d.cls + '">' + esc(d.pct) + "</span></td>" : "") + "</tr>";
      }).join("") + "</tbody></table></div>"));
    main.appendChild(card);

    if (two) {
      var moves = pageMoves(a, b);
      var mp = panel("Pages that moved", "Pages whose issue count changed between the two dates. Biggest improvements first.");
      mp.appendChild(el(moves.length ? '<div class="table-wrap"><table><thead><tr><th>Page</th><th class="num">Issues before</th><th class="num">Issues now</th><th class="num">Change</th></tr></thead><tbody>' +
        moves.map(function (p) {
          var cls = p.isNew ? "flat" : p.d < 0 ? "up" : "down";
          return '<tr><td><a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.t) + '</a></td><td class="num">' + esc(p.a) + '</td><td class="num">' + esc(p.b) +
            '</td><td class="num"><span class="delta ' + cls + '">' + (p.isNew ? "new page" : (p.d > 0 ? "+" : "") + p.d) + "</span></td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="empty">No page changed its issue count between these dates.</div>'));
      main.appendChild(mp);
    }

    var hp = panel("Snapshot history", "One snapshot per day. Running the audit again on the same day replaces that day's snapshot.",
      '<button type="button" class="btn small" id="hist-copy">Copy history as CSV</button>');
    hp.appendChild(el('<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Pages</th><th class="num">Issues</th><th class="num">Health score</th><th class="num">Mobile speed</th><th class="num">Keywords top 10</th><th></th></tr></thead><tbody>' +
      hist.slice().reverse().map(function (s) {
        return '<tr><td class="mono">' + esc(fmtDate(s.date)) + '</td><td class="num">' + s.pages + '</td><td class="num">' + s.issues + '</td><td class="num">' + s.score + '%</td><td class="num">' + fmtVal(s.speedMobile) + '</td><td class="num">' + (s.kwTracked ? s.kwTop10 + " of " + s.kwTracked : "–") +
          '</td><td><button type="button" class="btn small danger" data-del="' + s.date + '">Delete</button></td></tr>';
      }).join("") + "</tbody></table></div>"));
    hp.addEventListener("click", function (ev) {
      var d = ev.target.getAttribute("data-del");
      if (d) {
        if (!ev.target.dataset.sure) { ev.target.dataset.sure = "1"; ev.target.textContent = "Click again to delete"; return; }
        save("seo-history", snapHistory().filter(function (s) { return s.date !== d; })); toast("Snapshot deleted"); route();
      }
      if (ev.target.id === "hist-copy") {
        copyText(toCsv([{ k: "date", label: "Date" }, { k: "pages", label: "Pages" }, { k: "issues", label: "Issues" }, { k: "score", label: "Health score %" }, { k: "clear", label: "Pages clear" },
          { k: "speedMobile", label: "Mobile speed" }, { k: "speedDesktop", label: "Desktop speed" }, { k: "kwAvg", label: "Keyword avg position" }, { k: "kwTop10", label: "Keywords top 10" }, { k: "aiNamed", label: "AI answers naming WPT" }], snapHistory()), "History copied as CSV");
      }
    });
    main.appendChild(hp);
    main.appendChild(el('<div class="notice info">Snapshots are saved in this browser, like the rest of the hub. Use Copy history as CSV now and then to keep a copy somewhere safe.</div>'));

    var rc = main.querySelector("#rep-copy");
    if (rc) rc.addEventListener("click", function () { copyText(reportText(a, b, log), "Report copied. Paste it into an email to Garry."); });

    renderChangeLog(main);
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
    /* Claude can move a job on from GitHub: a job with an "update" stamp sets its status (and new
       details, if given) once. Your own changes after that stay put until a newer stamp arrives. */
    var applied = load("jobs-updates-applied", {});
    (window.WPT_JOBS || []).forEach(function (j) {
      if (!j.update || applied[j.id] === j.update) return;
      rows.forEach(function (r) {
        if (r._src !== j.id) return;
        if (j.status) r.status = j.status;
        if (j.details) r.details = j.details;
        if (j.job) r.job = j.job;
      });
      applied[j.id] = j.update;
    });
    /* Fix queue steps that happen off the website (Google Business Profile, directories, hosting, Matt's
       templates) are jobs, not fixes. They're copied into Your jobs once, keeping any Done already ticked. */
    try { importFixJobs(rows, seen); } catch (e) { /* the Fix queue isn't loaded yet */ }
    save("jobs", rows); save("jobs-imported", seen); save("jobs-updates-applied", applied);
  }
  function importFixJobs(rows, seen) {
    var fs0 = fixState();
    proposals().forEach(function (p) {
      if (p.example || cardMode(p) !== "job") return;
      var key = "fix:" + p.id;
      if (seen.indexOf(key) > -1) return;
      var st0 = fs0[p.id] || {};
      rows.unshift({ _id: uid(), _src: key, job: p.issue, page: p.pageTitle + (p.link ? " (" + shortPath(p.link) + ")" : ""),
        details: (p.why || "") + ((p.steps || []).length ? "\n\n" + p.steps.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") : "") +
          ((p.pages || []).length ? "\n\nWhere:\n" + p.pages.slice(0, 30).map(function (x) { return "- " + shortPath(x.link) + (x.note ? " (" + x.note + ")" : ""); }).join("\n") : ""),
        size: "", alt: "", status: st0.status === "done" ? "Done" : "To do" });
      seen.push(key);
    });
  }
  /* ---------- AI visibility prompts ----------
     The prompt list comes from data/proposals.js (WPT_AI_PROMPTS) and is copied in once per prompt,
     so your edits stay. Ten a week by rotation: prompt n is asked when (n - 1) % 3 matches the week. */
  var AI_GROUPS = ["Local", "Vendor", "Compare", "Problem", "Sector", "Public sector", "Bundle", "Brand"];
  function syncAiPrompts() {
    var rows = load("ai-prompts", null) || [];
    var seen = load("ai-prompts-imported", []);
    (window.WPT_AI_PROMPTS || []).forEach(function (p) {
      if (seen.indexOf(p.id) > -1) return;
      rows.push({ _id: uid(), _src: p.id, n: p.n, q: p.q, group: p.group, page: p.page, active: "Yes" });
      seen.push(p.id);
    });
    rows.sort(function (a, b) { return (Number(a.n) || 999) - (Number(b.n) || 999); });
    save("ai-prompts", rows); save("ai-prompts-imported", seen);
    return rows;
  }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y) / 86400000 + 1) / 7);
  }
  function aiWeekPrompts(rows, d) {
    var week = isoWeek(d);
    var active = (rows || []).filter(function (r) { return r.active !== "No" && r.q; });
    var list = active.filter(function (r, i) { var n = Number(r.n) || (i + 1); return (n - 1) % 3 === week % 3; });
    return { week: week, total: active.length, list: list };
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
  /* A new version of the hub may turn more audit findings into fixes it can push. Rebuild them from the
     saved audit, display check and mobile check, so nothing needs running again. */
  function rebuildFixes() {
    if (load("fixes-built-for", "") === VERSION) return;
    try {
      var au = load("seo-audit", null);
      if (au && au.siteData) storeAutoFixes(buildAutoFixes(au), 0);
      var dc = load("display", null); if (dc) save("auto-fixes-display", buildDisplayFixes(dc));
      var ps = load("psi", null); if (ps) save("auto-fixes-mobile", buildMobileFixes(ps));
      save("fixes-built-for", VERSION);
    } catch (e) { if (window.console) console.warn("Fix rebuild failed", e); /* keep the saved fixes */ }
  }
  rebuildFixes();
  window.addEventListener("hashchange", route);
  route();
})();
