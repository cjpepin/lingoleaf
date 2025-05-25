
import { useRef, useState } from "react";
import HighlightPopup from "./HighlightPopup";

type Highlight = {
  page: number;
  text: string;
  rect: DOMRect;
};

type Props = {
  fileUrl: string;
  pageNum: number;
  totalPages?: number;
  // Optionally extend for navigation, for multi-page/highlight future
};

const PdfHighlighter = ({ fileUrl, pageNum }: Props) => {
  // We'll overlay this over the iframe
  const overlayRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    rect: DOMRect | null;
  }>({ show: false, x: 0, y: 0, selectedText: "", rect: null });

  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Note: Selection on browser-native PDF is possible but browser support varies.
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
      return;
    }
    const selectedText = selection.toString();
    if (!selectedText || selectedText.length > 1200) return;

    // Try to locate the anchor rect relative to the PDF overlay.
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // We'll position the popup in the overlay coordinates
    if (!overlayRef.current) return;
    const overlayBox = overlayRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - overlayBox.left;
    const y = rect.top - overlayBox.top - 10;
    setPopup({
      show: true,
      x,
      y,
      selectedText,
      rect
    });
  };

  // For now, just highlight and forget (stub)
  const handleHighlight = () => {
    if (!popup.selectedText || !popup.rect) return;
    setHighlights((hls) => [
      ...hls,
      {
        page: pageNum,
        text: popup.selectedText,
        rect: popup.rect
      },
    ]);
    setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
    window.getSelection()?.removeAllRanges();
  };

  // Visual highlight boxes (overlay over the selection location, not actual text since we can't edit the PDF DOM)
  const renderHighlights = () =>
    highlights
      .filter((hl) => hl.page === pageNum)
      .map((hl, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: hl.rect.left - overlayRef.current!.getBoundingClientRect().left,
            top: hl.rect.top - overlayRef.current!.getBoundingClientRect().top,
            width: hl.rect.width,
            height: hl.rect.height,
            background: "rgba(253, 224, 71, 0.5)", // yellow
            pointerEvents: "none",
            borderRadius: 3,
          }}
        />
      ));
  // Note: This will not persist across rerenders but demonstrates UX.

  return (
    <div className="relative w-full" style={{ minHeight: "70vh" }}>
      <iframe
        src={fileUrl}
        title="PDF"
        className="w-full min-h-[70vh] bg-white border"
        style={{ pointerEvents: "auto" }}
      />

      {/* Overlay to capture selection events */}
      <div
        className="absolute inset-0 z-30"
        ref={overlayRef}
        style={{ cursor: "text", background: "transparent", userSelect: "text" }}
        onMouseUp={handleMouseUp}
      >
        {renderHighlights()}
        {popup.show && popup.selectedText && (
          <HighlightPopup
            x={popup.x}
            y={popup.y}
            selectedText={popup.selectedText}
            onHighlight={handleHighlight}
            onClose={() => setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null })}
          />
        )}
      </div>
    </div>
  );
};

export default PdfHighlighter;
