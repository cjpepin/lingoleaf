
import React, { useEffect, useRef, useState } from "react";

// You must add epubjs to your project dependencies for this to work.
// You may want to ensure epub.js is installed and available.
const EpubReader = ({ fileUrl, title }: { fileUrl: string; title: string }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let book: any = null;
    let rendition: any = null;

    if (!fileUrl || !viewerRef.current) return;
    import("epubjs").then(EPUB => {
      try {
        book = EPUB.default(fileUrl);
        rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "95vh",
        });
        rendition.display();
      } catch (err: any) {
        setError(err.message || "Failed to load EPUB");
      }
    }).catch(() => setError("Could not load epub.js."));

    return () => {
      if (rendition) { rendition.destroy?.(); }
      if (book) { book.destroy?.(); }
    };
  }, [fileUrl]);

  if (error) return <div className="text-red-600">{error}</div>;
  return (
    <div>
      <div className="font-bold text-lg mb-2">{title}</div>
      <div ref={viewerRef} className="epub-reader border shadow bg-white rounded p-2 max-w-2xl min-h-[400px] mx-auto" />
    </div>
  );
};

export default EpubReader;
