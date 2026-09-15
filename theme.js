(() => {
  // Pointer use never leaves focus outlines behind; keyboard focus stays visible.
  const root = document.documentElement;
  root.dataset.focusMode = "pointer";
  document.addEventListener("pointerdown", () => {
    root.dataset.focusMode = "pointer";
  }, { capture: true, passive: true });
  document.addEventListener("keydown", (event) => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey)
      root.dataset.focusMode = "keyboard";
  }, true);
  let theme = "light";
  try {
    const saved = localStorage.getItem("dzmt-theme");
    if (saved === "dark" || saved === "light") theme = saved;
  } catch (_) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
