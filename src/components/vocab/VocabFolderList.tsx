
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
}: {
  folders: Folder[] | undefined;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onStudy?: (id: string | null) => void;
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
        <div className="flex justify-between items-center" key={folder.id}>
          <Button
            variant={selected === folder.id ? "default" : "ghost"}
            className={cn(
              "justify-start flex-1",
              selected === folder.id && "bg-green-100 text-green-800"
            )}
            onClick={() => onSelect(folder.id)}
          >
            {folder.name}
          </Button>
          {onStudy && (
            <Button
              size="sm"
              className="ml-2"
              onClick={() => onStudy(folder.id)}
            >
              Study
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default VocabFolderList;
