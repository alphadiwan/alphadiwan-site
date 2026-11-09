// One vote per IP per poll. Poll id = hash of the week's question, so a new question starts a fresh count.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const h = s => createHash("sha256").update(s).digest("hex").slice(0, 24);
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req, context) => {
  const url = new URL(req.url);
  const poll = (url.searchParams.get("poll") || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  if (!poll) return json({ error: "poll required" }, 400);
  const store = getStore({ name: "debate", consistency: "strong" });
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "0";
  const who = `${poll}/ip/${h(ip + "|alphadiwan")}`;
  const countKey = `${poll}/count`;
  const counts = (await store.get(countKey, { type: "json" })) || { a: 0, b: 0 };
  let mine = await store.get(who);

  if (req.method === "POST") {
    const { v } = await req.json().catch(() => ({}));
    if (!mine && (v === "a" || v === "b")) {
      mine = v;
      counts[v]++;
      await store.set(who, v);
      await store.setJSON(countKey, counts);
    }
  }
  return json({ a: counts.a, b: counts.b, mine: mine || null });
};

export const config = { path: "/api/vote" };
