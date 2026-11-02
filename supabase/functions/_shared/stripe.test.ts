import { describe, expect, it } from "vitest";
import { emailList, formBody, invoiceSubscriptionId, paymentRow, returnOrigin, signPayload, subscriptionRow, verifyStripeSignature } from "./stripe";

describe("formBody", () => {
  it("encodes nested params the way Stripe expects", () => {
    expect(formBody({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], subscription_data: { metadata: { client_id: "a b" } }, skip: undefined }))
      .toBe("mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&subscription_data%5Bmetadata%5D%5Bclient_id%5D=a%20b");
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  it("accepts a fresh, correctly signed payload", async () => {
    const sig = await signPayload(body, secret, 1000);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, secret, 1010)).toBe(true);
    expect(await verifyStripeSignature(body, `t=1000,v1=deadbeef,v1=${sig}`, secret, 1010)).toBe(true);
  });
  it("rejects a changed body, wrong secret, old timestamp or missing header", async () => {
    const sig = await signPayload(body, secret, 1000);
    expect(await verifyStripeSignature(body + " ", `t=1000,v1=${sig}`, secret, 1010)).toBe(false);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, "whsec_other", 1010)).toBe(false);
    expect(await verifyStripeSignature(body, `t=1000,v1=${sig}`, secret, 1000 + 301)).toBe(false);
    expect(await verifyStripeSignature(body, null, secret, 1010)).toBe(false);
    expect(await verifyStripeSignature(body, "garbage", secret, 1010)).toBe(false);
  });
  it("matches Stripe's documented HMAC-SHA256 of t.payload", async () => {
    // Independently computed: printf '1700000000.{}' | openssl dgst -sha256 -hmac whsec_abc
    expect(await signPayload("{}", "whsec_abc", 1700000000)).toBe("bad9ac117e973d721c232d46744158d75e3f1b44e36771e13d01b9e6a580bc72");
  });
});

describe("subscriptionRow", () => {
  const sub = {
    id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false,
    metadata: { client_id: "c1", coach_id: "k1", plan_id: "p1" },
    items: { data: [{ current_period_end: 1764670000, price: { id: "price_1", unit_amount: 15000, recurring: { interval: "month" } } }] },
  };
  it("reads the period end from the item on newer API versions", () => {
    const row = subscriptionRow(sub, 1764000000);
    expect(row).toMatchObject({ stripe_subscription_id: "sub_1", client_id: "c1", coach_id: "k1", plan_id: "p1", status: "active", amount_pence: 15000, billing_interval: "month" });
    expect(row?.current_period_end).toBe(new Date(1764670000 * 1000).toISOString());
  });
  it("reads it from the subscription on older ones, and skips subscriptions APEX didn't create", () => {
    expect(subscriptionRow({ ...sub, current_period_end: 1764999999 }, 1)?.current_period_end).toBe(new Date(1764999999 * 1000).toISOString());
    expect(subscriptionRow({ ...sub, metadata: {} }, 1)).toBeNull();
  });
});

describe("invoices", () => {
  it("finds the subscription in either API shape", () => {
    expect(invoiceSubscriptionId({ id: "in_1", customer: "cus_1", subscription: "sub_old" })).toBe("sub_old");
    expect(invoiceSubscriptionId({ id: "in_1", customer: "cus_1", parent: { subscription_details: { subscription: "sub_new" } } })).toBe("sub_new");
    expect(invoiceSubscriptionId({ id: "in_1", customer: "cus_1" })).toBeNull();
  });
  it("records the amount paid, or the amount due when it failed", () => {
    const inv = { id: "in_1", customer: "cus_1", amount_paid: 15000, amount_due: 15000, currency: "gbp", status_transitions: { paid_at: 1764000000 } };
    expect(paymentRow(inv, { client_id: "c1", coach_id: "k1" }, "paid")).toMatchObject({ amount_pence: 15000, status: "paid", paid_at: new Date(1764000000 * 1000).toISOString() });
    expect(paymentRow({ ...inv, amount_paid: 0 }, { client_id: "c1", coach_id: "k1" }, "failed").amount_pence).toBe(15000);
  });
});

describe("returnOrigin", () => {
  it("only sends people back to APEX", () => {
    expect(returnOrigin("https://apex-coaching-os-web.vercel.app", "https://apex-coaching-os-web.vercel.app/")).toBe("https://apex-coaching-os-web.vercel.app");
    expect(returnOrigin("http://localhost:5173", "https://apex.example")).toBe("http://localhost:5173");
    expect(returnOrigin("https://evil.example", "https://apex.example")).toBe("https://apex.example");
    expect(returnOrigin(null, "https://apex.example")).toBe("https://apex.example");
  });
  it("reads the coach email list", () => {
    expect(emailList(" Kamal@Example.com, ,b@x.io")).toEqual(["kamal@example.com", "b@x.io"]);
  });
});
