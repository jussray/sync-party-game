// Presentation only: AI never owns game state, scoring, or hidden answers.
export function createAiCuePresenter(requestCue) {
  const cache = new Map();
  const running = new Set();

  return function presentAiCue({ code, identity, phase, seq, selector }) {
    if (phase !== "reveal" && phase !== "results") return;
    const key = `${code}:${phase}:${seq}`;
    const root = document.querySelector(selector);
    if (!root) return;

    const aside = document.createElement("aside");
    aside.className = "sync-ai-cue";
    aside.dataset.aiCueKey = key;
    aside.setAttribute("aria-live", "polite");
    aside.setAttribute("aria-label", "Optional AI host commentary");
    aside.style.cssText = "margin-top:16px;padding:12px 16px;border:1px solid currentColor;border-radius:14px;opacity:.9;line-height:1.5";
    aside.hidden = true;
    root.append(aside);

    function paint(text) {
      const current = document.querySelector(".sync-ai-cue");
      if (!text || current?.dataset.aiCueKey !== key) return;
      current.textContent = `✦ AI host · ${text}`;
      current.hidden = false;
    }

    if (cache.has(key)) return paint(cache.get(key));
    if (running.has(key)) return;
    running.add(key);
    void (async () => {
      try {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const answer = await requestCue({ code, identity });
          if (answer?.status === "pending") {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          if (!answer?.generated || answer.authority !== "none" || typeof answer.text !== "string") return;
          cache.set(key, answer.text);
          paint(answer.text);
          return;
        }
      } catch {
        // Provider outage is never a gameplay error; the game continues normally.
      } finally {
        running.delete(key);
      }
    })();
  };
}
