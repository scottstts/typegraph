import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import type {
  HostedWorkerRequest,
  HostedWorkerResponse
} from "../hosted/workerTypes.js";
import { useGraphStore } from "../state/graphStore.js";

const exampleUrl = "https://github.com/microsoft/TypeScript";
const sourceUrl = "https://github.com/scottstts/typegraph";
const installCommand = "npm i -g @scottstts/typegraph";
type CopyStatus = "idle" | "copied" | "failed";

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Clipboard API permission fallback.
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("Could not copy the install command.");
    }
  }
}

export function HostedRepositoryEntry() {
  const setGraph = useGraphStore((state) => state.setGraph);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Waiting for repository URL");
  const [error, setError] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const workerRef = useRef<Worker | undefined>(undefined);
  const requestIdRef = useRef(0);
  const copyResetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.body.classList.add("hosted-entry-active");

    return () => {
      document.body.classList.remove("hosted-entry-active");
      workerRef.current?.terminate();
      if (copyResetTimerRef.current !== undefined) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function copyInstallCommand(): Promise<void> {
    try {
      await writeClipboard(installCommand);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (copyResetTimerRef.current !== undefined) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetTimerRef.current = undefined;
    }, 1800);
  }

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

  const statusClassName = ["hosted-entry-status", error ? "error" : "", running ? "running" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="hosted-entry-shell">
      <section className="hosted-entry" aria-labelledby="hosted-entry-title">
        <div className="hosted-entry-copy">
          <div className="hosted-entry-actions">
            <a
              className="hosted-action-tag hosted-source-link"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open TypeGraph source repository on GitHub"
            >
              <i className="fa-brands fa-github" aria-hidden="true" />
              <span>TypeGraph</span>
            </a>
            <div className="hosted-action-tag hosted-install-tag">
              <code>{installCommand}</code>
              <button
                type="button"
                className={copyStatus === "idle" ? undefined : copyStatus}
                aria-label={
                  copyStatus === "copied"
                    ? "Install command copied"
                    : copyStatus === "failed"
                      ? "Could not copy install command"
                      : "Copy install command"
                }
                title={
                  copyStatus === "copied"
                    ? "Copied"
                    : copyStatus === "failed"
                      ? "Copy failed"
                      : "Copy install command"
                }
                onClick={() => void copyInstallCommand()}
              >
                <i
                  className={
                    copyStatus === "copied"
                      ? "fa-solid fa-check"
                      : copyStatus === "failed"
                        ? "fa-solid fa-xmark"
                        : "fa-regular fa-copy"
                  }
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <p className="hosted-entry-kicker">Public GitHub intake</p>
          <h1 id="hosted-entry-title">TypeGraph</h1>
          <p className="hosted-entry-lede">
            Turn a public TypeScript repository into a type graph. Help you understand project-owned types/interfaces/classes.
          </p>
        </div>

        <form className="hosted-repo-form" onSubmit={startAnalysis}>
          <label className="field hosted-repo-field" htmlFor="hosted-repository-url">
            <span>Repository URL</span>
            <input
              id="hosted-repository-url"
              value={input}
              placeholder={exampleUrl}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={running}
              aria-describedby="hosted-repo-hint"
              onChange={(event) => setInput(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={running || input.trim() === ""}>
            {running ? "Analyzing" : "Analyze"}
          </button>
          <p id="hosted-repo-hint" className="hosted-repo-hint">
            Repo root, branch, subdirectory, and blob URLs are supported.
          </p>
          <p className={statusClassName} aria-live="polite">
            <span aria-hidden="true" />
            {error ?? status}
          </p>
        </form>
      </section>
    </main>
  );
}
