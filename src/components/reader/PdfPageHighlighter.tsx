
import { useRef, useState } from "react";
import HighlightPopup from "./HighlightPopup";

// Highlight type definition
type Highlight = {
  page: number;
  text: string;
  rect: DOMRect;
};

type PdfPageHighlighterProps = {
  pageNumber: number;
};

const PdfPageHighlighter = ({ pageNumber }: PdfPageHighlighterProps) => {
  // Overlay to capture selection/UI
  const overlayRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    rect: DOMRect | null;
  }>({ show: false, x: 0, y: 0, selectedText: "", rect: null });

  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // Selection logic: only operate inside this page
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
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
  };

  const handleHighlight = () => {
    if (!popup.selectedText || !popup.rect) return;
    setHighlights((hls) => [
      ...hls,
      {
        page: pageNumber,
        text: popup.selectedText,
        rect: popup.rect,
      },
    ]);
    setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
    window.getSelection()?.removeAllRanges();
  };

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
            background: "rgba(253, 224, 71, 0.5)",
            pointerEvents: "none",
            borderRadius: 3,
          }}
        />
      ));

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30"
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {/* This overlay will be layered by pdf.js's absolute stacking */}
      <div
        className="absolute inset-0"
        style={{
          cursor: "text",
          background: "transparent",
          userSelect: "text",
          pointerEvents: "auto",
        }}
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

export default PdfPageHighlighter;
