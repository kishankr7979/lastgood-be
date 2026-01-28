import crypto from "crypto";

export function verifyGitHubSignature({
  payload,
  signature,
  secret,
}: {
  payload: string | Buffer<ArrayBufferLike>;
  signature: string;
  secret: string;
}) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);

  const expected = `sha256=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
