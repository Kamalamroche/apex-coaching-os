import { describe, expect, it } from "vitest";
import { b64u, encryptPayload, makeVapidKeys, pushContent, unb64u, vapidAuth } from "./index";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** The browser's side of RFC 8291, written separately to check the server side. */
async function decrypt(body: Uint8Array, ua: CryptoKeyPair, auth: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const uaPublic = new Uint8Array(await subtle.exportKey("raw", ua.publicKey));
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe("web push", () => {
  it("round-trips base64url", () => {
    const b = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(unb64u(b64u(b))).toEqual(b);
    expect(b64u(b)).not.toMatch(/[+/=]/);
  });

  it("encrypts a payload the browser can read", async () => {
    const ua = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const sub = { p256dh: b64u(new Uint8Array(await subtle.exportKey("raw", ua.publicKey))), auth: b64u(auth) };
    const msg = JSON.stringify({ title: "Kamal", body: "Great session today! 💪" });
    const body = await encryptPayload(sub, enc.encode(msg));
    expect(body[16]).toBe(0); expect(body[18]).toBe(16); // record size 4096
    expect(body[20]).toBe(65);
    expect(await decrypt(body, ua, auth)).toBe(msg);
  });

  it("signs a VAPID token for the push service's origin", async () => {
    const keys = await makeVapidKeys();
    expect(unb64u(keys.publicKey)).toHaveLength(65);
    const h = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", keys, "https://example.com", Date.UTC(2026, 10, 9));
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h)!;
    expect(m[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2]!)));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp).toBe(Date.UTC(2026, 10, 9) / 1000 + 12 * 3600);
    const pub = unb64u(keys.publicKey);
    const verifyKey = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)) }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    expect(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, unb64u(m[3]!), enc.encode(`${m[1]}.${m[2]}`))).toBe(true);
  });

  it("writes a short notification from new messages", () => {
    expect(pushContent({ role: "client", senders: ["Kamal"], unread: 1, latest: "Nice work today", appUrl: "https://apex.app/" }))
      .toEqual({ title: "Kamal", body: "Nice work today", url: "https://apex.app/client/?open=chat", tag: "apex-messages" });
    const many = pushContent({ role: "coach", senders: ["Priya", "Tom"], unread: 3, latest: "x".repeat(300), appUrl: "https://apex.app" });
    expect(many.title).toBe("2 people messaged you");
    expect(many.body.endsWith("… (+2 more)")).toBe(true);
    expect(many.url).toBe("https://apex.app/coach/?open=chat");
  });
});
