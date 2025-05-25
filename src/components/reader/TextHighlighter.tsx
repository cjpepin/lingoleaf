import { useRef, useState } from "react";
import HighlightPopup from "./HighlightPopup";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import { translateText } from "@/utils/translate";
import { useParams } from "react-router-dom";

type Highlight = {
  start: number;
  end: number;
  text: string;
};

type Props = {
  content: string;
};

const TextHighlighter = ({ content }: Props) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [popup, setPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    range: [number, number] | null;
  }>({ show: false, x: 0, y: 0, selectedText: "", range: null });

  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const { bookId } = useParams<{ bookId: string }>();
  const { save, saving, savingDone } = useSaveVocabWord();

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopup({ show: false, x: 0, y: 0, selectedText: "", range: null });
      setTranslation(null);
      return;
    }
    const selectedText = selection.toString();
    if (!selectedText || selectedText.length > 1200) return;
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return;
    let anchorOffset = selection.anchorOffset;
    let focusOffset = selection.focusOffset;
    if (anchorNode !== focusNode) return;
    let offset = 0;
    const walker = document.createTreeWalker(
      textRef.current!,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node = walker.nextNode();
    while (node && node !== anchorNode) {
      offset += (node.textContent?.length ?? 0);
      node = walker.nextNode();
    }
    if (!node) return;
    const start = Math.min(anchorOffset, focusOffset) + offset;
    const end = Math.max(anchorOffset, focusOffset) + offset;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + window.scrollY - 10;
    setPopup({
      show: true,
      x,
      y,
      selectedText,
      range: [start, end],
    });
    setTranslation(null);
  };

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
    });
  };

  const renderContent = () => {
    if (!highlights.length) return <span>{content}</span>;

    // Sort highlights to render them in order
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    let cursor = 0;
    const nodes = [];
    for (let i = 0; i < sorted.length; ++i) {
      const h = sorted[i];
      if (cursor < h.start) {
        nodes.push(<span key={cursor + "plain"}>{content.slice(cursor, h.start)}</span>);
      }
      nodes.push(
        <span
          key={h.start + "hl"}
          className="bg-yellow-200 rounded px-0.5 transition hover:bg-yellow-300 cursor-pointer"
        >
          {content.slice(h.start, h.end)}
        </span>
      );
      cursor = h.end;
    }
    if (cursor < content.length) {
      nodes.push(<span key={cursor + "final"}>{content.slice(cursor)}</span>);
    }
    return nodes;
  };

  return (
    <div
      className="relative select-text"
      ref={textRef}
      onMouseUp={handleMouseUp}
      style={{ minHeight: 140, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {renderContent()}
      {popup.show && popup.selectedText && (
        <HighlightPopup
          x={popup.x}
          y={popup.y}
          selectedText={popup.selectedText}
          onHighlight={() => {
            if (!popup.range) return;
            setHighlights((cur) => [
              ...cur,
              {
                start: popup.range[0],
                end: popup.range[1],
                text: popup.selectedText,
              },
            ]);
            setPopup({ show: false, x: 0, y: 0, selectedText: "", range: null });
            setTranslation(null);
            window.getSelection()?.removeAllRanges();
          }}
          onTranslate={handleTranslate}
          translation={translation}
          onSaveVocab={handleSaveVocab}
          saving={saving}
          savingDone={savingDone}
          onClose={() => {
            setPopup({ show: false, x: 0, y: 0, selectedText: "", range: null });
            setTranslation(null);
          }}
        />
      )}
    </div>
  );
};

export default TextHighlighter;
