import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { translateText } from "@/utils/translate";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import HighlightPopup from "./HighlightPopup";

type Props = {
  fileUrl: string;
  title?: string;
};

const EpubReader = ({ fileUrl, title }: Props) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  const { bookId } = useParams<{ bookId: string }>();
  const { save, saving, savingDone } = useSaveVocabWord();

  const [popup, setPopup] = useState({
    show: false,
    x: 0,
    y: 0,
    selectedText: "",
    rect: null as DOMRect | null,
  });

  const [translation, setTranslation] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEpub = async () => {
      try {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();

        const epubjs = await import("epubjs");
        const book = epubjs.default(buffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current!, {
          width: "50vw",
          height: "calc(100vh - 120px)",
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        rendition.display();
      } catch (err: any) {
        setError("Failed to load EPUB: " + (err.message || err));
      }
    };

    loadEpub();

    return () => {
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
    };
  }, [fileUrl]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
        setTranslation(null);
        return;
      }

      const selectedText = selection.toString();
      if (!selectedText || selectedText.length > 120) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top - rect.height / 2;

      setPopup({
        show: true,
        x,
        y,
        selectedText,
        rect,
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleTranslate = async (text: string) => {
    const result = await translateText(text);
    setTranslation(result);
  };

  const handleSaveVocab = async () => {
    if (!bookId || !popup.selectedText || !translation) return;
    await save({
      word: popup.selectedText,
      translation,
      bookId,
      pageNumber: 1, // You could improve this by tracking EPUB location
    });
  };

  return (
    <div className="h-screen flex flex-col items-center justify-between overflow-hidden relative">
      <div
        ref={viewerRef}
        className="border shadow bg-white rounded p-2  h-full mx-auto overflow-hidden"
      />
      {popup.show && popup.selectedText && (
        <HighlightPopup
          x={popup.x}
          y={popup.y}
          selectedText={popup.selectedText}
          onHighlight={() => {
            setHighlights((hls) => [
              ...hls,
              {
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
      {error && <div className="text-red-600 absolute top-4">{error}</div>}
    </div>
  );
};

export default EpubReader;