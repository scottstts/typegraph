import type {
  GraphResponse,
  ProjectResponse,
  ScopeRequest,
  ScopeResponse,
  SourceResponse
} from "../../shared/apiTypes.js";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as TResponse;
}

export async function fetchProject(): Promise<ProjectResponse> {
  return getJson<ProjectResponse>("/api/project");
}

export async function fetchGraph(): Promise<GraphResponse> {
  return getJson<GraphResponse>("/api/graph");
}

export async function updateScope(scopePath: string | undefined): Promise<ScopeResponse> {
  const body: ScopeRequest =
    scopePath === undefined ? {} : { scopePath };
  return postJson<ScopeResponse>("/api/scope", body);
}

export async function fetchSource(nodeId: string): Promise<SourceResponse> {
  return getJson<SourceResponse>(`/api/source?nodeId=${encodeURIComponent(nodeId)}`);
}
