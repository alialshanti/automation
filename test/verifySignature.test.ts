import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySignature } from "../src/utils/verifySignature";

const secret = "s3cr3t";
const body = Buffer.from(JSON.stringify({ hello: "world" }));

function sign(buf: Buffer, key: string): string {
  return "sha256=" + crypto.createHmac("sha256", key).update(buf).digest("hex");
}

test("accepts a correct signature", () => {
  assert.equal(verifySignature(body, sign(body, secret), secret), true);
});

test("rejects a signature made with the wrong secret", () => {
  assert.equal(verifySignature(body, sign(body, "nope"), secret), false);
});

test("rejects a tampered body", () => {
  const tampered = Buffer.from(JSON.stringify({ hello: "mars" }));
  assert.equal(verifySignature(tampered, sign(body, secret), secret), false);
});

test("rejects a missing header", () => {
  assert.equal(verifySignature(body, undefined, secret), false);
});

test("rejects garbage without throwing", () => {
  assert.equal(verifySignature(body, "sha256=xyz", secret), false);
  assert.equal(verifySignature(body, "not-a-signature", secret), false);
});
