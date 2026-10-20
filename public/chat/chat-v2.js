// CHATGPT_SYNC_ASSET_V2
// Presentation-only asset layer. Never mutates shared SYNC gameplay state.

document.documentElement.dataset.assetContinuity = "CHATGPT_SYNC_ASSET_V2";

function mountChatSocialScene() {
  const action = document.querySelector(".chat-home-v1 > .bubble.you");
  if (!action || action.querySelector(".chat-social-scene-v2")) return;

  const scene = document.createElement("div");
  scene.className = "chat-social-scene-v2";
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = `
    <img src="/chat/chat-social-scene-v2.svg" alt="" />
    <span class="chat-scene-badge">AI HOST + HUMAN ROOM</span>
    <span class="chat-scene-note">can you predict your people? ↗</span>`;
  action.prepend(scene);
}

function markHomeState() {
  const isHome = Boolean(document.querySelector(".chat-home-v1"));
  document.body.dataset.chatVisualState = isHome ? "home-social-scene" : "gameplay";
}

function decorateV2() {
  mountChatSocialScene();
  markHomeState();
}

const appRootV2 = document.querySelector("#chatApp");
const chatV2Observer = new MutationObserver(() => requestAnimationFrame(decorateV2));
chatV2Observer.observe(appRootV2, { childList: true, subtree: true });
decorateV2();
