
import { useState } from "react";
import VocabFolderList from "./VocabFolderList";
import VocabWords from "./VocabWords";
import EditFolderDialog from "./EditFolderDialog";
import DeleteFolderDialog from "./DeleteFolderDialog";
import { useVocabFolders } from "@/hooks/useVocabFolders";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import UpgradeModal from "@/components/UpgradeModal";
import { useVocabWords } from "@/hooks/useVocabWords";
import { useNavigate } from "react-router-dom";

// Always free for now; if user.tier is ever added, adjust accordingly
function isPaidUser(_user: unknown) {
  // TODO: Replace with real check if/when user.tier exists
  return false;
}

type Folder = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

const VocabFolders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { folders, createFolder, updateFolder, deleteFolder, loading: foldersLoading, error: foldersError } = useVocabFolders();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const openUpgrade = useUpgradeModal((s) => s.openModal);
  const canCreateFolder = isPaidUser(user) || (folders?.length ?? 0) < 3;

  // Dialog states
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // For studying
  const [studyFolder, setStudyFolder] = useState<string | null>(null);
  const { words: currentFolderWords } = useVocabWords(selectedFolder);

  function handleStudy(folderId: string | null) {
    if (!currentFolderWords || currentFolderWords.length < 1) {
      toast({ title: "No words to study in this folder" });
      return;
    }
    // window.location.href = `/study?folderId=${folderId ?? "all-words"}`;
    navigate(`/study?folderId=${folderId ? folderId : "all-words"}`, { replace: true });
  }

  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setIsEditDialogOpen(true);
  };

  const handleDeleteFolder = (folder: Folder) => {
    setDeletingFolder(folder);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveEdit = async (data: { id: string; name: string; note?: string }) => {
    setIsSaving(true);
    try {
      await updateFolder(data);
      toast({ title: "Folder updated successfully" });
    } catch (error) {
      toast({ title: "Failed to update folder", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (folderId: string) => {
    setIsDeleting(true);
    try {
      await deleteFolder(folderId);
      toast({ title: "Folder deleted successfully" });
      // If the deleted folder was selected, reset selection
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
    } catch (error) {
      toast({ title: "Failed to delete folder", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-7 flex-wrap md:flex-nowrap">
      <UpgradeModal />
      
      <EditFolderDialog
        folder={editingFolder}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSaveEdit}
        isSaving={isSaving}
      />
      
      <DeleteFolderDialog
        folder={deletingFolder}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      <div className="w-full md:w-56">
        <div className="text-sm font-bold mb-1 mt-2 text-gray-700">Folders</div>
        <VocabFolderList
          folders={folders}
          selected={selectedFolder}
          onSelect={setSelectedFolder}
          onStudy={handleStudy}
          onEdit={handleEditFolder}
          onDelete={handleDeleteFolder}
        />
        <Button
          variant="secondary"
          className="w-full mt-2"
          onClick={async () => {
            if (!canCreateFolder) {
              toast({ title: "Folder limit (3) reached for free plan." });
              openUpgrade();
              return;
            }
            const name = prompt("Folder name:");
            if (name && name.trim()) {
              await createFolder(name.trim());
            }
          }}
          disabled={!canCreateFolder}
        >
          + New Folder
        </Button>
      </div>
      <div className="flex-1">
        <VocabWords folderId={selectedFolder} key={selectedFolder || "all"} />
      </div>
    </div>
  );
};
export default VocabFolders;
