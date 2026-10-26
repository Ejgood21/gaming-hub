const controls = document.querySelector(".filters");
const cards = [...document.querySelectorAll("[data-release-status]")];
const result = document.querySelector("[data-filter-result]");

if (controls && cards.length && result) {
  controls.hidden = false;
  controls.querySelector('[data-filter="all"] span').textContent = cards.length;
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    const filter = button.dataset.filter;
    for (const control of controls.querySelectorAll("button")) {
      control.setAttribute("aria-pressed", String(control === button));
    }
    let shown = 0;
    for (const card of cards) {
      card.hidden = filter !== "all" && card.dataset.releaseStatus !== filter;
      if (!card.hidden) shown++;
    }
    result.textContent = `${shown} ${shown === 1 ? "game" : "games"} shown${filter === "all" ? "" : `: ${button.textContent.trim()}`}.`;
  });
}
