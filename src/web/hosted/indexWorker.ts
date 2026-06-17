import { analyzeGitHubRepository } from "../../core/githubRepository.js";
import type {
  HostedWorkerRequest,
  HostedWorkerResponse
} from "./workerTypes.js";

function postMessageToClient(message: HostedWorkerResponse): void {
  globalThis.postMessage(message);
}

globalThis.addEventListener("message", (event: MessageEvent<HostedWorkerRequest>) => {
  const request = event.data;
  void analyzeGitHubRepository({
    input: request.input,
    onProgress: (progress) =>
      postMessageToClient({
        type: "progress",
        requestId: request.requestId,
        message: progress.message
      })
  })
    .then((graph) =>
      postMessageToClient({
        type: "success",
        requestId: request.requestId,
        graph
      })
    )
    .catch((error: unknown) =>
      postMessageToClient({
        type: "failure",
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error)
      })
    );
});
