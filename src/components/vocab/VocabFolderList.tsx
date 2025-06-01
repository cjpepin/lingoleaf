
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

type Folder = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
  count?: number;
  onStudy?: () => void;
};

const VocabFolderList = ({
  folders,
  selected,
  onSelect,
  onStudy,
  onEdit,
  onDelete,
}: {
  folders: Folder[] | undefined;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onStudy?: (id: string | null) => void;
  onEdit?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Button
          variant={!selected ? "default" : "ghost"}
          className={cn("justify-start flex-1", !selected && "bg-green-100 text-green-800")}
          onClick={() => onSelect(null)}
        >
          All Words
        </Button>
        {onStudy && (
          <Button size="sm" className="ml-2" onClick={() => onStudy(null)}>
            Study
          </Button>
        )}
      </div>
      {folders?.map((folder) => (
        <div className="flex justify-between items-center group" key={folder.id}>
          <Button
            variant={selected === folder.id ? "default" : "ghost"}
            className={cn(
              "justify-start flex-1 text-left",
              selected === folder.id && "bg-green-100 text-green-800"
            )}
            onClick={() => onSelect(folder.id)}
          >
            <span className="truncate">{folder.name}</span>
          </Button>
          <div className="flex items-center gap-1 ml-2">
            {onStudy && (
              <Button
                size="sm"
                onClick={() => onStudy(folder.id)}
              >
                Study
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onEdit(folder)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
                onClick={() => onDelete(folder)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VocabFolderList;
