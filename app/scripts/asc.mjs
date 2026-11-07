// App Store Connect API helper: getToken(), apiGet(path), apiPost(path, body).
// The ES256 token is signed with Node's built-in crypto; the key never leaves ~/.secrets and nothing here
// prints or logs key material or the token. No dependency.
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRETS = join(homedir(), ".secrets");
const BASE = "https://api.appstoreconnect.apple.com";

const b64url = (b) => Buffer.from(b).toString("base64url");

export function getToken() {
  const kid = readFileSync(join(SECRETS, "asc-api-key-id"), "utf8").trim();
  const iss = readFileSync(join(SECRETS, "asc-api-issuer-id"), "utf8").trim();
  const key = createPrivateKey(readFileSync(join(SECRETS, "asc-api-key.p8")));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.code}: ${e.detail ?? e.title}`).join("; ") ?? text.slice(0, 200);
    throw new Error(`App Store Connect ${method} ${path.split("?")[0]} failed (${res.status}): ${detail}`);
  }
  return json;
}

export const apiGet = (path) => call("GET", path);
export const apiPost = (path, body) => call("POST", path, body);

// CLI: node scripts/asc.mjs app-exists <bundleId>   -> prints "yes" or "no"
//      node scripts/asc.mjs ensure-bundle-id <bundleId> <name>  -> prints the bundle-ID resource id
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, bundleId, name] = process.argv.slice(2);
  try {
    if (cmd === "app-exists") {
      const r = await apiGet(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`);
      console.log(r.data.length ? "yes" : "no");
    } else if (cmd === "ensure-bundle-id") {
      const q = `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&filter[platform]=IOS`;
      let r = await apiGet(q);
      let hit = r.data.find((b) => b.attributes.identifier === bundleId);
      if (!hit) {
        await apiPost("/v1/bundleIds", { data: { type: "bundleIds", attributes: { identifier: bundleId, name, platform: "IOS" } } });
        r = await apiGet(q);
        hit = r.data.find((b) => b.attributes.identifier === bundleId);
        console.error("registered");
      } else console.error("already registered");
      console.log(`${hit.id} ${hit.attributes.identifier} ${hit.attributes.platform} ${hit.attributes.name}`);
    } else {
      console.error("usage: asc.mjs app-exists <bundleId> | ensure-bundle-id <bundleId> <name>");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e.message));
    process.exit(1);
  }
}
