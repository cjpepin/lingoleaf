
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Folder = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

type EditFolderDialogProps = {
  folder: Folder | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { id: string; name: string; note?: string }) => Promise<void>;
  isSaving?: boolean;
};

const EditFolderDialog = ({
  folder,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: EditFolderDialogProps) => {
  const [name, setName] = useState(folder?.name || "");
  const [note, setNote] = useState(folder?.note || "");

  const handleSave = async () => {
    if (!folder || !name.trim()) return;
    
    try {
      await onSave({
        id: folder.id,
        name: name.trim(),
        note: note.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update folder:", error);
    }
  };

  const handleClose = () => {
    setName(folder?.name || "");
    setNote(folder?.note || "");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folder-note">Note (optional)</Label>
            <Textarea
              id="folder-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this folder"
              disabled={isSaving}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditFolderDialog;
