import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export async function registerBuiltStaticRoutes(
  app: FastifyInstance,
  webRoot: string
): Promise<void> {
  await app.register(fastifyStatic, {
    root: webRoot,
    prefix: "/"
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      await reply.code(404).send({ error: "Not found" });
      return;
    }

    await reply.sendFile("index.html", path.resolve(webRoot));
  });
}

