
import { useState, useEffect } from "react";
import TextHighlighter from "./TextHighlighter";

const TextFileViewer = ({ fileUrl }: { fileUrl: string }) => {
  const [content, setContent] = useState<string | null>(null);
  useEffect(() => {
    fetch(fileUrl)
      .then(r => r.text())
      .then(setContent)
      .catch(() => setContent("(Failed to load text file)"));
  }, [fileUrl]);
  if (content === null) {
    return (
      <pre className="bg-gray-100 text-sm rounded p-4 max-h-[65vh] overflow-auto whitespace-pre-wrap">
        Loading...
      </pre>
    );
  }
  if (content === "(Failed to load text file)") {
    return (
      <pre className="bg-gray-100 text-sm rounded p-4 max-h-[65vh] overflow-auto whitespace-pre-wrap">
        (Failed to load text file)
      </pre>
    );
  }
  return (
    <div className="bg-gray-100 text-sm rounded p-4 max-h-[65vh] overflow-auto whitespace-pre-wrap">
      <TextHighlighter content={content} />
    </div>
  );
};

export default TextFileViewer;
