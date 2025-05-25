
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Props = {
  x: number;
  y: number;
  selectedText: string;
  onHighlight: () => void;
  onTranslate?: (result: string) => void;
  translation?: string | null;
  onSaveVocab?: () => void;
  saving?: boolean;
  savingDone?: boolean;
  onClose: () => void;
};

const HighlightPopup = ({
  x, y, selectedText,
  onHighlight, onTranslate, translation,
  onSaveVocab, saving, savingDone,
  onClose
}: Props) => {
  const [translating, setTranslating] = useState(false);

  return (
    <div
      className="absolute z-50 bg-white border border-gray-300 rounded shadow-lg flex gap-2 px-3 py-2 animate-fade-in"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)"
      }}
      onMouseDown={e => e.preventDefault()}
    >
      <span className="text-xs px-1 text-gray-600 max-w-[200px] truncate">
        {selectedText.length > 28 ? selectedText.slice(0, 28) + "…" : selectedText}
      </span>
      <Button size="sm" variant="outline" onClick={onHighlight}>
        Highlight
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setTranslating(true);
          onTranslate && onTranslate(selectedText);
        }}
        disabled={!!translation || translating}
      >
        {translating && !translation ? "Translating..." : "Translate"}
      </Button>
      {translation && (
        <span className="text-xs px-2 italic text-green-600">{translation}</span>
      )}
      <Button 
        size="sm"
        variant="outline"
        onClick={onSaveVocab}
        disabled={!translation || saving || savingDone}
      >
        {saving ? "Saving..." : savingDone ? "Saved!" : "Save to Vocab"}
      </Button>
      <Button size="sm" variant="outline" onClick={onClose}>
        ×
      </Button>
    </div>
  );
};

export default HighlightPopup;
