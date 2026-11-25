import { DurableObject } from "cloudflare:workers";
import { dailyAiLimit, reserveDailyAiCall } from "./ai-budget-logic.js";

export class AiBudget extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
  }

  async fetch(request) {
    if (new URL(request.url).pathname !== "/internal/reserve" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    if (this.env.SYNC_AI_GAME_ENABLED !== "true") {
      return Response.json({ error: "Game AI disabled" }, { status: 503 });
    }
    try {
      const receipt = await this.ctx.blockConcurrencyWhile(() =>
        reserveDailyAiCall(this.ctx.storage, Date.now(), dailyAiLimit(this.env))
      );
      return Response.json(receipt, {
        status: receipt.status === "reserved" ? 200 : 429,
        headers: { "cache-control": "no-store" }
      });
    } catch {
      return Response.json({ error: "AI budget unavailable" }, { status: 503 });
    }
  }
}
