import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import type {
  HostedWorkerRequest,
  HostedWorkerResponse
} from "../hosted/workerTypes.js";
import { useGraphStore } from "../state/graphStore.js";

const exampleUrl = "https://github.com/microsoft/TypeScript";

export function HostedRepositoryEntry() {
  const setGraph = useGraphStore((state) => state.setGraph);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Waiting for repository URL");
  const [error, setError] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  function startAnalysis(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    workerRef.current?.terminate();

    const worker = new Worker(new URL("../hosted/indexWorker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;
    setRunning(true);
    setError(undefined);
    setStatus("Starting analysis");

    worker.addEventListener("message", (messageEvent: MessageEvent<HostedWorkerResponse>) => {
      const message = messageEvent.data;
      if (message.requestId !== requestId) {
        return;
      }

      if (message.type === "progress") {
        setStatus(message.message);
        return;
      }

      worker.terminate();
      workerRef.current = undefined;
      setRunning(false);

      if (message.type === "success") {
        setGraph(message.graph);
        return;
      }

      setError(message.message);
      setStatus("Analysis failed");
    });

    const request: HostedWorkerRequest = {
      type: "analyze-github",
      requestId,
      input
    };
    worker.postMessage(request);
  }

  return (
    <main className="hosted-entry-shell">
      <section className="hosted-entry">
        <div className="hosted-entry-brand">
          <h1>TypeGraph</h1>
          <p>GitHub repository analysis</p>
        </div>

        <form className="hosted-repo-form" onSubmit={startAnalysis}>
          <label className="field">
            <span>Repository</span>
            <input
              value={input}
              placeholder={exampleUrl}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={running}
              onChange={(event) => setInput(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={running || input.trim() === ""}>
            {running ? "Analyzing" : "Analyze"}
          </button>
        </form>

        <p className="hosted-entry-status" aria-live="polite">
          {error ?? status}
        </p>
      </section>
    </main>
  );
}
