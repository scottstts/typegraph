import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import {
  DEFAULT_API_PORT,
  DEFAULT_HOST,
  DEFAULT_WEB_PORT
} from "../shared/constants.js";
import type { GraphUpdatedEvent } from "../shared/apiTypes.js";
import type { ProjectDiscovery } from "../core/discoverProject.js";
import type { TypeGraphPayload } from "../shared/graphTypes.js";
import { registerApiRoutes, type GraphServerState } from "./api.js";
import { registerBuiltStaticRoutes } from "./static.js";
import { startProjectWatcher, type ProjectWatcher } from "./watch.js";

type StartTypeGraphServerOptions = {
  discovery?: ProjectDiscovery;
  initialGraph: TypeGraphPayload;
  watch: boolean;
};

export type TypeGraphServer = {
  app: FastifyInstance;
  url: string;
  apiUrl: string;
  close: () => Promise<void>;
};

type MutableGraphState = GraphServerState & {
  watcher?: ProjectWatcher;
};

function isBuiltRuntime(): boolean {
  return fileURLToPath(import.meta.url).split(path.sep).includes("dist");
}

function createGraphState(initialGraph: TypeGraphPayload): MutableGraphState {
  let graph = initialGraph;
  const subscribers = new Set<(event: GraphUpdatedEvent) => void>();

  return {
    getGraph: () => graph,
    setGraph: (nextGraph) => {
      graph = nextGraph;
      const event: GraphUpdatedEvent = {
        type: "graph-updated",
        indexedAt: graph.indexedAt,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length
      };
      for (const subscriber of subscribers) {
        subscriber(event);
      }
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }
  };
}

async function listenWithFallback(
  app: FastifyInstance,
  preferredPort: number
): Promise<{ port: number; address: string }> {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    try {
      const address = await app.listen({ host: DEFAULT_HOST, port });
      return { port, address };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== "EADDRINUSE") {
        throw error;
      }
    }
  }

  throw new Error(`No available port found from ${preferredPort}`);
}

async function startViteDevServer(apiPort: number): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      host: DEFAULT_HOST,
      port: DEFAULT_WEB_PORT,
      strictPort: false,
      proxy: {
        "/api": {
          target: `http://${DEFAULT_HOST}:${apiPort}`,
          changeOrigin: false,
          ws: true
        }
      }
    }
  });

  await vite.listen();
  const url =
    vite.resolvedUrls?.local[0] ?? `http://${DEFAULT_HOST}:${DEFAULT_WEB_PORT}/`;

  return {
    url,
    close: async () => vite.close()
  };
}

export async function startTypeGraphServer(
  options: StartTypeGraphServerOptions
): Promise<TypeGraphServer> {
  const app = Fastify({ logger: false });
  const state = createGraphState(options.initialGraph);
  registerApiRoutes(app, state);

  const built = isBuiltRuntime();
  if (built) {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const webRoot = path.resolve(currentDirectory, "..", "web");
    await registerBuiltStaticRoutes(app, webRoot);
  }

  const { port, address } = await listenWithFallback(app, DEFAULT_API_PORT);
  let url = address.endsWith("/") ? address : `${address}/`;
  let viteServer: Awaited<ReturnType<typeof startViteDevServer>> | undefined;

  if (!built) {
    viteServer = await startViteDevServer(port);
    url = viteServer.url;
  }

  if (options.watch && options.discovery !== undefined) {
    state.watcher = startProjectWatcher({
      discovery: options.discovery,
      onGraph: state.setGraph,
      onError: (error) => {
        app.log.error(error, "Failed to re-index TypeGraph project");
      }
    });
  }

  return {
    app,
    url,
    apiUrl: `http://${DEFAULT_HOST}:${port}/`,
    close: async () => {
      await state.watcher?.close();
      await viteServer?.close();
      await app.close();
    }
  };
}
