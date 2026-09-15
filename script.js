"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(pointer:fine)");
const tween = typeof gsap !== "undefined";
let motionOff = false,
  soundOn = false,
  activeView = "space",
  routeToken = "",
  transitionId = 0;
const moving = () => !reduce.matches && !motionOff;
const film = $("#preview-video"),
  dialog = $("#preview");
const SPACE_ITEMS = [];
// Four complete projects remain in projects.js; the sphere presents 18 entry points.
PROJECTS.forEach((project, pi) => {
  [0, 2, 3, 5].forEach((si) =>
    SPACE_ITEMS.push({
      project: pi,
      slide: si,
      src: project.images[si].src,
      title: project.name,
      subtitle: project.images[si].alt,
    }),
  );
});
SPACE_ITEMS.splice(4, 0, {
  project: null,
  src: "assets/media/studio-film-poster.jpg",
  video: true,
  title: "DZMT studio",
  subtitle: "Motion design / Studio film",
});
SPACE_ITEMS.splice(12, 0, {
  project: null,
  src: "assets/images/cerberus.png",
  title: "Cerberus",
  subtitle: "Colour, form & visual storytelling",
});
const sphere = $("#sphere");
let cards = [],
  yaw = 0.28,
  pitch = -0.12,
  velocityX = 0,
  velocityY = 0,
  interacted = false;
let introStart = null,
  introDone = false,
  hoverIndex = null,
  drag = null,
  suppressClickUntil = 0;
let viewWidth = innerWidth,
  viewHeight = innerHeight,
  radius = 250,
  tileHeight = 82;
let previousTime = 0,
  dirty = true,
  frameId = 0,
  previewIndex = 0,
  previewMode = "space",
  previewProject = 0,
  previousFocus;
let audioContext;
function clickSound() {
  if (!soundOn || !audioContext) return;
  try {
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain(),
      now = audioContext.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.025);
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (_) {}
}
function themeUI() {
  const dark = document.documentElement.dataset.theme === "dark";
  $("#theme-toggle").setAttribute("aria-pressed", String(dark));
  $("#theme-toggle").title = dark
    ? "Switch to light mode"
    : "Switch to dark mode";
  $('meta[name="theme-color"]').content = dark ? "#101112" : "#ffffff";
}
themeUI();
$("#theme-toggle").onclick = () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem("dzmt-theme", theme);
  } catch (_) {}
  themeUI();
  clickSound();
};
$("#sound-toggle").onclick = () => {
  soundOn = !soundOn;
  $("#sound-toggle").setAttribute("aria-pressed", String(soundOn));
  $("#sound-toggle").title = soundOn ? "Sound on" : "Sound off";
  film.muted = !soundOn;
  if (soundOn) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioContext ||= new AC();
        audioContext.resume().catch(() => {});
      }
    } catch (_) {}
    clickSound();
  }
};
function motionUI() {
  document.body.classList.toggle("motion-off", !moving());
  $("#motion-toggle").textContent = moving() ? "Motion ON" : "Motion OFF";
  $("#motion-toggle").setAttribute("aria-pressed", String(!moving()));
  $("#motion-toggle").setAttribute(
    "aria-label",
    moving() ? "Pause motion" : "Resume motion",
  );
  if (!moving()) {
    introDone = true;
    $(".intro-mark").hidden = true;
    velocityX = velocityY = 0;
    film.pause();
  }
  dirty = true;
}
$("#motion-toggle").onclick = () => {
  motionOff = !motionOff;
  motionUI();
};
reduce.addEventListener("change", motionUI);
function caption(i) {
  if (i === hoverIndex) return;
  hoverIndex = i;
  const item = SPACE_ITEMS[i];
  $("#space-title").textContent = item ? item.title : "Strategy made visible.";
  $("#space-subtitle").textContent = item
    ? item.subtitle
    : "Branding, marketing & creative AI";
  if (item) {
    $("#space-count").textContent = String(i + 1).padStart(3, "0");
    clickSound();
  }
  if (tween && moving())
    gsap.fromTo(
      "#space-caption",
      { y: 7, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, ease: "power4.out", overwrite: true },
    );
}
SPACE_ITEMS.forEach((item, i) => {
  const el = document.createElement("button");
  el.className = "orbit-card";
  el.setAttribute("aria-label", `${item.title}: ${item.subtitle}`);
  el.dataset.index = i;
  const img = new Image();
  img.src = item.src;
  img.alt = "";
  img.draggable = false;
  el.append(img);
  sphere.append(el);
  const y = 1 - ((i + 0.5) * 2) / SPACE_ITEMS.length,
    a = i * Math.PI * (3 - Math.sqrt(5)),
    r = Math.sqrt(1 - y * y);
  cards.push({ el, x: Math.cos(a) * r, y, z: Math.sin(a) * r });
  el.addEventListener("pointerenter", () => {
    if (!drag) caption(i);
  });
  el.addEventListener("pointerleave", () => {
    if (!dialog.open) caption(null);
  });
  el.addEventListener("focus", () => caption(i));
  el.addEventListener("click", () => {
    if (performance.now() < suppressClickUntil) return;
    openPreview("space", i);
  });
});
function measure() {
  viewWidth = sphere.clientWidth || innerWidth;
  viewHeight = sphere.clientHeight || innerHeight;
  const middle = viewWidth > 1024 && viewWidth <= 1440;
  tileHeight = viewWidth <= 640 ? 60 : middle ? 65.6 : 82;
  radius =
    viewWidth <= 640 ? (viewWidth - 48 - tileHeight) / 2 : middle ? 200 : 250;
  radius = Math.max(70, Math.min(radius, (viewHeight - 220) / 2));
  cards.forEach((c) => {
    c.el.style.width = tileHeight * 0.75 + "px";
    c.el.style.height = tileHeight + "px";
  });
  dirty = true;
}
const smooth = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 4);
function paint(time) {
  const dt = previousTime ? Math.min(2, (time - previousTime) / 16.667) : 1;
  previousTime = time;
  if (activeView !== "space" || document.hidden || dialog.open || document.documentElement.classList.contains("creative-intro-active")) return;
  if (introStart === null) introStart = time;
  const elapsed = (time - introStart) / 1000;
  if (!moving() || elapsed >= 4.4) {
    if (!introDone) $("#space-count").textContent = "001";
    introDone = true;
    $(".intro-mark").hidden = true;
  }
  if (introDone && moving()) {
    if (!interacted) {
      yaw += 0.001 * dt;
      pitch += 0.00006 * dt;
    }
    yaw += velocityX * dt;
    pitch += velocityY * dt;
    velocityX *= Math.pow(0.94, dt);
    velocityY *= Math.pow(0.94, dt);
  }
  if (introDone && !moving() && !dirty) return;
  dirty = false;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cx = Math.cos(pitch),
    sx = Math.sin(pitch),
    focal = viewHeight * 0.8660254;
  cards.forEach((c, i) => {
    const x1 = c.x * cy + c.z * sy,
      z1 = -c.x * sy + c.z * cy;
    let x = x1 * radius,
      y = (c.y * cx - z1 * sx) * radius,
      z = (c.y * sx + z1 * cx) * radius,
      scale = 1,
      opacity = 1;
    if (!introDone) {
      const ringRadius = Math.min(radius, viewWidth * 0.33),
        theta =
          -Math.PI / 2 +
          (i * Math.PI) / 5 +
          elapsed * (elapsed < 1.5 ? 0.6 : 2.7);
      const ringX = Math.cos(theta) * ringRadius,
        ringY = Math.sin(theta) * ringRadius;
      if (elapsed < 2.15) {
        x = ringX;
        y = ringY;
        z = 0;
        scale = 0.85 * smooth((elapsed - i * 0.065) / 0.8);
        opacity = i < 10 ? 1 : 0;
      } else if (elapsed < 3.3) {
        const t = smooth((elapsed - 2.15 - i * 0.024) / 0.8);
        x = ringX * (1 - t);
        y = ringY * (1 - t);
        z = i * 0.9 * t;
        scale = 0.85 + 0.45 * t;
        opacity = i < 10 ? 1 : 0;
      } else {
        const t = smooth((elapsed - 3.3) / 1.05);
        x *= t;
        y *= t;
        z *= t;
        scale = 1.3 - 0.3 * t;
        opacity = 1;
      }
      $(".intro-mark").style.opacity = String(
        1 - smooth((elapsed - 1.85) / 0.5),
      );
      $("#space-count").textContent = String(
        Math.min(100, Math.round((elapsed / 4.4) * 100)),
      ).padStart(3, "0");
    }
    const perspective = focal / (focal - z);
    c.el.style.transform = `translate(-50%,-50%) translate3d(${(x * perspective).toFixed(2)}px,${(y * perspective).toFixed(2)}px,0) scale(${(perspective * scale).toFixed(4)})`;
    c.el.style.zIndex = String(1000 + Math.round(z));
    c.el.style.opacity = String(opacity);
    c.el.style.pointerEvents = introDone ? "auto" : "none";
  });
}
function tick(time) {
  paint(time);
  frameId = requestAnimationFrame(tick);
}
sphere.addEventListener(
  "wheel",
  (e) => {
    if (!introDone) return;
    e.preventDefault();
    interacted = true;
    if (moving()) velocityX += Math.max(-150, Math.min(150, e.deltaY)) * 0.0002;
    else yaw += e.deltaY * 0.0006;
    dirty = true;
  },
  { passive: false },
);
sphere.addEventListener("pointerdown", (e) => {
  if (!introDone || e.button !== 0) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
  interacted = true;
  sphere.classList.add("dragging");
});
window.addEventListener("pointermove", (e) => {
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.travel += Math.hypot(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (moving()) {
      velocityX += dx * 0.001;
      velocityY += dy * 0.001;
    } else {
      yaw += dx * 0.005;
      pitch += dy * 0.005;
    }
    if (drag.travel > 6) suppressClickUntil = performance.now() + 500;
    dirty = true;
  }
  if (fine.matches && moving()) {
    const target = e.target.closest(
      ".orbit-card,.tile-media,.case-images button",
    );
    $("#cursor-label").classList.toggle("active", !!target);
    $("#cursor-label").style.transform =
      `translate(${e.clientX + 18}px,${e.clientY + 18}px)`;
  }
});
function endDrag() {
  if (drag?.travel > 6) suppressClickUntil = performance.now() + 250;
  drag = null;
  sphere.classList.remove("dragging");
}
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
window.addEventListener("blur", endDrag);
sphere.addEventListener("keydown", (e) => {
  const delta = {
    ArrowLeft: [-0.15, 0],
    ArrowRight: [0.15, 0],
    ArrowUp: [0, -0.15],
    ArrowDown: [0, 0.15],
  }[e.key];
  if (!delta) return;
  e.preventDefault();
  interacted = true;
  yaw += delta[0];
  pitch += delta[1];
  dirty = true;
});
window.addEventListener("resize", measure);
measure();
motionUI();
frameId = requestAnimationFrame(tick);
/* Native project pages and transitions work directly from index.html. */
const grid = $("#project-grid");
const collectionIndex = $("#collection-index");
function addWork(container, image, title, subtitle, open) {
  const article = document.createElement("article");
  article.className = "project-tile";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile-media";
  button.setAttribute("aria-label", "View " + title);
  button.onclick = open;
  const img = new Image();
  img.src = image;
  img.alt = title;
  img.loading = "lazy";
  img.decoding = "async";
  button.append(img);
  const caption = document.createElement("div");
  caption.className = "tile-caption";
  const heading = document.createElement("h3"),
    sub = document.createElement("p");
  heading.textContent = title;
  sub.textContent = subtitle;
  caption.append(heading, sub);
  article.append(button, caption);
  container.append(article);
}
function addCollection(id, name, count, index) {
  const section = document.createElement("section");
  section.className = "project-collection";
  section.id = "collection-" + id;
  section.setAttribute("aria-labelledby", section.id + "-title");
  const header = document.createElement("header");
  header.className = "collection-heading";
  const heading = document.createElement("h2");
  heading.id = section.id + "-title";
  heading.tabIndex = -1;
  heading.textContent = name;
  const meta = document.createElement("div");
  meta.className = "collection-meta";
  const number = document.createElement("span");
  number.textContent = String(count).padStart(2, "0") + " pieces";
  meta.append(number);
  if (index !== null) {
    const link = document.createElement("a");
    link.href = "#project/" + id;
    link.textContent = "Explore the project ↗";
    link.setAttribute("aria-label", "View " + name + " case study");
    meta.append(link);
  }
  header.append(heading, meta);
  const items = document.createElement("div");
  items.className = "project-grid";
  section.append(header, items);
  grid.append(section);
  const jump = document.createElement("button");
  jump.type = "button";
  const label = document.createElement("span"),
    total = document.createElement("sup");
  label.textContent = name;
  total.textContent = String(count).padStart(2, "0");
  jump.append(label, total);
  jump.setAttribute("aria-controls", section.id);
  jump.addEventListener("click", () => {
    const page = $("#projects-page");
    page.scrollTo({
      top:
        page.scrollTop +
        section.getBoundingClientRect().top -
        page.getBoundingClientRect().top -
        96,
      behavior: moving() ? "smooth" : "instant",
    });
    heading.focus({ preventScroll: true });
  });
  collectionIndex.append(jump);
  return items;
}
PROJECTS.forEach((project, pi) => {
  const items = addCollection(
    project.id,
    project.name,
    project.images.length,
    pi,
  );
  project.images.forEach((im, i) =>
    addWork(
      items,
      im.src,
      im.alt,
      project.name + " / " + String(i + 1).padStart(2, "0"),
      () => openPreview("project", i, pi),
    ),
  );
});
const explorations = addCollection("explorations", "Explorations", 2, null);
addWork(
  explorations,
  "assets/media/studio-film-poster.jpg",
  "DZMT studio",
  "Motion design · Play film ↗",
  () => openPreview("space", 4),
);
addWork(
  explorations,
  "assets/images/cerberus.png",
  "Cerberus",
  "Visual exploration",
  () => openPreview("space", 12),
);
function renderCase(index) {
  const p = PROJECTS[index];
  $("#case-title").textContent = p.name;
  $("#case-description").textContent = p.description + " " + p.text;
  $("#case-count").textContent = String(index + 1).padStart(2, "0") + " / 04";
  $("#case-meta").replaceChildren();
  [
    ["Discipline", p.focus],
    ["Role", p.role],
    ["Output", p.output],
    ...(p.context ? [["Context", p.context]] : []),
  ].forEach(([label, value]) => {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    $("#case-meta").append(dt, dd);
  });
  $("#case-documents").replaceChildren();
  if (p.id === "archetype")
    [
      ["Full degree project ↗", "assets/archetype-tfg.pdf"],
      ["Strategy & development ↗", "assets/archetype-portfolio.pdf"],
    ].forEach(([label, url]) => {
      const a = document.createElement("a");
      a.textContent = label;
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      $("#case-documents").append(a);
    });
  $("#case-images").replaceChildren();
  p.images.forEach((im, i) => {
    const figure = document.createElement("figure"),
      button = document.createElement("button"),
      image = new Image(),
      caption = document.createElement("figcaption");
    image.src = im.src;
    image.alt = im.alt;
    image.loading = i ? "lazy" : "eager";
    caption.textContent = String(i + 1).padStart(2, "0") + " / " + im.alt;
    button.setAttribute("aria-label", "Enlarge: " + im.alt);
    button.onclick = () => openPreview("project", i, index);
    button.append(image);
    figure.append(button, caption);
    $("#case-images").append(figure);
  });
  const next = PROJECTS[(index + 1) % PROJECTS.length];
  $("#next-project").href = "#project/" + next.id;
  $("#next-project span:last-child").textContent = next.name + " ↗";
}
function route(hash, animate = true) {
  const token = (hash || "#space").slice(1);
  if (token === routeToken) return;
  const caseId = token.startsWith("project/") ? token.slice(8) : null;
  const projectIndex = PROJECTS.findIndex((p) => p.id === caseId);
  const view =
    projectIndex >= 0
      ? "case"
      : ["space", "projects", "about"].includes(token)
        ? token
        : "space";
  if (dialog.open) dialog.close();
  routeToken = token;
  const previous = activeView;
  activeView = view;
  document.body.dataset.page = view;
  const generation = ++transitionId,
    old = $(`[data-view="${previous}"]`),
    next = $(`[data-view="${view}"]`);
  if (projectIndex >= 0) renderCase(projectIndex);
  const titles = {
    space: "Branding, Marketing & Creative AI",
    projects: "Selected Work",
    about: "About & Approach",
    case: PROJECTS[projectIndex]?.name,
  };
  document.title = "Manu Díaz — " + titles[view];
  $$(".site-header [data-page]").forEach((a) => {
    if (a.dataset.page === (view === "case" ? "projects" : view))
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $$(".page").forEach((page) => {
    if (tween) gsap.killTweensOf(page);
    page.style.transform = "";
    if (page !== old && page !== next) page.hidden = true;
  });
  next.hidden = false;
  next.scrollTop = 0;
  if (old !== next && tween && moving() && animate) {
    const order = { space: 0, projects: 1, about: 2, case: 3 },
      dir = order[view] >= order[previous] ? 1 : -1;
    gsap.fromTo(
      next,
      { xPercent: 100 * dir },
      {
        xPercent: 0,
        duration: 1,
        ease: "power4.inOut",
        clearProps: "transform",
      },
    );
    gsap.fromTo(
      old,
      { xPercent: 0 },
      {
        xPercent: -100 * dir,
        duration: 1,
        ease: "power4.inOut",
        onComplete: () => {
          if (generation === transitionId) old.hidden = true;
        },
      },
    );
  } else {
    if (old !== next) old.hidden = true;
  }
  if (view === "space") {
    dirty = true;
    measure();
  } else {
    introDone = true;
    $(".intro-mark").hidden = true;
    const heading = next.querySelector("h1");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  $("#cursor-label").classList.remove("active");
  clickSound();
}
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const hash = a.getAttribute("href");
  if (location.hash !== hash) history.pushState(null, "", hash);
  route(hash);
});
window.addEventListener("popstate", () => route(location.hash));
window.addEventListener("hashchange", () => route(location.hash));
/* Expanding artwork with a native dialog and complete per-project galleries. */
function currentItem() {
  if (previewMode === "space") return SPACE_ITEMS[previewIndex];
  const p = PROJECTS[previewProject],
    im = p.images[previewIndex];
  return {
    project: previewProject,
    src: im.src,
    title: p.name,
    subtitle: im.alt,
  };
}
function updatePreview() {
  const item = currentItem();
  $("#preview-title").textContent = item.title;
  $("#preview-subtitle").textContent = item.subtitle;
  const video = !!item.video;
  $("#preview-image").hidden = video;
  film.hidden = !video;
  if (video) {
    film.muted = !soundOn;
    if (moving() && !document.hidden) film.play().catch(() => {});
  } else {
    film.pause();
    $("#preview-image").src = item.src;
    $("#preview-image").alt = item.subtitle;
  }
  $("#preview-case").hidden = item.project === null;
  $("#preview-case").href =
    item.project === null
      ? "#projects"
      : "#project/" + PROJECTS[item.project].id;
  const count =
    previewMode === "space"
      ? SPACE_ITEMS.length
      : PROJECTS[previewProject].images.length;
  $("#preview-count").textContent =
    String(previewIndex + 1).padStart(2, "0") +
    " / " +
    String(count).padStart(2, "0");
}
function openPreview(mode, index, pi = 0) {
  previewMode = mode;
  previewIndex = index;
  previewProject = pi;
  previousFocus = document.activeElement;
  const from = previousFocus?.getBoundingClientRect();
  updatePreview();
  dialog.showModal();
  $("#preview-close").focus();
  if (tween && moving()) {
    gsap.fromTo(
      dialog,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "opacity" },
    );
    const media = $(".preview-media"),
      to = media.getBoundingClientRect();
    if (from?.width && to.width)
      gsap.fromTo(
        media,
        {
          x: from.left + from.width / 2 - to.left - to.width / 2,
          y: from.top + from.height / 2 - to.top - to.height / 2,
          scale: Math.max(0.06, from.width / to.width),
        },
        {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.9,
          ease: "power4.out",
          clearProps: "transform",
        },
      );
  }
  $("#cursor-label").classList.remove("active");
  clickSound();
}
function closePreview() {
  if (tween && moving())
    gsap.to(dialog, {
      opacity: 0,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => {
        dialog.close();
        dialog.style.opacity = "";
      },
    });
  else dialog.close();
}
function stepPreview(delta) {
  const total =
    previewMode === "space"
      ? SPACE_ITEMS.length
      : PROJECTS[previewProject].images.length;
  previewIndex = (previewIndex + delta + total) % total;
  updatePreview();
  clickSound();
}
$("#preview-close").onclick = closePreview;
$("#preview-prev").onclick = () => stepPreview(-1);
$("#preview-next").onclick = () => stepPreview(1);
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closePreview();
});
dialog.addEventListener("close", () => {
  film.pause();
  if (tween) gsap.killTweensOf(dialog);
  dialog.style.opacity = "";
  previousFocus?.focus({ preventScroll: true });
  dirty = true;
});
dialog.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepPreview(-1);
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    stepPreview(1);
  }
});
document.addEventListener("visibilitychange", () => {
  previousTime = 0;
  if (document.hidden) film.pause();
  else if (dialog.open && currentItem().video && moving())
    film.play().catch(() => {});
  dirty = true;
});
route(location.hash, false);
if (document.fonts)
  document.fonts.ready.then(() => {
    measure();
    dirty = true;
  });

// The work sphere emerges from the same centre as the expanding glass shell.
document.addEventListener('creative:enter', (event) => {
  introDone = true; introStart = performance.now(); dirty = true;
  $(".intro-mark").hidden = true;
  const r = $("#space-page").getBoundingClientRect(), origin = event.detail || {};
  sphere.style.setProperty('--reveal-x', `${(origin.originX ?? r.left+r.width/2)-(r.left+r.width/2)}px`);
  sphere.style.setProperty('--reveal-y', `${(origin.originY ?? r.top+r.height/2)-(r.top+r.height/2)}px`);
  paint(performance.now());
});
document.addEventListener('creative:entered', () => {
  sphere.style.removeProperty('--reveal-x');
  sphere.style.removeProperty('--reveal-y');
  dirty = true;
});
