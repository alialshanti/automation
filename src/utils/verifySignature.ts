import crypto from "crypto";

/**
 * Verifies GitHub's `X-Hub-Signature-256` header against the raw request body.
 * The HMAC must be computed over the exact bytes GitHub sent, before any
 * JSON parsing. Uses a constant-time comparison and never throws.
 */
export function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  try {
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
