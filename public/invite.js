const initialInviteCode = new URLSearchParams(location.search).get("room")?.trim().toUpperCase() || null;
const inviteCopy = "Private picks, shared reveal, no pressure.";
let inviteBootstrapStarted = false;

function storedIdentity(code) {
  if (!code) return null;
  try {
    return JSON.parse(localStorage.getItem(`sync.room.${code}`));
  } catch {
    return null;
  }
}

function canonicalRoomUrl(code) {
  const url = new URL("/", location.origin);
  url.searchParams.set("room", code);
  return url.toString();
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the DOM copy path for browsers that expose the API but deny permission.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy is unavailable in this browser.");
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setInviteStatus(panel, message) {
  setText(panel.querySelector("[data-invite-status]"), message);
}

function rosterNames() {
  return [...document.querySelectorAll(".lobby-player:not(.vacant) b")]
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function enhanceLobby() {
  const roomCodeNode = document.querySelector(".room-code");
  if (!roomCodeNode) return;

  const code = roomCodeNode.textContent?.trim().toUpperCase();
  if (!code) return;

  const title = document.querySelector(".lobby-title");
  if (!title) return;

  let panel = document.querySelector(".room-invite-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "room-invite-panel";
    panel.setAttribute("aria-label", "Invite friends to this room");
    panel.innerHTML = `
      <div class="room-invite-copy">
        <span class="room-invite-kicker">INVITE YOUR PEOPLE</span>
        <strong>${inviteCopy}</strong>
        <span class="room-invite-roster" data-invite-roster></span>
      </div>
      <div class="room-invite-actions">
        <button type="button" class="btn btn-secondary room-invite-button" data-copy-room-link>COPY ROOM LINK</button>
        <button type="button" class="btn btn-primary room-invite-button" data-share-room-link>SHARE INVITE</button>
      </div>
      <code class="room-invite-url" data-room-url></code>
      <span class="room-invite-status" role="status" aria-live="polite" data-invite-status></span>
    `;
    title.insertAdjacentElement("afterend", panel);

    panel.querySelector("[data-copy-room-link]")?.addEventListener("click", async () => {
      const activeCode = document.querySelector(".room-code")?.textContent?.trim().toUpperCase();
      if (!activeCode) return;
      try {
        await copyText(canonicalRoomUrl(activeCode));
        setInviteStatus(panel, "Room link copied.");
      } catch (error) {
        setInviteStatus(panel, error instanceof Error ? error.message : "Copy is unavailable in this browser.");
      }
    });

    panel.querySelector("[data-share-room-link]")?.addEventListener("click", async () => {
      const activeCode = document.querySelector(".room-code")?.textContent?.trim().toUpperCase();
      if (!activeCode) return;
      const url = canonicalRoomUrl(activeCode);
      if (!navigator.share) {
        try {
          await copyText(url);
          setInviteStatus(panel, "Sharing is unavailable here, so the room link was copied instead.");
        } catch (error) {
          setInviteStatus(panel, error instanceof Error ? error.message : "Sharing is unavailable in this browser.");
        }
        return;
      }
      try {
        await navigator.share({ title: "Join my SYNC room", text: inviteCopy, url });
        setInviteStatus(panel, "Invite shared.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setInviteStatus(panel, "Share canceled.");
          return;
        }
        try {
          await copyText(url);
          setInviteStatus(panel, "Share did not open, so the room link was copied instead.");
        } catch {
          setInviteStatus(panel, "Sharing is unavailable in this browser.");
        }
      }
    });
  }

  const url = canonicalRoomUrl(code);
  setText(panel.querySelector("[data-room-url]"), url);
  const names = rosterNames();
  setText(panel.querySelector("[data-invite-roster]"), `${names.length}/8 joined${names.length ? ` · ${names.join(" · ")}` : ""}`);
}

function bootstrapInviteArrival() {
  if (!initialInviteCode || inviteBootstrapStarted || storedIdentity(initialInviteCode)) return;
  const joinButton = document.querySelector("#join");
  if (!joinButton) return;

  inviteBootstrapStarted = true;
  joinButton.click();
  queueMicrotask(() => {
    const codeInput = document.querySelector("#joinCode");
    if (codeInput instanceof HTMLInputElement) {
      codeInput.value = initialInviteCode;
      codeInput.dispatchEvent(new Event("input", { bubbles: true }));
      codeInput.focus();
    }
  });
}

function syncInviteUi() {
  bootstrapInviteArrival();
  enhanceLobby();
}

const app = document.querySelector("#app");
if (app) {
  new MutationObserver(syncInviteUi).observe(app, { childList: true, subtree: true });
}

queueMicrotask(syncInviteUi);
