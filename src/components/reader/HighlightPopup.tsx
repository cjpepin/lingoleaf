
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAllVocabFolders } from "@/hooks/useVocabFolders";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Props = {
  x: number;
  y: number;
  selectedText: string;
  onHighlight: () => void;
  onTranslate?: (result: string) => void;
  translation?: string | null;
  onSaveVocab: (opts?: {folderId?: string | null}) => void;
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
  const [translationState, setTranslationState] = useState("Translate");
  const { data: folders } = useAllVocabFolders();
  const [folder, setFolder] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (onTranslate) {
      await onTranslate(selectedText);
      setTranslationState("Translated");
    }
  };

  const handleSave = () => {
    if (!translation) return;
    onSaveVocab({ folderId: folder || null });
  };

  // Only allow saving if there is a translation, not currently saving, and not done.
  const canSave = !!translation && !saving && !savingDone;

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
          setTranslationState("Translating...");
          handleTranslate();
        }}
        disabled={translationState !== "Translate" || !selectedText}
      >
        {translationState}
      </Button>
      {translation && (
        <span className="text-xs px-2 italic text-green-600">{translation}</span>
      )}
      {/* Folder dropdown */}
      <Select onValueChange={setFolder} value={folder ?? undefined}>
        <SelectTrigger className="w-24 h-7 min-w-[70px]" aria-label="Vocabulary folder">
          <SelectValue placeholder="No folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No folder</SelectItem>
          {folders?.map((f: any) => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button 
        size="sm"
        variant="outline"
        onClick={handleSave}
        disabled={!canSave}
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
