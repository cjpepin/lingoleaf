
import { useRef, useState } from "react";
import HighlightPopup from "./HighlightPopup";

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
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [popup, setPopup] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    range: [number, number] | null;
  }>({ show: false, x: 0, y: 0, selectedText: "", range: null });

  // Handle mouseup for selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopup({ show: false, x: 0, y: 0, selectedText: "", range: null });
      return;
    }
    const selectedText = selection.toString();
    // Only allow short manageable spans
    if (!selectedText || selectedText.length > 1200) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return;

    // Get selection offsets relative to the content string
    let anchorOffset = selection.anchorOffset;
    let focusOffset = selection.focusOffset;

    // To simplify, only handle single-node selections (for now)
    if (anchorNode !== focusNode) return;

    // Compute the real offset in the string
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
    // Order the offsets
    const start = Math.min(anchorOffset, focusOffset) + offset;
    const end = Math.max(anchorOffset, focusOffset) + offset;

    // Find position for popup (middle of selection, crude but works)
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
  };

  const handleHighlight = () => {
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
    window.getSelection()?.removeAllRanges();
  };

  // Render content with highlight spans.
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
          onHighlight={handleHighlight}
          onClose={() => setPopup({ show: false, x: 0, y: 0, selectedText: "", range: null })}
        />
      )}
    </div>
  );
};

export default TextHighlighter;
