
import { useState, useRef } from "react";
import HighlightPopup from "./HighlightPopup";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import { translateText } from "@/utils/translate";
import { useParams } from "react-router-dom";

type PdfPageHighlighterProps = {
  pageNumber: number;
};

const PdfPageHighlighter = ({ pageNumber }: PdfPageHighlighterProps) => {
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

  // Selection logic: only operate inside this page
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
            background: "rgba(34, 197, 94, 0.37)", // Green (using #22c55e from Tailwind, 0.37 opacity)
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
            onHighlight={() => {
              setHighlights((hls) => [
                ...hls,
                {
                  page: pageNumber,
                  text: popup.selectedText,
                  rect: popup.rect,
                },
              ]);
              setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
              setTranslation(null);
              window.getSelection()?.removeAllRanges();
            }}
            onTranslate={handleTranslate}
            translation={translation}
            onSaveVocab={handleSaveVocab}
            saving={saving}
            savingDone={savingDone}
            onClose={() => {
              setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
              setTranslation(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PdfPageHighlighter;
