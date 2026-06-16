import { useEffect, useState } from "react";
import { fetchSource } from "../api/client.js";

type SourcePreviewProps = {
  nodeId: string;
  fallback: string;
};

export function SourcePreview({ nodeId, fallback }: SourcePreviewProps) {
  const [source, setSource] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    void fetchSource(nodeId)
      .then((response) => {
        if (!cancelled) {
          setSource(response.sourceText);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSource(fallback);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallback, nodeId]);

  return <pre className="source-preview">{source}</pre>;
}

