/**
 * OpenAPI Spec Validation Script
 *
 * Scans all API routes in src/app/api/ and compares them against
 * the OpenAPI spec in developer-portal/public/openapi.json.
 *
 * Reports:
 * - Routes in code but missing from the spec
 * - Routes in the spec but missing from code
 *
 * Usage: npx tsx scripts/validate-openapi.ts
 */

import * as fs from "fs";
import * as path from "path";

const APP_ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(APP_ROOT, "src/app/api");
const OPENAPI_PATH = path.resolve(
  APP_ROOT,
  "../developer-portal/public/openapi.json"
);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// ─── Scan route files ────────────────────────────────────────

interface RouteInfo {
  path: string;
  methods: string[];
  file: string;
}

function scanApiRoutes(dir: string, prefix = "/api"): RouteInfo[] {
  const routes: RouteInfo[] = [];

  if (!fs.existsSync(dir)) {
    console.error(`API directory not found: ${dir}`);
    return routes;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Convert Next.js dynamic segments: [id] → {id}
      const segment = entry.name.replace(/\[(\w+)\]/g, "{$1}");
      routes.push(...scanApiRoutes(fullPath, `${prefix}/${segment}`));
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      // Read the file and find exported HTTP method handlers
      const content = fs.readFileSync(fullPath, "utf-8");
      const methods: string[] = [];

      for (const method of HTTP_METHODS) {
        // Match: export async function GET, export function POST, etc.
        const pattern = new RegExp(
          `export\\s+(async\\s+)?function\\s+${method}\\b`
        );
        if (pattern.test(content)) {
          methods.push(method.toLowerCase());
        }
      }

      if (methods.length > 0) {
        routes.push({
          path: prefix,
          methods,
          file: path.relative(APP_ROOT, fullPath),
        });
      }
    }
  }

  return routes;
}

// ─── Parse OpenAPI spec ──────────────────────────────────────

interface SpecRoute {
  path: string;
  methods: string[];
}

function parseOpenApiSpec(specPath: string): SpecRoute[] {
  if (!fs.existsSync(specPath)) {
    console.error(`OpenAPI spec not found: ${specPath}`);
    return [];
  }

  const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  const routes: SpecRoute[] = [];

  if (spec.paths) {
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      const methods: string[] = [];
      for (const method of HTTP_METHODS) {
        if ((pathItem as Record<string, unknown>)[method.toLowerCase()]) {
          methods.push(method.toLowerCase());
        }
      }
      if (methods.length > 0) {
        routes.push({ path: pathKey, methods });
      }
    }
  }

  return routes;
}

// ─── Compare ─────────────────────────────────────────────────

function main() {
  console.log("🔍 Scanning API routes...\n");

  const codeRoutes = scanApiRoutes(API_DIR);
  const specRoutes = parseOpenApiSpec(OPENAPI_PATH);

  // Build sets for comparison
  const codeEndpoints = new Set<string>();
  for (const route of codeRoutes) {
    for (const method of route.methods) {
      codeEndpoints.add(`${method.toUpperCase()} ${route.path}`);
    }
  }

  const specEndpoints = new Set<string>();
  for (const route of specRoutes) {
    for (const method of route.methods) {
      specEndpoints.add(`${method.toUpperCase()} ${route.path}`);
    }
  }

  // Routes in code but missing from spec
  const missingFromSpec: string[] = [];
  for (const endpoint of codeEndpoints) {
    if (!specEndpoints.has(endpoint)) {
      missingFromSpec.push(endpoint);
    }
  }

  // Routes in spec but missing from code
  const missingFromCode: string[] = [];
  for (const endpoint of specEndpoints) {
    if (!codeEndpoints.has(endpoint)) {
      missingFromCode.push(endpoint);
    }
  }

  // ─── Report ────────────────────────────────────────────────
  console.log(`📁 Code routes found: ${codeEndpoints.size}`);
  console.log(`📄 Spec routes found: ${specEndpoints.size}`);
  console.log("");

  if (missingFromSpec.length > 0) {
    console.log(
      `⚠️  ${missingFromSpec.length} route(s) in CODE but MISSING from OpenAPI spec:`
    );
    // Exclude internal routes (cron, webhooks, auth callbacks)
    const internal = missingFromSpec.filter(
      (r) =>
        r.includes("/cron/") ||
        r.includes("/webhooks/") ||
        r.includes("/auth/")
    );
    const publicMissing = missingFromSpec.filter(
      (r) =>
        !r.includes("/cron/") &&
        !r.includes("/webhooks/") &&
        !r.includes("/auth/")
    );

    if (publicMissing.length > 0) {
      console.log("  Public/API routes:");
      for (const r of publicMissing.sort()) {
        console.log(`    ❌ ${r}`);
      }
    }
    if (internal.length > 0) {
      console.log(`  Internal routes (${internal.length} — typically not in spec):`);
      for (const r of internal.sort()) {
        console.log(`    ℹ️  ${r}`);
      }
    }
  } else {
    console.log("✅ All code routes are documented in the OpenAPI spec.");
  }

  console.log("");

  if (missingFromCode.length > 0) {
    console.log(
      `⚠️  ${missingFromCode.length} route(s) in SPEC but MISSING from code:`
    );
    for (const r of missingFromCode.sort()) {
      console.log(`    🗑️  ${r}`);
    }
  } else {
    console.log("✅ All spec routes have corresponding code implementations.");
  }

  console.log("");

  // Exit with non-zero if there are public routes missing from spec
  const publicMissing = missingFromSpec.filter(
    (r) =>
      !r.includes("/cron/") &&
      !r.includes("/webhooks/") &&
      !r.includes("/auth/")
  );
  if (publicMissing.length > 0 || missingFromCode.length > 0) {
    console.log("❗ Spec drift detected. Please update the OpenAPI spec.");
    process.exit(1);
  } else {
    console.log("✅ OpenAPI spec is in sync with code (excluding internal routes).");
  }
}

main();
