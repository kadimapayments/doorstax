"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string };
  description?: string;
}

interface RequestBody {
  content?: {
    [contentType: string]: {
      schema?: Record<string, unknown>;
    };
  };
}

interface Response {
  description: string;
}

interface Operation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  operationId?: string;
}

interface PathItem {
  [method: string]: Operation;
}

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, PathItem>;
  tags?: { name: string; description?: string }[];
}

interface EndpointInfo {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: Parameter[];
  requestBody: RequestBody | null;
  responses: Record<string, Response>;
}

const METHOD_COLORS: Record<string, string> = {
  get: "bg-accent-green/15 text-accent-green border-accent-green/30",
  post: "bg-accent-blue/15 text-accent-blue border-accent-blue/30",
  put: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  patch: "bg-accent-purple/15 text-accent-purple border-accent-purple/30",
  delete: "bg-accent-red/15 text-accent-red border-accent-red/30",
};

function EndpointCard({ endpoint }: { endpoint: EndpointInfo }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = METHOD_COLORS[endpoint.method] || "bg-bg-hover text-text-muted";

  return (
    <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors text-left"
      >
        <span
          className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase border ${colorClass}`}
        >
          {endpoint.method}
        </span>
        <span className="font-mono text-sm text-text-primary truncate">
          {endpoint.path}
        </span>
        <span className="text-sm text-text-muted ml-auto shrink-0 hidden sm:block max-w-[300px] truncate">
          {endpoint.summary}
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">
          {endpoint.summary && (
            <p className="text-sm text-text-primary font-medium">
              {endpoint.summary}
            </p>
          )}
          {endpoint.description && (
            <p className="text-sm text-text-secondary">{endpoint.description}</p>
          )}

          {/* Parameters */}
          {endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Parameters
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">Name</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">In</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">Type</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">Required</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.parameters.map((param) => (
                      <tr key={`${param.in}-${param.name}`} className="border-b border-border/30">
                        <td className="py-2 px-3 font-mono text-xs text-accent-lavender">
                          {param.name}
                        </td>
                        <td className="py-2 px-3 text-xs text-text-muted">{param.in}</td>
                        <td className="py-2 px-3 font-mono text-xs text-text-secondary">
                          {param.schema?.type || "string"}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {param.required ? (
                            <span className="text-accent-red">required</span>
                          ) : (
                            <span className="text-text-muted">optional</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-text-muted">
                          {param.description || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body */}
          {endpoint.requestBody?.content && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Request Body
              </h4>
              <div className="rounded-lg bg-[#1a1b26] p-3 border border-border">
                <pre className="text-xs text-text-secondary overflow-x-auto">
                  {JSON.stringify(
                    Object.values(endpoint.requestBody.content)[0]?.schema || {},
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}

          {/* Responses */}
          {Object.keys(endpoint.responses).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Responses
              </h4>
              <div className="space-y-1">
                {Object.entries(endpoint.responses).map(([status, resp]) => (
                  <div
                    key={status}
                    className="flex items-center gap-3 text-sm px-3 py-1.5 rounded bg-bg-hover/50"
                  >
                    <span
                      className={`font-mono text-xs font-bold ${
                        status.startsWith("2")
                          ? "text-accent-green"
                          : status.startsWith("4")
                          ? "text-accent-amber"
                          : status.startsWith("5")
                          ? "text-accent-red"
                          : "text-text-muted"
                      }`}
                    >
                      {status}
                    </span>
                    <span className="text-text-muted text-xs">
                      {resp.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function APIReferencePage() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<Record<string, EndpointInfo[]>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/openapi.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load OpenAPI spec (${res.status})`);
        return res.json();
      })
      .then((data: OpenAPISpec) => {
        setSpec(data);

        // Group endpoints by tag
        const groups: Record<string, EndpointInfo[]> = {};
        const httpMethods = ["get", "post", "put", "patch", "delete"];

        for (const [path, pathItem] of Object.entries(data.paths || {})) {
          for (const method of httpMethods) {
            const operation = pathItem[method] as Operation | undefined;
            if (!operation) continue;

            const tags = operation.tags?.length ? operation.tags : ["Other"];
            const info: EndpointInfo = {
              method,
              path,
              summary: operation.summary || "",
              description: operation.description || "",
              tags,
              parameters: operation.parameters || [],
              requestBody: operation.requestBody || null,
              responses: operation.responses || {},
            };

            for (const tag of tags) {
              if (!groups[tag]) groups[tag] = [];
              groups[tag].push(info);
            }
          }
        }

        setGrouped(groups);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const tagDescriptions = spec?.tags
    ? Object.fromEntries(spec.tags.map((t) => [t.name, t.description]))
    : {};

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-3">
          API Reference
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Interactive reference for the DoorStax REST API. Endpoints are grouped
          by resource and loaded from the OpenAPI specification.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-8 rounded-xl bg-bg-card border border-border justify-center">
          <Loader2 className="w-5 h-5 text-accent-purple animate-spin" />
          <span className="text-text-secondary">Loading OpenAPI spec...</span>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-xl bg-bg-card border border-border">
          <p className="text-text-secondary mb-2">
            Could not load the OpenAPI specification.
          </p>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <div className="p-4 rounded-lg bg-accent-amber/5 border border-accent-amber/20">
            <p className="text-sm text-text-secondary">
              <strong className="text-accent-amber">Note:</strong> Place your OpenAPI
              spec at <code className="text-accent-lavender bg-bg-card px-1.5 py-0.5 rounded text-xs">/public/openapi.json</code> to
              populate this page. We will integrate Scalar for a richer experience.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && spec && (
        <div className="space-y-6">
          {/* Spec info */}
          <div className="p-4 rounded-xl bg-bg-card border border-border flex items-center gap-4 flex-wrap">
            <span className="text-sm text-text-primary font-medium">
              {spec.info.title}
            </span>
            <span className="text-xs text-text-muted font-mono bg-bg-hover px-2 py-0.5 rounded">
              v{spec.info.version}
            </span>
            <span className="text-xs text-text-muted">
              {Object.keys(spec.paths).length} paths
            </span>
            <span className="text-xs text-text-muted">
              OpenAPI {spec.openapi}
            </span>
          </div>

          {/* Tag groups */}
          {Object.entries(grouped).map(([tag, endpoints]) => (
            <div key={tag}>
              <button
                onClick={() => toggleGroup(tag)}
                className="flex items-center gap-3 mb-3 w-full text-left"
              >
                {collapsedGroups.has(tag) ? (
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                )}
                <h2 className="text-lg font-semibold text-text-primary">
                  {tag}
                </h2>
                <span className="text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded-full">
                  {endpoints.length}
                </span>
                {tagDescriptions[tag] && (
                  <span className="text-xs text-text-muted hidden md:block">
                    — {tagDescriptions[tag]}
                  </span>
                )}
              </button>
              {!collapsedGroups.has(tag) && (
                <div className="space-y-2 ml-7">
                  {endpoints.map((ep, i) => (
                    <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
