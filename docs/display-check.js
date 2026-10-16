/* WPT Hub display check. Runs inside a live page only when the hub opens it with ?wpt_check=1.
   Reads the page as it's drawn and reports display problems back to the hub window. Changes nothing. */
(function () {
  "use strict";
  var LOGO = /logo|badge|cert|partner|icon|stars?\b|5-stars|award|accredit|brand|8x8|gamma|3cx|zoom|teams|avaya|mitel|cyber|ukas|iso/i;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function file(u) { return String(u || "").split("?")[0].split("/").pop(); }
  function widgetOf(el) {
    var w = el.closest(".elementor-element[data-id]");
    if (!w) return { id: "", type: "" };
    return { id: w.getAttribute("data-id"), type: String(w.getAttribute("data-widget_type") || w.getAttribute("data-element_type") || "").split(".")[0] };
  }
  function shown(el) {
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 6 && r.height > 6 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05;
  }
  function inHiddenSlide(el) { return !!el.closest(".swiper-slide-duplicate, [aria-hidden='true']"); }
  var HEADS = null;
  function where(el) {
    if (!HEADS) HEADS = Array.prototype.map.call(document.querySelectorAll("h1,h2,h3,h4"), function (h) { return { y: h.getBoundingClientRect().top + scrollY, t: h.textContent.trim().slice(0, 60) }; });
    var y = el.getBoundingClientRect().top + scrollY, near = "";
    HEADS.forEach(function (h) { if (h.y <= y + 5 && h.t) near = h.t; });
    return { y: Math.round(y), near: near };
  }
  function loadImg(url) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = url; setTimeout(function () { res(null); }, 6000); });
  }
  async function scrollAll() {
    var h = document.documentElement.scrollHeight;
    for (var y = 0; y < h; y += Math.max(300, innerHeight * 0.8)) { scrollTo(0, y); await wait(200); h = document.documentElement.scrollHeight; }
    scrollTo(0, 0); await wait(900);
  }
  async function run() {
    await wait(1500); await scrollAll();
    await check();
  }
  /* The hub resizes the frame to other screen widths and asks for the check again, without reloading. */
  addEventListener("message", function (e) {
    if (e.data && e.data.wpt === "display-rerun") { HEADS = null; setTimeout(check, 700); }
  });
  async function check() {
    var out = [], seen = {};
    function add(o) { var k = o.kind + "|" + (o.widget.id || "") + "|" + (o.file || o.text || ""); if (seen[k]) return; seen[k] = 1; out.push(o); }
    var W = innerWidth;

    /* Images drawn with <img> */
    Array.prototype.forEach.call(document.images, function (img) {
      if (inHiddenSlide(img)) return;
      var src = img.currentSrc || img.src || "";
      if (img.complete && img.naturalWidth === 0 && src && !/^data:/.test(src)) { add({ kind: "broken", file: file(src), widget: widgetOf(img), at: where(img) }); return; }
      if (!img.naturalWidth || !shown(img)) return;
      var cs = getComputedStyle(img), r = img.getBoundingClientRect();
      var bw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      var bh = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      if (bw < 12 || bh < 12) return;
      var nr = img.naturalWidth / img.naturalHeight, br = bw / bh, fit = cs.objectFit || "fill";
      var label = src + " " + (img.alt || "");
      if (fit === "fill") {
        var diff = Math.abs(br / nr - 1);
        if (diff > 0.05) add({ kind: "distorted", file: file(src), widget: widgetOf(img), at: where(img), detail: (br > nr ? "stretched wide" : "squeezed thin") + " by " + Math.round(diff * 100) + "%", logo: LOGO.test(label) });
      } else if (fit === "cover") {
        var lost = 1 - Math.min(br / nr, nr / br);
        if (lost > 0.12 && LOGO.test(label)) add({ kind: "cropped", file: file(src), widget: widgetOf(img), at: where(img), detail: Math.round(lost * 100) + "% of it is cut off", logo: true });
      }
      if (!img.hasAttribute("alt") && bw > 60) add({ kind: "no_alt", file: file(src), widget: widgetOf(img), at: where(img) });
    });

    /* Images drawn as backgrounds (carousels, sections, boxes) */
    var bgs = [];
    Array.prototype.forEach.call(document.querySelectorAll("body *"), function (el) {
      if (el.children.length > 40) return;
      var cs = getComputedStyle(el), m = (cs.backgroundImage || "").match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) return;
      if (inHiddenSlide(el) || !shown(el)) return;
      bgs.push({ el: el, url: m[1], size: cs.backgroundSize });
    });
    for (var i = 0; i < bgs.length && i < 120; i++) {
      var b = bgs[i], r = b.el.getBoundingClientRect();
      var inCarousel = !!b.el.closest(".swiper, .elementor-carousel-image, .elementor-image-carousel, [class*='carousel']");
      if (!(LOGO.test(b.url) || inCarousel)) continue;
      var im = await loadImg(b.url); if (!im || !im.naturalWidth) continue;
      var nr2 = im.naturalWidth / im.naturalHeight, br2 = r.width / r.height;
      if (b.size === "cover") {
        var lost2 = 1 - Math.min(br2 / nr2, nr2 / br2);
        if (lost2 > 0.12) add({ kind: "cropped", file: file(b.url), widget: widgetOf(b.el), at: where(b.el), detail: Math.round(lost2 * 100) + "% of it is cut off", logo: LOGO.test(b.url) || inCarousel, bg: true });
      } else if (/100% 100%/.test(b.size)) {
        var d2 = Math.abs(br2 / nr2 - 1);
        if (d2 > 0.05) add({ kind: "distorted", file: file(b.url), widget: widgetOf(b.el), at: where(b.el), detail: "stretched by " + Math.round(d2 * 100) + "%", bg: true });
      }
    }

    /* Buttons side by side where one wraps onto two lines and its neighbour doesn't */
    var btns = Array.prototype.filter.call(document.querySelectorAll(".elementor-button, a.button, button"), function (b) { return shown(b) && !inHiddenSlide(b) && b.textContent.trim(); });
    btns.forEach(function (b) {
      var t = b.querySelector(".elementor-button-text") || b, cs = getComputedStyle(t);
      var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      var lines = Math.round(t.getBoundingClientRect().height / lh);
      if (lines < 2) return;
      var r = b.getBoundingClientRect();
      var twin = btns.some(function (o) { if (o === b) return false; var q = o.getBoundingClientRect(); var tt = o.querySelector(".elementor-button-text") || o; return Math.abs(q.top - r.top) < 30 && Math.abs(q.left - r.left) < 700 && Math.round(tt.getBoundingClientRect().height / (parseFloat(getComputedStyle(tt).lineHeight) || 20)) < 2; });
      add({ kind: "button_wrap", text: b.textContent.trim().slice(0, 50), widget: widgetOf(b), at: where(b), detail: twin ? "wraps onto " + lines + " lines next to a button that doesn't" : "wraps onto " + lines + " lines" });
    });

    /* Text cut off by its box */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,.elementor-button-text,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el)) return;
      var cs = getComputedStyle(el);
      if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2)
        add({ kind: "text_clipped", text: el.textContent.trim().slice(0, 60), widget: widgetOf(el), at: where(el) });
    });

    /* Anything wider than the screen (sideways scrolling on phones) */
    if (document.documentElement.scrollWidth > W + 2) {
      var worst = [];
      Array.prototype.forEach.call(document.querySelectorAll("body *"), function (el) {
        var r = el.getBoundingClientRect();
        if (r.right > W + 2 && r.width > 0 && shown(el) && !el.closest(".swiper, [class*='carousel'], .elementor-hidden-mobile")) {
          var p = el.parentElement, pr = p && p.getBoundingClientRect();
          if (!p || pr.right <= W + 2) worst.push(el);
        }
      });
      worst.slice(0, 4).forEach(function (el) { add({ kind: "overflow", text: (el.textContent || el.tagName).trim().slice(0, 50), widget: widgetOf(el), at: where(el), detail: "sticks out " + Math.round(el.getBoundingClientRect().right - W) + "px past the edge" }); });
    }

    /* Punctuation stranded on its own line, like "communications" then "." underneath */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title,p,li,.elementor-button-text"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6,p,li")) return;
      var chars = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tn;
      while ((tn = tw.nextNode())) for (var ci = 0; ci < tn.data.length; ci++) chars.push({ n: tn, i: ci, c: tn.data[ci] });
      function rectOf(x) { var rg = document.createRange(); rg.setStart(x.n, x.i); rg.setEnd(x.n, x.i + 1); var rs = rg.getClientRects(); return rs.length ? rs[rs.length - 1] : null; }
      for (var k = 0; k < chars.length; k++) {
        if (!/[.,?!:;]/.test(chars[k].c)) continue;
        var after = chars[k + 1]; if (after && /\S/.test(after.c) && !/[.,?!:;"')\]]/.test(after.c)) continue;
        var j = k - 1; while (j >= 0 && /\s/.test(chars[j].c)) j--;
        if (j < 0) continue;
        var a = rectOf(chars[k]), b = rectOf(chars[j]);
        if (a && b && a.top > b.top + b.height * 0.6) {
          add({ kind: "stranded_punct", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 80), punct: chars[k].c, gap: k - j > 1, widget: widgetOf(el), at: where(el) });
          break;
        }
      }
    });

    /* Images spilling out of the coloured box they sit in */
    function panelOf(el) {
      var n = el.parentElement;
      while (n && n !== document.body) {
        var cs = getComputedStyle(n);
        var bg = cs.backgroundColor, hasBg = (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) || (cs.backgroundImage && cs.backgroundImage !== "none");
        if (hasBg && n.getBoundingClientRect().width < document.documentElement.clientWidth - 8) return n;
        n = n.parentElement;
      }
      return null;
    }
    Array.prototype.forEach.call(document.images, function (img) {
      if (!img.naturalWidth || !shown(img) || inHiddenSlide(img)) return;
      var pn = panelOf(img); if (!pn) return;
      var r = img.getBoundingClientRect(), q = pn.getBoundingClientRect();
      var out = Math.max(r.right - q.right, q.left - r.left, 0);
      if (out > 4 && getComputedStyle(pn).overflow === "visible") {
        var wEl = img.closest(".elementor-element[data-id]");
        var mL = wEl ? parseFloat(getComputedStyle(wEl).marginLeft) : 0, mR = wEl ? parseFloat(getComputedStyle(wEl).marginRight) : 0;
        add({ kind: "overflow_box", file: file(img.currentSrc || img.src), widget: widgetOf(img), at: where(img), detail: "hangs " + Math.round(out) + "px outside its box", negMargin: mL < 0 || mR < 0 });
      }
    });

    /* The same word twice in a short heading */
    var STOP = /^(the|and|for|with|your|our|you|are|that|this|from|all|into|more|what|how|why|who|its|it's|a|an|of|to|in|on|is|by|at|or|be|we|us)$/i;
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6")) return;
      var t = el.textContent.replace(/\s+/g, " ").trim(), words = t.split(" ");
      if (words.length < 3 || words.length > 16) return;
      var stems = {};
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi].toLowerCase().replace(/[^a-z0-9']/g, "");
        if (w.length < 4 || STOP.test(w)) continue;
        var st = w.replace(/(ions|ion|ings|ing|ers|er|es|s|ed)$/, "");
        if (stems[st]) { add({ kind: "repeat_word", text: t, word: words[wi].replace(/[^A-Za-z0-9']/g, ""), widget: widgetOf(el), at: where(el) }); return; }
        stems[st] = 1;
      }
    });

    /* Things in the same column that nearly, but don't quite, line up (a button indented past the text above it) */
    var cols = {};
    Array.prototype.forEach.call(document.querySelectorAll(".elementor-widget[data-id]"), function (wEl) {
      if (!shown(wEl) || inHiddenSlide(wEl)) return;
      var col = wEl.parentElement && wEl.parentElement.closest(".elementor-column[data-id], .e-con[data-id]");
      if (!col) return;
      var target = wEl.querySelector(".elementor-button") || wEl.querySelector(".elementor-heading-title, p, h1, h2, h3, h4");
      if (!target) return;
      var cs = getComputedStyle(target);
      if (cs.textAlign === "center" || getComputedStyle(wEl).textAlign === "center") return;
      var rg = document.createRange(); rg.selectNodeContents(target);
      var left = target.classList.contains("elementor-button") ? target.getBoundingClientRect().left : rg.getBoundingClientRect().left;
      (cols[col.getAttribute("data-id")] = cols[col.getAttribute("data-id")] || []).push({ w: wEl, left: left, btn: target.classList.contains("elementor-button") });
    });
    Object.keys(cols).forEach(function (cid) {
      var list = cols[cid]; if (list.length < 2) return;
      var counts = {};
      list.forEach(function (x) { var k = Math.round(x.left); counts[k] = (counts[k] || 0) + 1; });
      var main = +Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      list.forEach(function (x) {
        var d = x.left - main;
        if (Math.abs(d) >= 6 && Math.abs(d) <= 60) {
          var ml = parseFloat(getComputedStyle(x.w).marginLeft) || 0;
          var inner = x.w.querySelector(".elementor-widget-container"), pl = inner ? parseFloat(getComputedStyle(inner).paddingLeft) || 0 : 0;
          add({ kind: "misaligned", text: x.w.textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: widgetOf(x.w), at: where(x.w),
            detail: (d > 0 ? "starts " + Math.round(d) + "px to the right of" : "starts " + Math.round(-d) + "px to the left of") + " the text above it", offset: Math.round(d), marginLeft: Math.round(ml), padLeft: Math.round(pl), isButton: x.btn });
        }
      });
    });

    /* Top-level boxes that aren't centred, or have much more space at the bottom than the top */
    var CW = document.documentElement.clientWidth;
    Array.prototype.forEach.call(document.querySelectorAll(".elementor > .elementor-section[data-id], .elementor > .e-con[data-id], .elementor-section-wrap > .elementor-section[data-id]"), function (sec) {
      if (!shown(sec)) return;
      var r = sec.getBoundingClientRect(), cs = getComputedStyle(sec);
      var type = sec.classList.contains("e-con") ? "container" : "section";
      var info = { id: sec.getAttribute("data-id"), type: type };
      if (r.width < CW - 30) {
        var gl = r.left, gr = CW - r.right;
        if (Math.abs(gl - gr) > 16) add({ kind: "off_centre", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: info, at: where(sec),
          detail: Math.round(gl) + "px gap on the left, " + Math.round(gr) + "px on the right", gapLeft: Math.round(gl), gapRight: Math.round(gr), marginLeft: Math.round(parseFloat(cs.marginLeft) || 0), marginRight: Math.round(parseFloat(cs.marginRight) || 0) });
      }
      var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      var kids = Array.prototype.filter.call(sec.querySelectorAll(".elementor-widget"), shown);
      if (kids.length) {
        var top = Math.min.apply(null, kids.map(function (k) { return k.getBoundingClientRect().top; })) - r.top;
        var bot = r.bottom - Math.max.apply(null, kids.map(function (k) { return k.getBoundingClientRect().bottom; }));
        if (bot > 60 && bot > top * 1.8 && pb > pt + 30) add({ kind: "uneven_space", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: info, at: where(sec),
          detail: Math.round(bot) + "px of space below the content, " + Math.round(top) + "px above", padTop: Math.round(pt), padBottom: Math.round(pb) });
      }
    });

    /* Words broken in the middle ("Communicati" / "ons") because the box is too narrow for the font size */
    function measure(word, el) {
      var sp = document.createElement("span"), cs = getComputedStyle(el);
      sp.textContent = word;
      sp.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;font:" + cs.font + ";letter-spacing:" + cs.letterSpacing + ";text-transform:" + cs.textTransform;
      document.body.appendChild(sp); var w = sp.getBoundingClientRect().width; sp.remove(); return w;
    }
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title,p,li,.elementor-button-text,a.elementor-button"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6,p,li")) return;
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tn, done = false;
      while (!done && (tn = tw.nextNode())) {
        var re = /\S{4,}/g, mm;
        while (!done && (mm = re.exec(tn.data))) {
          var rg = document.createRange(); rg.setStart(tn, mm.index); rg.setEnd(tn, mm.index + mm[0].length);
          var rs = Array.prototype.filter.call(rg.getClientRects(), function (q) { return q.width > 0; });
          if (rs.length > 1 && Math.abs(rs[rs.length - 1].top - rs[0].top) > 4) {
            var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
            var box = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
            var word = mm[0].replace(/[^\w'’-]+$/, ""), ww = measure(word, el);
            var need = ww > 0 ? Math.floor(fs * (box / ww) * 0.96) : Math.floor(fs * 0.8);
            add({ kind: "broken_word", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 60), word: word, fontSize: Math.round(fs), fitSize: Math.max(10, need), widget: widgetOf(el), at: where(el),
              detail: "“" + word + "” splits across two lines at " + W + "px wide" });
            done = true;
          }
        }
      }
    });

    /* Big headings with loose line spacing (big gaps between the lines) */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3")) return;
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16, lh = parseFloat(cs.lineHeight);
      if (!lh || fs < 26) return;
      var lines = Math.round(el.getBoundingClientRect().height / lh);
      if (lines >= 2 && lh / fs > 1.42) add({ kind: "loose_lines", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 60), widget: widgetOf(el), at: where(el),
        ratio: Math.round(lh / fs * 100) / 100, fontSize: Math.round(fs), detail: "line spacing is " + (Math.round(lh / fs * 100) / 100) + " times the text size" });
    });

    /* Boxes with a lot of empty space at the top or bottom */
    var PADMAX = W >= 1025 ? 110 : W >= 768 ? 90 : 64, PADTO = W >= 1025 ? 80 : W >= 768 ? 60 : 40;
    Array.prototype.forEach.call(document.querySelectorAll(".elementor > .elementor-section[data-id], .elementor > .e-con[data-id], .elementor-section-wrap > .elementor-section[data-id]"), function (sec) {
      if (!shown(sec)) return;
      var cs = getComputedStyle(sec), pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      var bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      if ((pt > PADMAX || pb > PADMAX) && bg) add({ kind: "big_padding", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40),
        widget: { id: sec.getAttribute("data-id"), type: sec.classList.contains("e-con") ? "container" : "section" }, at: where(sec),
        padTop: Math.round(pt), padBottom: Math.round(pb), padTo: PADTO, detail: Math.round(pt) + "px empty at the top, " + Math.round(pb) + "px at the bottom" });
    });

    var m = document.body.className.match(/(?:page-id|postid)-(\d+)/);
    var msg = { wpt: "display-check", url: location.href.split("?")[0], width: W, pageId: m ? +m[1] : 0, issues: out };
    try { (window.opener || window.parent).postMessage(msg, "*"); } catch (e) {}
  }
  if (document.readyState === "complete") run(); else addEventListener("load", run);
})();
