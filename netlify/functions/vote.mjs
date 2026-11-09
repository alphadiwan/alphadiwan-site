// One vote per device (random id kept in the browser), capped per network (IP) so one person can't flood a poll.
// Poll id = hash of the week's question, so a new question starts a fresh count.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const NET_CAP = 10; // max votes from one network per poll
const h = s => createHash("sha256").update(s + "|alphadiwan").digest("hex").slice(0, 24);
const clean = (x, n) => String(x || "").replace(/[^a-z0-9]/gi, "").slice(0, n);
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req, context) => {
  const url = new URL(req.url);
  const poll = clean(url.searchParams.get("poll"), 32);
  let dev = clean(url.searchParams.get("d"), 40);
  if (!poll) return json({ error: "poll required" }, 400);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  dev = clean(body.d, 40) || dev;
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "0";

  const store = getStore({ name: "debate", consistency: "strong" });
  const countKey = `${poll}/count`, netKey = `${poll}/net/${h(ip)}`;
  const devKey = dev.length >= 8 ? `${poll}/dev/${h(dev)}` : null;
  const counts = (await store.get(countKey, { type: "json" })) || { a: 0, b: 0 };
  let mine = devKey ? await store.get(devKey) : null;
  let capped = false;

  if (req.method === "POST" && !mine && devKey && (body.v === "a" || body.v === "b")) {
    const used = Number(await store.get(netKey)) || 0;
    if (used >= NET_CAP) capped = true;
    else {
      mine = body.v;
      counts[mine]++;
      await store.set(devKey, mine);
      await store.set(netKey, String(used + 1));
      await store.setJSON(countKey, counts);
    }
  }
  return json({ a: counts.a, b: counts.b, mine: mine || null, capped });
};

export const config = { path: "/api/vote" };
