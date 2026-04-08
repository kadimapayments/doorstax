"use client";

import DocLayout from "@/components/doc-layout";
import CodeBlock from "@/components/code-block";

export default function AuthenticationPage() {
  return (
    <DocLayout
      title="Authentication"
      description="DoorStax uses session-based JWT authentication powered by NextAuth.js. All API requests require a valid session token."
      breadcrumbs={[
        { label: "Docs", href: "/" },
        { label: "Guides" },
        { label: "Authentication" },
      ]}
    >
      {/* Overview */}
      <h2>Overview</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax authenticates users via <strong className="text-text-primary">NextAuth.js</strong> with
        JWT session tokens. When a user signs in, the server issues a signed JWT
        that is stored as an HTTP-only cookie. This token is automatically
        included in every subsequent request.
      </p>
      <div className="p-4 rounded-lg bg-accent-purple/5 border border-accent-purple/20 mb-6">
        <p className="text-sm text-text-secondary">
          <strong className="text-accent-lavender">API Key authentication</strong> is
          coming soon. This will allow server-to-server integrations without
          browser-based sessions.
        </p>
      </div>

      {/* Obtaining a Session */}
      <h2>Obtaining a Session</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        To obtain a session, send a <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">POST</code> request
        to the sign-in endpoint with valid credentials.
      </p>
      <CodeBlock
        language="bash"
        title="Sign In Request"
        code={`curl -X POST https://doorstax.com/api/auth/signin \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'`}
      />
      <p className="text-text-secondary mb-4 leading-relaxed">
        On success, the response sets an HTTP-only session cookie and returns the
        user profile along with the session token.
      </p>
      <CodeBlock
        language="json"
        title="Session Response"
        code={`{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "PROPERTY_MANAGER"
  },
  "expires": "2025-02-15T00:00:00.000Z"
}`}
      />

      {/* Making Authenticated Requests */}
      <h2>Making Authenticated Requests</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Once authenticated, include the session cookie in all requests. If you
        are working outside a browser environment, pass the session token in the
        Authorization header.
      </p>
      <CodeBlock
        language="bash"
        title="cURL Example"
        code={`curl https://doorstax.com/api/properties \\
  -H "Authorization: Bearer <session-token>" \\
  -H "Content-Type: application/json"`}
      />
      <CodeBlock
        language="javascript"
        title="JavaScript (fetch)"
        code={`const response = await fetch("https://doorstax.com/api/properties", {
  headers: {
    "Authorization": \`Bearer \${sessionToken}\`,
    "Content-Type": "application/json",
  },
});

const properties = await response.json();`}
      />

      {/* Two-Factor Authentication */}
      <h2>Two-Factor Authentication</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        DoorStax supports optional two-factor authentication (2FA) via
        authenticator apps (TOTP). When 2FA is enabled for a user, the sign-in
        flow requires an additional verification step.
      </p>
      <div className="space-y-3 mb-6">
        <div className="flex gap-3 p-3 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm shrink-0">1.</span>
          <span className="text-sm text-text-secondary">User submits email and password</span>
        </div>
        <div className="flex gap-3 p-3 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm shrink-0">2.</span>
          <span className="text-sm text-text-secondary">Server returns a <code className="text-accent-lavender bg-bg-hover px-1 py-0.5 rounded text-xs">2fa_required</code> challenge with a temporary token</span>
        </div>
        <div className="flex gap-3 p-3 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm shrink-0">3.</span>
          <span className="text-sm text-text-secondary">Client submits the 6-digit TOTP code with the temporary token</span>
        </div>
        <div className="flex gap-3 p-3 rounded-lg bg-bg-card border border-border">
          <span className="text-accent-purple font-mono text-sm shrink-0">4.</span>
          <span className="text-sm text-text-secondary">On success, the full session is issued</span>
        </div>
      </div>
      <CodeBlock
        language="json"
        title="2FA Challenge Response"
        code={`{
  "status": "2fa_required",
  "tempToken": "tmp_xyz789",
  "message": "Please provide your 2FA code"
}`}
      />
      <CodeBlock
        language="bash"
        title="Submit 2FA Code"
        code={`curl -X POST https://doorstax.com/api/auth/2fa/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "tempToken": "tmp_xyz789",
    "code": "123456"
  }'`}
      />

      {/* Rate Limiting */}
      <h2>Rate Limiting</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        API requests are rate limited to protect the platform. Limits are applied
        per-user and per-IP.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Endpoint</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Limit</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Window</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">POST /auth/signin</td>
              <td className="py-3 px-4 text-text-secondary">5 requests</td>
              <td className="py-3 px-4 text-text-secondary">15 minutes</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">POST /auth/2fa/*</td>
              <td className="py-3 px-4 text-text-secondary">5 requests</td>
              <td className="py-3 px-4 text-text-secondary">15 minutes</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">GET /*</td>
              <td className="py-3 px-4 text-text-secondary">100 requests</td>
              <td className="py-3 px-4 text-text-secondary">1 minute</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">POST/PUT/DELETE /*</td>
              <td className="py-3 px-4 text-text-secondary">30 requests</td>
              <td className="py-3 px-4 text-text-secondary">1 minute</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Rate limit headers are included in every response:
      </p>
      <CodeBlock
        language="http"
        title="Rate Limit Headers"
        code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1708012800`}
      />

      {/* Error Responses */}
      <h2>Error Responses</h2>
      <p className="text-text-secondary mb-4 leading-relaxed">
        Authentication errors follow a consistent format:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Status</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Code</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">401</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">UNAUTHORIZED</td>
              <td className="py-3 px-4 text-text-secondary">Missing or invalid session token</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">403</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">FORBIDDEN</td>
              <td className="py-3 px-4 text-text-secondary">Valid session but insufficient permissions</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-3 px-4 font-mono text-xs text-accent-amber">429</td>
              <td className="py-3 px-4 font-mono text-xs text-accent-lavender">RATE_LIMITED</td>
              <td className="py-3 px-4 text-text-secondary">Too many requests — retry after the reset window</td>
            </tr>
          </tbody>
        </table>
      </div>
      <CodeBlock
        language="json"
        title="Error Response Body"
        code={`{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Session token is missing or expired.",
    "status": 401
  }
}`}
      />
    </DocLayout>
  );
}
