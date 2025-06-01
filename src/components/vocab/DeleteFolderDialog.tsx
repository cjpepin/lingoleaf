
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Folder = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

type DeleteFolderDialogProps = {
  folder: Folder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderId: string) => Promise<void>;
  isDeleting?: boolean;
};

const DeleteFolderDialog = ({
  folder,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteFolderDialogProps) => {
  const handleConfirm = async () => {
    if (!folder) return;
    
    try {
      await onConfirm(folder.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Folder</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the folder "{folder?.name}"? 
            This action cannot be undone and will also remove all vocabulary words in this folder.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete Folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteFolderDialog;
