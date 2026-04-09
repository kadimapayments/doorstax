import jwt from "jsonwebtoken";

const RENTSPREE_TOKEN_URL = "https://user.rentspree.com/oidc/token";

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

function signAssertion(): string {
  const privateKey = process.env.RENTSPREE_PRIVATE_KEY;
  const clientId = process.env.RENTSPREE_CLIENT_ID;
  const partnerUserId = process.env.RENTSPREE_PARTNER_USER_ID;
  const partnerEmail = process.env.RENTSPREE_PARTNER_EMAIL;

  if (!privateKey || !clientId || !partnerUserId || !partnerEmail) {
    throw new Error("[rentspree] Missing environment variables for JWT assertion");
  }

  // Replace escaped newlines (Vercel env vars store them as \\n)
  const key = privateKey.replace(/\\n/g, "\n");

  const payload = {
    sub: partnerUserId,
    aud: "https://user.rentspree.com",
    email: partnerEmail,
    iss: clientId,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, key, { algorithm: "RS256", expiresIn: 900 });
}

export async function getRentSpreeToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.RENTSPREE_CLIENT_ID;
  const clientSecret = process.env.RENTSPREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("[rentspree] Missing RENTSPREE_CLIENT_ID or RENTSPREE_CLIENT_SECRET");
  }

  const assertion = signAssertion();
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(RENTSPREE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[rentspree] Token exchange failed:", res.status, err);
    throw new Error(
      "RentSpree auth failed: " +
        (err.error_description || err.error || res.status)
    );
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 900) * 1000,
  };
  return cachedToken.token;
}

export function isRentSpreeConfigured(): boolean {
  return !!(
    process.env.RENTSPREE_CLIENT_ID &&
    process.env.RENTSPREE_CLIENT_SECRET &&
    process.env.RENTSPREE_PRIVATE_KEY &&
    process.env.RENTSPREE_PARTNER_USER_ID &&
    process.env.RENTSPREE_PARTNER_EMAIL
  );
}
