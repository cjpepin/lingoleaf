
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

interface HighlightPopupProps {
  x: number;
  y: number;
  selectedText: string;
  onHighlight: () => void;
  onTranslate: (text: string) => void;
  translation: string | null;
  onSaveVocab: (opts?: { folderId?: string | null }) => void;
  saving: boolean;
  savingDone: boolean;
  onClose: () => void;
}

const HighlightPopup = ({
  x,
  y,
  selectedText,
  onHighlight,
  onTranslate,
  translation,
  onSaveVocab,
  saving,
  savingDone,
  onClose,
}: HighlightPopupProps) => {
  const { user } = useAuth();
  const openUpgrade = useUpgradeModal((s) => s.openModal);

  const handleSaveAction = (action: () => void, actionName: string) => {
    if (!user) {
      openUpgrade();
      return;
    }
    action();
  };

  return (
    <div
      className="absolute z-50 bg-white border rounded-lg shadow-lg p-3 max-w-sm"
      style={{
        left: x - 100,
        top: y - 10,
        transform: "translateY(-100%)",
      }}
    >
      <div className="mb-2">
        <div className="font-medium text-sm text-gray-900 mb-1">
          "{selectedText}"
        </div>
        {translation && (
          <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
            {translation}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSaveAction(onHighlight, "highlight")}
          className="text-xs"
        >
          {user ? "Highlight" : "Sign in to Highlight"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onTranslate(selectedText)}
          className="text-xs"
        >
          Translate
        </Button>

        {translation && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSaveAction(() => onSaveVocab(), "save vocabulary")}
            disabled={saving}
            className="text-xs"
          >
            {saving
              ? "Saving..."
              : savingDone
              ? "Saved!"
              : user
              ? "Save Vocab"
              : "Sign in to Save"}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-xs"
        >
          ×
        </Button>
      </div>
    </div>
  );
};

export default HighlightPopup;
