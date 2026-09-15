/* Edge refraction for the Projects view.
 * Canvas 2D redraws the visible artwork and type in two narrow viewport strips.
 * A circular lens bends scanlines inward; separated RGB samples disperse colour.
 * No WebGL, pixel reads, remote services or continuous idle animation required.
 */
(() => {
  "use strict";
  const page = document.querySelector("#projects-page");
  if (!page) return;
  const make = () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    return context ? { canvas, context } : null;
  };
  const source = make();
  if (!source) return; // Retain the CSS glass fallback if Canvas is disabled.
  const channels = [make(), make(), make()];
  const edges = [make(), make()];
  if ([...channels, ...edges].some((item) => !item)) return;
  edges.forEach((edge, i) => {
    edge.canvas.className =
      "liquid-edge liquid-edge--" + (i ? "bottom" : "top");
    edge.canvas.setAttribute("aria-hidden", "true");
    document.body.append(edge.canvas);
  });
  let scheduled = 0;
  const colours = ["#ff0000", "#00ff00", "#0000ff"];
  const sag = (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t));
  const resize = (item, w, h) => {
    if (item.canvas.width !== w) item.canvas.width = w;
    if (item.canvas.height !== h) item.canvas.height = h;
  };
  const intersects = (rect, start, end) =>
    rect.width > 0 && rect.height > 0 && rect.bottom > start && rect.top < end;

  function drawImage(ctx, image, y0) {
    const r = image.getBoundingClientRect();
    if (!image.complete || !image.naturalWidth || !r.width || !r.height) return;
    // All Projects panels use centred object-fit: cover, matching the DOM.
    const scale = Math.max(
      r.width / image.naturalWidth,
      r.height / image.naturalHeight,
    );
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.left, r.top - y0, r.width, r.height);
    ctx.clip();
    ctx.drawImage(
      image,
      r.left + (r.width - w) / 2,
      r.top - y0 + (r.height - h) / 2,
      w,
      h,
    );
    ctx.restore();
  }

  function drawText(ctx, element, y0, start, end) {
    // Range measurements preserve actual wrapping, including narrow screens.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const style = getComputedStyle(node.parentElement);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.fillStyle = style.color;
      ctx.textBaseline = "alphabetic";
      if ("letterSpacing" in ctx)
        ctx.letterSpacing =
          style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const range = document.createRange(),
        lines = [];
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (!intersects(rect, start, end)) continue;
        const previous = lines[lines.length - 1];
        if (previous && Math.abs(previous.top - rect.top) < 1) {
          previous.text += node.textContent[i];
        } else
          lines.push({
            text: node.textContent[i],
            left: rect.left,
            top: rect.top,
            height: rect.height,
          });
      }
      lines.forEach((line) => {
        const metrics = ctx.measureText(line.text);
        const ascent = metrics.fontBoundingBoxAscent ?? line.height * 0.8;
        const descent = metrics.fontBoundingBoxDescent ?? line.height * 0.2;
        const baseline =
          line.top + (line.height - ascent - descent) / 2 + ascent;
        ctx.fillText(line.text, line.left, baseline - y0);
      });
    }
  }

  function drawSource(y0, height, width, ratio, paper) {
    const ctx = source.context;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    const end = y0 + height;
    page.querySelectorAll(".tile-media").forEach((tile) => {
      const r = tile.getBoundingClientRect();
      if (!intersects(r, y0, end)) return;
      ctx.fillStyle = getComputedStyle(tile).backgroundColor;
      ctx.fillRect(r.left, r.top - y0, r.width, r.height);
      const image = tile.querySelector("img");
      if (image) drawImage(ctx, image, y0);
    });
    page
      .querySelectorAll(".collection-heading, .collection-index button")
      .forEach((element) => {
        const r = element.getBoundingClientRect();
        if (!intersects(r, y0 - 1, end + 1)) return;
        const style = getComputedStyle(element);
        const top = element.classList.contains("collection-heading");
        ctx.fillStyle = top ? style.borderTopColor : style.borderBottomColor;
        const thickness =
          parseFloat(top ? style.borderTopWidth : style.borderBottomWidth) || 0;
        ctx.fillRect(
          r.left,
          (top ? r.top : r.bottom - thickness) - y0,
          r.width,
          thickness,
        );
      });
    page
      .querySelectorAll(
        ".projects-heading h1, .collection-index button, .collection-heading h2, .collection-meta > *, .tile-caption > *, .quiet-footer > *",
      )
      .forEach((element) => {
        if (intersects(element.getBoundingClientRect(), y0, end))
          drawText(ctx, element, y0, y0, end);
      });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    channels.forEach((channel, i) => {
      const c = channel.context;
      c.globalCompositeOperation = "source-over";
      c.drawImage(source.canvas, 0, 0);
      c.globalCompositeOperation = "multiply";
      c.fillStyle = colours[i];
      c.fillRect(0, 0, source.canvas.width, source.canvas.height);
      c.globalCompositeOperation = "source-over";
    });
  }

  function render() {
    scheduled = 0;
    const pageRect = page.getBoundingClientRect();
    if (
      document.hidden ||
      document.body.dataset.page !== "projects" ||
      page.hidden ||
      Math.abs(pageRect.left) > 0.5
    ) {
      document.body.classList.remove("liquid-ready");
      return;
    }
    const width = page.clientWidth,
      viewport = pageRect.height;
    if (!width || !viewport) return;
    // Eight percent at either end, the same band proportion as the reference.
    const band = Math.round(viewport * 0.08);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pxWidth = Math.ceil(width * ratio),
      pxBand = Math.ceil(band * ratio);
    // Samples never leave this strip, even at maximum colour dispersion.
    const sourceHeight = band * 2 + 4;
    const sourcePxHeight = Math.ceil(sourceHeight * ratio);
    resize(source, pxWidth, sourcePxHeight);
    channels.forEach((channel) => resize(channel, pxWidth, sourcePxHeight));
    const paper = getComputedStyle(document.documentElement)
      .getPropertyValue("--paper")
      .trim();
    edges.forEach((edge, bottom) => {
      resize(edge, pxWidth, pxBand);
      edge.canvas.style.width = width + "px";
      edge.canvas.style.height = band + "px";
      // Account for the small/visual viewport difference on mobile browsers.
      edge.canvas.style.top =
        (bottom ? pageRect.bottom - band : pageRect.top) + "px";
      edge.canvas.style.bottom = "auto";
      const y0 = bottom ? pageRect.bottom - sourceHeight : pageRect.top;
      drawSource(y0, sourceHeight, width, ratio, paper);
      const ctx = edge.context;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, pxWidth, pxBand);
      ctx.globalCompositeOperation = "lighter";
      for (let row = 0; row < pxBand; row++) {
        const y = (row + 0.5) / ratio;
        const t = Math.max(0, Math.min(1, bottom ? y / band : 1 - y / band));
        const bend = sag(t) * band;
        const original = bottom ? sourceHeight - band + y : y;
        const sample = original + (bottom ? -bend : bend);
        channels.forEach((channel, i) => {
          const dispersion = (i - 1) * bend * 0.12;
          const sy = Math.max(
            0,
            Math.min(sourcePxHeight - 1, (sample + dispersion) * ratio - 0.5),
          );
          ctx.drawImage(channel.canvas, 0, sy, pxWidth, 1, 0, row, pxWidth, 1);
        });
      }
      ctx.globalCompositeOperation = "source-over";
    });
    document.body.classList.add("liquid-ready");
  }
  function invalidate() {
    if (!scheduled) scheduled = requestAnimationFrame(render);
  }
  page.addEventListener("scroll", invalidate, { passive: true });
  page.addEventListener("load", invalidate, true);
  window.addEventListener("resize", invalidate, { passive: true });
  window.visualViewport?.addEventListener("resize", invalidate, {
    passive: true,
  });
  document.addEventListener("visibilitychange", invalidate);
  new MutationObserver(invalidate).observe(document.body, {
    attributes: true,
    attributeFilter: ["data-page"],
  });
  new MutationObserver(invalidate).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  new MutationObserver(invalidate).observe(page, {
    attributes: true,
    attributeFilter: ["style", "hidden"],
  });
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(invalidate).observe(page);
  document.fonts?.ready.then(invalidate);
  invalidate();
})();
