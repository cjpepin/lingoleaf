
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Folder = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

const VocabFolderList = ({
  folders,
  selected,
  onSelect,
}: {
  folders: Folder[] | undefined;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={!selected ? "default" : "ghost"}
        className={cn("justify-start", !selected && "bg-green-100 text-green-800")}
        onClick={() => onSelect(null)}
      >
        All Words
      </Button>
      {folders?.map((folder) => (
        <Button
          key={folder.id}
          variant={selected === folder.id ? "default" : "ghost"}
          className={cn(
            "justify-start",
            selected === folder.id && "bg-green-100 text-green-800"
          )}
          onClick={() => onSelect(folder.id)}
        >
          {folder.name}
        </Button>
      ))}
    </div>
  );
};

export default VocabFolderList;
