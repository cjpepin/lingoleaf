
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import PdfPageHighlighter from "./PdfPageHighlighter";
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import { useParams } from "react-router-dom";
import { translateText } from "@/utils/translate";
import HighlightPopup from "./HighlightPopup";

// Set the pdfjs workerSrc to use unpkg CDN (for Vite/react-pdf compatibility)
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfRendererProps = {
  fileUrl: string;
  title?: string;
};

const PdfRenderer = ({ fileUrl, title }: PdfRendererProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    rect: DOMRect | null;
  }>({ show: false, x: 0, y: 0, selectedText: "", rect: null });

  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const { bookId } = useParams<{ bookId: string }>();
  const { save, saving, savingDone } = useSaveVocabWord();
  const [highlights, setHighlights] = useState<any[]>([]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePrev = () => setPageNumber(prev => Math.max(1, prev - 1));
  const handleNext = () => setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev));

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      console.log("Selection:", selection?.toString());
      if (!selection || selection.isCollapsed) {
        setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
        setTranslation(null);
        return;
      }
      const selectedText = selection.toString();
      if (!selectedText || selectedText.length > 1200) return;
  
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
  
      if (!overlayRef.current) return;
      const overlayBox = overlayRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - overlayBox.left;
      const y = rect.top - overlayBox.top - 10;
  
      setPopup({
        show: true,
        x,
        y,
        selectedText,
        rect,
      });
      setTranslation(null);
    };
  
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Visual highlight overlays
  const renderHighlights = () =>
    highlights
      .filter((hl) => hl.page === pageNumber)
      .map((hl, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: hl.rect.left - (overlayRef.current?.getBoundingClientRect().left ?? 0),
            top: hl.rect.top - (overlayRef.current?.getBoundingClientRect().top ?? 0),
            width: hl.rect.width,
            height: hl.rect.height,
            background: "rgba(34, 197, 94, 0.37)", // Green highlight for your theme
            pointerEvents: "none",
            borderRadius: 3,
          }}
        />
      ));

  const handleTranslate = async (text: string) => {
    setTranslating(true);
    const result = await translateText(text);
    setTranslation(result);
    setTranslating(false);
  };

  const handleSaveVocab = async () => {
    if (!bookId || !popup.selectedText || !translation) return;
    await save({
      word: popup.selectedText,
      translation,
      bookId,
      pageNumber,
    });
  };
  

  // For scalability: highlights could be managed here, per file, per user, etc.
  return (
    <div className="w-full h-screen flex flex-col items-center justify-between overflow-hidden">
      <Document
        file={fileUrl}
        onLoadSuccess={handleDocumentLoadSuccess}
        className="w-full flex flex-col items-center justify-center overflow-hidden"
        loading={<div className="my-6">Loading PDF...</div>}
        renderMode="canvas"
      >
        <div className="relative w-full h-full flex items-center justify-center mt-4 overflow-hidden ">
          <Page
            pageNumber={pageNumber}
            height={window.innerHeight - 160} // ~60px reserved for buttons + buffer
            renderTextLayer={true}
            renderAnnotationLayer={false}
            loading={<div>Loading page...</div>}
          >
            <div style={{ position: 'absolute', zIndex: 0, pointerEvents: 'none' }}>
              <PdfPageHighlighter pageNumber={pageNumber} />
            </div>
          </Page>
        </div>
        <div className="h-[60px] flex items-center gap-4 ">
          <button
            className="px-3 py-1 bg-gray-100 rounded border"
            onClick={handlePrev}
            disabled={pageNumber <= 1}
          >
            Previous
          </button>
          <span>
            Page {pageNumber} {numPages ? `of ${numPages}` : ""}
          </span>
          <button
            className="px-3 py-1 bg-gray-100 rounded border"
            onClick={handleNext}
            disabled={!!numPages && pageNumber >= numPages}
          >
            Next
          </button>
        </div>
      </Document>
    </div>
  );
};

export default PdfRenderer;
