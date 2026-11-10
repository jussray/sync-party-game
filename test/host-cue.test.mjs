import test from "node:test";
import assert from "node:assert/strict";
import { createAiCuePresenter } from "../public/host-cue.js";

test("AI host comment is plain text, cached and never required for gameplay", async () => {
  const before = globalThis.document;
  const root = { append(element) { this.current = element; } };
  globalThis.document = {
    querySelector(selector) {
      return selector === ".thread" || selector === "#gameCard" ? root
        : selector === ".sync-ai-cue" ? root.current : null;
    },
    createElement(tag) {
      assert.equal(tag, "aside");
      return { dataset: {}, style: {}, setAttribute() {}, hidden: false, textContent: "" };
    }
  };
  try {
    let calls = 0;
    const presenter = createAiCuePresenter(async () => {
      calls += 1;
      return { generated: true, authority: "none", text: "<literal-not-html>" };
    });
    const options = { code: "ABCDE", identity: { playerId: "p", resumeToken: "private" }, phase: "reveal", seq: 8, selector: ".thread" };
    presenter(options);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(root.current.textContent, "✦ AI host · <literal-not-html>");
    assert.equal(root.current.hidden, false);
    presenter(options);
    assert.equal(calls, 1, "cached text does not re-bill provider");
    presenter({ ...options, phase: "choosing" });
    assert.equal(calls, 1, "choosing never creates another live cue");
  } finally {
    globalThis.document = before;
  }
});
