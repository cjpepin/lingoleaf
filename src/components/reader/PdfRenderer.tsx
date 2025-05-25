
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import PdfPageHighlighter from "./PdfPageHighlighter";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";

// IMPORTANT: pdfjs.GlobalWorkerOptions.workerSrc tells pdfjs where to find its worker
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfRendererProps = {
  fileUrl: string;
  title?: string;
};

const PdfRenderer = ({ fileUrl, title }: PdfRendererProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePrev = () => setPageNumber(prev => Math.max(1, prev - 1));
  const handleNext = () => setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev));

  // For scalability: highlights could be managed here, per file, per user, etc.
  return (
    <div className="w-full flex flex-col items-center">
      <Document
        file={fileUrl}
        onLoadSuccess={handleDocumentLoadSuccess}
        className="w-full"
        loading={<div className="my-6">Loading PDF...</div>}
        renderMode="canvas"
      >
        <Page
          pageNumber={pageNumber}
          width={700}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          loading={<div>Loading page...</div>}
        >
          {/* Highlights and popups will be managed at per-page level */}
          <PdfPageHighlighter pageNumber={pageNumber} />
        </Page>
      </Document>
      <div className="flex items-center gap-4 my-4">
        <button className="px-3 py-1 bg-gray-100 rounded border" onClick={handlePrev} disabled={pageNumber <= 1}>
          Previous
        </button>
        <span>
          Page {pageNumber} {numPages ? `of ${numPages}` : ""}
        </span>
        <button className="px-3 py-1 bg-gray-100 rounded border" onClick={handleNext} disabled={!!numPages && pageNumber >= numPages}>
          Next
        </button>
      </div>
    </div>
  );
};

export default PdfRenderer;
