import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { GRAPH_UPDATE_EVENT } from "../shared/constants.js";
import type {
  GraphUpdatedEvent,
  NeighborhoodDirection,
  ScopeRequest
} from "../shared/apiTypes.js";
import {
  getNeighborhood,
  getNode,
  searchNodes
} from "../core/graphQueries.js";
import { withScope } from "../core/scope.js";
import type { TypeGraphPayload } from "../shared/graphTypes.js";

export type GraphServerState = {
  getGraph: () => TypeGraphPayload;
  setGraph: (graph: TypeGraphPayload) => void;
  subscribe: (subscriber: (event: GraphUpdatedEvent) => void) => () => void;
};

type NodeParams = {
  id: string;
};

type SearchQuery = {
  q?: string;
};

type NeighborhoodQuery = {
  nodeId?: string;
  depth?: string;
  direction?: NeighborhoodDirection;
};

type SourceQuery = {
  nodeId?: string;
};

function parseDepth(depth: string | undefined): number {
  if (depth === undefined) {
    return 1;
  }

  const parsed = Number.parseInt(depth, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 1;
  }

  return Math.min(parsed, 5);
}

function parseDirection(direction: string | undefined): NeighborhoodDirection {
  if (
    direction === "dependencies" ||
    direction === "dependents" ||
    direction === "both"
  ) {
    return direction;
  }

  return "both";
}

function projectInfo(graph: TypeGraphPayload) {
  return {
    projectRoot: graph.projectRoot,
    tsconfigPath: graph.tsconfigPath,
    ...(graph.scopePath === undefined ? {} : { scopePath: graph.scopePath }),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    indexedAt: graph.indexedAt
  };
}

function sendSseEvent(reply: FastifyReply, event: GraphUpdatedEvent): void {
  reply.raw.write(`event: ${GRAPH_UPDATE_EVENT}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function registerApiRoutes(
  app: FastifyInstance,
  state: GraphServerState
): void {
  app.get("/api/project", () => projectInfo(state.getGraph()));

  app.get("/api/graph", () => state.getGraph());

  app.get<{ Params: NodeParams }>("/api/node/:id", (request, reply) => {
    const node = getNode(state.getGraph(), request.params.id);
    if (node === undefined) {
      return reply.code(404).send({ error: `Unknown node: ${request.params.id}` });
    }

    return { node };
  });

  app.get<{ Querystring: SearchQuery }>("/api/search", (request) => ({
    results: searchNodes(state.getGraph(), request.query.q ?? "")
  }));

  app.get<{ Querystring: NeighborhoodQuery }>(
    "/api/neighborhood",
    (request, reply) => {
      const { nodeId } = request.query;
      if (nodeId === undefined) {
        return reply.code(400).send({ error: "Missing nodeId" });
      }

      const direction = parseDirection(request.query.direction);
      const depth = parseDepth(request.query.depth);
      const graph = getNeighborhood(state.getGraph(), nodeId, depth, direction);
      return {
        centerNodeId: nodeId,
        depth,
        direction,
        graph
      };
    }
  );

  app.post<{ Body: ScopeRequest }>("/api/scope", (request) => {
    const graph = withScope(state.getGraph(), request.body.scopePath);
    state.setGraph(graph);
    return { graph };
  });

  app.get<{ Querystring: SourceQuery }>("/api/source", (request, reply) => {
    const { nodeId } = request.query;
    if (nodeId === undefined) {
      return reply.code(400).send({ error: "Missing nodeId" });
    }

    const node = getNode(state.getGraph(), nodeId);
    if (node === undefined) {
      return reply.code(404).send({ error: `Unknown node: ${nodeId}` });
    }

    return {
      nodeId,
      sourceText: node.sourceText ?? node.displayText
    };
  });

  app.get("/api/events", (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write("\n");

    const unsubscribe = state.subscribe((event) => sendSseEvent(reply, event));
    request.raw.on("close", unsubscribe);
  });
}
