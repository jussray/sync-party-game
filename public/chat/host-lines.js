// Chat SYNC — AI host line bank + presentation-only injector.
// The host speaks at phase changes (welcome, choosing, locked, reveal,
// results). This layer only READS the rendered room state and adds a host
// bubble. It never sends messages, never mutates shared SYNC gameplay
// state, and never touches scoring, timing, or room authority.

export const HOST_LINES = {
  welcome: [
    "Welcome in! I'm your host — I ask, you predict, the room reveals.",
    "Room's open, I'm on the mic. Grab your people, we start when the host says go.",
    "You made it! I run the questions, you read the room. That's the whole game."
  ],
  "choosing:classic": [
    "Classic rules: call what the room picks, then pick your own. Two moves, one brain.",
    "Read the room first, then trust your gut. Clock's ticking!",
    "What will most people choose? Lock your prediction, then your pick."
  ],
  "choosing:twin": [
    "Twin mode: you want exactly one person on your wavelength. Match one, not everyone.",
    "Find your twin out there. Somewhere in this room is your person.",
    "One match is the dream here. Who thinks like you?"
  ],
  "choosing:odd": [
    "Odd One Out: be the only one on your answer. Lonely is lovely this round.",
    "Everyone will zig — your job is to zag. Stand alone and proud.",
    "If the whole room picks it, nobody wins. Be the odd one out."
  ],
  "choosing:reverse": [
    "Reverse round: the smallest group takes it. Popular is a trap.",
    "Think small! The answer nobody picks is the one that pays.",
    "Reverse rules — run away from the crowd and take your tiny group with you."
  ],
  "choosing:perfect": [
    "Perfect Sync: everybody on the same answer or nobody scores. No pressure.",
    "One answer, whole room. Get on the same wavelength, people.",
    "This is the harmony round. Same pick, all of you. You can do this."
  ],
  locked: [
    "Locked! Answers are sealed — no take-backs in this chat.",
    "That's everyone. Reveal's coming, hold onto your predictions.",
    "Sealed and delivered. Let's see what this room is really made of."
  ],
  "reveal-hit": [
    "You called it! That's a proper read of the room.",
    "Prediction on the money. The room moves and you move with it.",
    "Knew it, didn't you? Top answer, exactly where you said."
  ],
  "reveal-miss": [
    "The room surprised you! That's the game — people are gloriously unpredictable.",
    "Missed that one. The room had other ideas, and honestly? Fair.",
    "Not this time. Study the room, next round's yours."
  ],
  "reveal-high-sync": [
    "Look at that sync! This room is sharing one brain cell and it's working.",
    "Huge sync energy. You people are finishing each other's answers.",
    "The room moved as one. Chills. Actual chills."
  ],
  "results-winner": [
    "And that's the game! {winner} takes the room. GG, everyone.",
    "Final word: {winner} read this room best tonight. Rematch energy, anyone?",
    "{winner} wins it! The rest of you — beautiful chaos, no notes."
  ],
  "results-prediction-read": [
    "Your prediction read tonight: {hits}/{total}. That's your room-reading score — it lives on this device.",
    "You called {hits} of {total} rooms right. Your prediction record stays yours, on this device."
  ]
};

if (typeof window !== "undefined") window.ChatHostLines = HOST_LINES;

const PREDICTION_STORE_KEY = "sync.chat.prediction.v1";
const MODE_KEYS = {
  "Classic Sync": "classic",
  "Twin": "twin",
  "Odd One Out": "odd",
  "Reverse": "reverse",
  "Perfect Sync": "perfect"
};

let lastSignature = null;

function pickLine(key, seedText) {
  const bank = HOST_LINES[key];
  if (!bank?.length) return null;
  let hash = 0;
  const seed = String(seedText || key);
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return bank[hash % bank.length];
}

function readPredictionStore() {
  try { return JSON.parse(sessionStorage.getItem(PREDICTION_STORE_KEY)) || {}; }
  catch { return {}; }
}

function hostBubble(signature, text) {
  const el = document.createElement("div");
  el.className = "host-line";
  el.dataset.hostSig = signature;
  el.setAttribute("role", "status");
  const label = document.createElement("span");
  label.className = "host-line-label";
  label.textContent = "Your host ✦";
  el.append(label, document.createTextNode(text));
  return el;
}

function inject(bubble, anchor, signature, text, before = false) {
  if (!bubble || !text) return;
  const existing = bubble.querySelector(".host-line");
  if (existing?.dataset.hostSig === signature) return;
  existing?.remove();
  const el = hostBubble(signature, text);
  if (anchor) {
    if (before) anchor.before(el); else anchor.after(el);
  } else {
    bubble.append(el);
  }
}

function detectAndSpeak() {
  const thread = document.querySelector(".thread");
  if (!thread) return;

  // RESULTS — rankings on screen.
  const rankings = thread.querySelector(".rankings");
  if (rankings) {
    const bubble = rankings.closest(".bubble");
    const winner = rankings.querySelector(".rank-row span")?.textContent?.replace(/\s*·\s*you\s*$/, "").trim() || "Nobody";
    const signature = `results|${winner}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      const line = pickLine("results-winner", signature)?.replace("{winner}", winner);
      inject(bubble, rankings, signature, line, true);
      const resolved = Object.values(readPredictionStore()).filter((item) => item?.resolved);
      if (resolved.length && bubble) {
        const hits = resolved.filter((item) => item.accurate).length;
        const read = pickLine("results-prediction-read", signature)
          ?.replace("{hits}", String(hits)).replace("{total}", String(resolved.length));
        const winnerEl = bubble.querySelector(".host-line");
        if (read && winnerEl && !bubble.querySelector(".host-line.host-line--read")) {
          const el = hostBubble(`${signature}|read`, read);
          el.classList.add("host-line--read");
          winnerEl.after(el);
        }
      }
    }
    return;
  }

  // REVEAL — result rows on screen.
  const rows = [...thread.querySelectorAll(".result-row")];
  if (rows.length) {
    const bubble = rows[0].closest(".bubble");
    const roundText = bubble?.querySelector(".eyebrow")?.textContent || "";
    const roundNumber = roundText.match(/round\s+(\d+)/i)?.[1] || "";
    const signature = `reveal|${roundNumber}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      const sync = Number(thread.querySelector(".sync-score")?.textContent?.match(/\d+/)?.[0] || 0);
      let key = null;
      if (sync >= 80) {
        key = "reveal-high-sync";
      } else {
        const counts = rows.map((row) => Number(row.querySelector("strong")?.textContent?.split("/")[0]) || 0);
        const topIndex = counts.indexOf(Math.max(...counts));
        const entries = Object.entries(readPredictionStore());
        const found = roundNumber
          ? entries.find(([k]) => k.includes(`Round ${roundNumber} `))
          : entries[entries.length - 1];
        const prediction = found?.[1];
        if (prediction?.predictionIndex !== undefined) {
          key = prediction.predictionIndex === topIndex ? "reveal-hit" : "reveal-miss";
        }
      }
      const line = key ? pickLine(key, signature) : null;
      inject(bubble, bubble?.querySelector(".result-grid"), signature, line, true);
    }
    return;
  }

  // CHOOSING — choice buttons on screen.
  const choices = thread.querySelector(".choices");
  if (choices) {
    const bubble = choices.closest(".bubble");
    const meta = bubble?.querySelector(".meta-row span")?.textContent?.trim() || "";
    const modeLabel = meta.split("·").pop()?.trim() || "";
    const modeKey = MODE_KEYS[modeLabel] || "classic";
    const signature = `choosing|${meta}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      inject(bubble, bubble?.querySelector(".prompt"), signature, pickLine(`choosing:${modeKey}`, signature));
    }
    return;
  }

  // LOCKED — locked prompt, no choices.
  const prompt = thread.querySelector(".prompt");
  if (prompt && /LOCKED/i.test(prompt.textContent || "")) {
    const bubble = prompt.closest(".bubble");
    const meta = bubble?.querySelector(".meta-row span")?.textContent?.trim() || "";
    const signature = `locked|${meta}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      inject(bubble, prompt, signature, pickLine("locked", signature));
    }
    return;
  }

  // LOBBY / WELCOME — room code on screen.
  const roomCode = thread.querySelector(".room-code");
  if (roomCode) {
    const bubble = roomCode.closest(".bubble");
    const signature = `lobby|${roomCode.textContent?.trim() || ""}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      inject(bubble, null, signature, pickLine("welcome", signature));
    }
    return;
  }

  lastSignature = null;
}

function speak() {
  try { detectAndSpeak(); } catch { /* presentation-only: never break the game */ }
}

const chatAppRoot = typeof document !== "undefined" ? document.querySelector("#chatApp") : null;
if (chatAppRoot) {
  const hostObserver = new MutationObserver(() => requestAnimationFrame(speak));
  hostObserver.observe(chatAppRoot, { childList: true, subtree: true });
  speak();
}
