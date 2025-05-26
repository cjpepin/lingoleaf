
import { useState } from "react";
import VocabFolderList from "./VocabFolderList";
import VocabWords from "./VocabWords";
import { useVocabFolders } from "@/hooks/useVocabFolders";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// Always free for now; if user.tier is ever added, adjust accordingly
function isPaidUser(_user: unknown) {
  // TODO: Replace with real check if/when user.tier exists
  return false;
}

const VocabFolders = () => {
  const { user } = useAuth();
  const { folders, createFolder, loading: foldersLoading, error: foldersError } = useVocabFolders();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const canCreateFolder = isPaidUser(user) || (folders?.length ?? 0) < 3;

  return (
    <div className="flex gap-7 flex-wrap md:flex-nowrap">
      <div className="w-full md:w-56">
        <div className="text-sm font-bold mb-1 mt-2 text-gray-700">Folders</div>
        <VocabFolderList
          folders={folders}
          selected={selectedFolder}
          onSelect={setSelectedFolder}
        />
        <Button
          variant="secondary"
          className="w-full mt-2"
          onClick={async () => {
            if (!canCreateFolder) {
              toast({ title: "Folder limit (3) reached for free plan." });
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

