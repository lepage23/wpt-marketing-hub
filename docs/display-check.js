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

    var m = document.body.className.match(/(?:page-id|postid)-(\d+)/);
    var msg = { wpt: "display-check", url: location.href.split("?")[0], width: W, pageId: m ? +m[1] : 0, issues: out };
    try { (window.opener || window.parent).postMessage(msg, "*"); } catch (e) {}
  }
  if (document.readyState === "complete") run(); else addEventListener("load", run);
})();
