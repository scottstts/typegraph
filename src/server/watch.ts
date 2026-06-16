import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { ProjectDiscovery } from "../core/discoverProject.js";
import { indexDiscoveredProject } from "../core/indexProject.js";
import type { TypeGraphPayload } from "../shared/graphTypes.js";

export type ProjectWatcher = {
  close: () => Promise<void>;
};

export type StartProjectWatcherOptions = {
  discovery: ProjectDiscovery;
  onGraph: (graph: TypeGraphPayload) => void;
  onError: (error: Error) => void;
  debounceMs?: number;
};

function shouldHandleFile(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");
}

export function startProjectWatcher(
  options: StartProjectWatcherOptions
): ProjectWatcher {
  let timer: NodeJS.Timeout | undefined;

  const watcher: FSWatcher = chokidar.watch(options.discovery.projectRoot, {
    ignoreInitial: true,
    ignored: (filePath) => {
      const normalized = filePath.split(path.sep).join("/");
      return (
        normalized.includes("/node_modules/") ||
        normalized.includes("/dist/") ||
        normalized.includes("/.git/") ||
        normalized.includes("/.tmp/")
      );
    }
  });

  const schedule = (filePath: string): void => {
    if (!shouldHandleFile(filePath)) {
      return;
    }

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      try {
        options.onGraph(indexDiscoveredProject(options.discovery));
      } catch (error: unknown) {
          options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }, options.debounceMs ?? 500);
  };

  watcher.on("add", schedule);
  watcher.on("change", schedule);
  watcher.on("unlink", schedule);

  return {
    close: async () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      await watcher.close();
    }
  };
}
