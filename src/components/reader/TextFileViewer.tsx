
import { useState, useEffect } from "react";

const TextFileViewer = ({ fileUrl }: { fileUrl: string }) => {
  const [content, setContent] = useState<string | null>(null);
  useEffect(() => {
    fetch(fileUrl)
      .then(r => r.text())
      .then(setContent)
      .catch(() => setContent("(Failed to load text file)"));
  }, [fileUrl]);
  return (
    <pre className="bg-gray-100 text-sm rounded p-4 max-h-[65vh] overflow-auto whitespace-pre-wrap">
      {content ?? "Loading..."}
    </pre>
  );
};

export default TextFileViewer;
