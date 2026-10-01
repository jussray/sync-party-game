// CHATGPT_SYNC_VISUAL_V1
// Surface-only prediction lens. Never mutates shared SYNC gameplay authority.

const STORAGE_KEY = "sync.chat.prediction.v1";
const visualState = {
  currentRoundKey: null,
  stage: "prediction"
};

document.documentElement.dataset.visualCookie = "CHATGPT_SYNC_VISUAL_V1";

function readPredictions() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function writePredictions(value) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function activeRoundKey() {
  const meta = document.querySelector(".meta-row span")?.textContent?.trim() || "";
  const prompt = document.querySelector(".prompt")?.textContent?.trim() || "";
  return prompt ? `${meta}::${prompt}` : null;
}

function decorateHome() {
  const thread = document.querySelector(".thread");
  if (!thread || document.querySelector(".prompt") || document.querySelector(".room-code")) return;
  const articles = [...thread.querySelectorAll(":scope > .bubble")];
  if (articles.length < 2) return;

  thread.classList.add("chat-home-v1");
  const hero = articles[0];
  const action = articles[1];
  const heading = hero.querySelector("h1");
  const copy = hero.querySelector(".copy");
  const eyebrow = hero.querySelector(".eyebrow");

  if (heading) heading.innerHTML = `Predict the prompt.<br><strong>Read the room.</strong>`;
  if (copy) copy.textContent = "ChatGPT SYNC adds a local prediction lens before your real SYNC answer: guess what the room will choose, then make your own pick. Shared room authority stays unchanged.";
  if (eyebrow) eyebrow.textContent = "AI-HOSTED PREDICTION LENS";

  const actionHeading = action.querySelector("h2");
  if (actionHeading) actionHeading.textContent = "Can you predict your people?";
  const local = action.querySelector(".local-only");
  if (local) local.textContent = "Prediction is private to this Chat Edition surface. The shared Durable Object still owns room state, timing, answers and scoring.";

  if (!action.querySelector(".ai-host-card")) {
    const host = document.createElement("div");
    host.className = "ai-host-card";
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = `
      <img src="/chat/ai-host.svg" alt="" />
      <span class="ai-chip one">SAME PROMPT.<br>DIFFERENT MINDS.</span>
      <span class="ai-chip two">CAN YOU PREDICT<br>THE ROOM?</span>
      <span class="ai-chip three">AI HOST ONLINE ✦</span>`;
    action.prepend(host);
  }
}

function decorateChoosing() {
  const choices = document.querySelector(".choices");
  if (!choices) return;
  const key = activeRoundKey();
  if (!key) return;
  const store = readPredictions();
  const saved = store[key];

  if (visualState.currentRoundKey !== key) {
    visualState.currentRoundKey = key;
    visualState.stage = saved?.predictionIndex !== undefined ? "answer" : "prediction";
  }

  const bubble = choices.closest(".bubble");
  if (!bubble) return;

  let badge = bubble.querySelector(".chat-prediction-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "chat-prediction-badge";
    badge.textContent = "✦ Prediction Lens";
    choices.before(badge);
  }

  let intro = bubble.querySelector(".prediction-intro");
  if (!intro) {
    intro = document.createElement("div");
    choices.before(intro);
  }

  if (visualState.stage === "prediction") {
    intro.className = "prediction-intro";
    intro.innerHTML = `<strong>FIRST:</strong> tap the answer you think the room will choose most. This guess stays on your device.`;
    choices.dataset.predictionStage = "prediction";
  } else {
    intro.className = "prediction-intro prediction-locked";
    const predictedButton = choices.querySelectorAll(".choice")[saved?.predictionIndex];
    const label = predictedButton?.textContent?.trim() || "your prediction";
    intro.innerHTML = `<strong>Prediction locked:</strong> ${escapeLocal(label)}. Now make your own real SYNC pick.`;
    choices.dataset.predictionStage = "answer";
  }
}

function escapeLocal(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function capturePrediction(event) {
  const button = event.target.closest?.(".choice");
  const choices = button?.closest?.(".choices");
  if (!button || !choices || choices.dataset.predictionStage !== "prediction") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const buttons = [...choices.querySelectorAll(".choice")];
  const index = buttons.indexOf(button);
  if (index < 0) return;
  const key = activeRoundKey();
  if (!key) return;

  const store = readPredictions();
  store[key] = {
    predictionIndex: index,
    label: button.textContent.trim(),
    recordedAt: Date.now()
  };
  writePredictions(store);
  visualState.stage = "answer";

  buttons.forEach((item) => item.classList.remove("prediction-picked"));
  button.classList.add("prediction-picked");
  decorateChoosing();
}

function decorateReveal() {
  const rows = [...document.querySelectorAll(".result-row")];
  if (!rows.length) return;
  const bubble = rows[0].closest(".bubble");
  if (!bubble || bubble.querySelector(".prediction-result")) return;

  const predictions = readPredictions();
  const candidates = Object.entries(predictions);
  if (!candidates.length) return;

  const metaText = bubble.querySelector(".eyebrow")?.textContent || "";
  const roundMatch = metaText.match(/round\s+(\d+)/i);
  const roundNumber = roundMatch?.[1];

  let selectedEntry = candidates[candidates.length - 1];
  if (roundNumber) {
    const found = candidates.find(([key]) => key.includes(`Round ${roundNumber} `));
    if (found) selectedEntry = found;
  }

  const [, prediction] = selectedEntry;
  if (prediction?.predictionIndex === undefined) return;

  const counts = rows.map((row) => {
    const text = row.querySelector("strong")?.textContent || "0/0";
    const count = Number(text.split("/")[0]) || 0;
    return count;
  });
  const winningIndex = counts.indexOf(Math.max(...counts));
  const accurate = prediction.predictionIndex === winningIndex;
  const winningLabel = rows[winningIndex]?.querySelector("span")?.textContent?.trim() || "the room favorite";

  const panel = document.createElement("div");
  panel.className = `prediction-result ${accurate ? "good" : ""}`;
  panel.setAttribute("role", "status");
  panel.innerHTML = accurate
    ? `<strong>Prediction hit ✦</strong><span>You called it: ${escapeLocal(winningLabel)} was the room’s top answer.</span>`
    : `<strong>Prediction missed, room surprised you.</strong><span>You predicted ${escapeLocal(prediction.label)}. The room leaned ${escapeLocal(winningLabel)}.</span>`;
  rows[0].parentElement?.before(panel);

  const store = readPredictions();
  const key = selectedEntry[0];
  if (store[key]) {
    store[key].resolved = true;
    store[key].accurate = accurate;
    writePredictions(store);
  }
}

function decorateResults() {
  const rankings = document.querySelector(".rankings");
  if (!rankings) return;
  const bubble = rankings.closest(".bubble");
  if (!bubble || bubble.querySelector(".prediction-result")) return;
  const values = Object.values(readPredictions()).filter((item) => item.resolved);
  if (!values.length) return;
  const hits = values.filter((item) => item.accurate).length;
  const panel = document.createElement("div");
  panel.className = "prediction-result";
  panel.innerHTML = `<strong>Your prediction read: ${hits}/${values.length}</strong><span>Surface-only prediction history. Shared SYNC scores above remain authoritative.</span>`;
  rankings.before(panel);
}

function decorate() {
  decorateHome();
  decorateChoosing();
  decorateReveal();
  decorateResults();
}

document.addEventListener("click", capturePrediction, true);
const observer = new MutationObserver(() => queueMicrotask(decorate));
observer.observe(document.querySelector("#chatApp"), { childList: true, subtree: true });
decorate();
