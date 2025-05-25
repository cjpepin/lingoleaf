
import { Button } from "@/components/ui/button";

type Props = {
  x: number;
  y: number;
  selectedText: string;
  onHighlight: () => void;
  onClose: () => void;
};

const HighlightPopup = ({ x, y, selectedText, onHighlight, onClose }: Props) => {
  return (
    <div
      className="absolute z-50 bg-white border border-gray-300 rounded shadow-lg flex gap-2 px-3 py-2 animate-fade-in"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)"
      }}
      onMouseDown={e => e.preventDefault()} // prevent blur
    >
      <span className="text-xs px-1 text-gray-600 max-w-[200px] truncate">
        {selectedText.length > 28 ? selectedText.slice(0, 28) + "…" : selectedText}
      </span>
      <Button size="sm" variant="outline" onClick={onHighlight}>
        Highlight
      </Button>
      {/* Stubs for next features */}
      <Button size="sm" variant="ghost" disabled>
        Translate
      </Button>
      <Button size="sm" variant="ghost" disabled>
        Save to Vocab
      </Button>
      <Button size="sm" variant="outline" onClick={onClose}>
        ×
      </Button>
    </div>
  );
};

export default HighlightPopup;
