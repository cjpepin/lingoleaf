
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type BookCardProps = {
  book: any;
  onEdit?: () => void;
  onDelete?: () => void;
  isOwn?: boolean;
};

const BookCard = ({ book, onEdit, onDelete, isOwn }: BookCardProps) => {
  const navigate = useNavigate();
  // Uniform card aspect ratio
  return (
    <Card className="hover-scale transition h-[320px] flex flex-col shadow-md">
      <div className="relative flex-1 min-h-0">
        <img
          src={
            book.cover_image_url ||
            book.cover ||
            "https://placehold.co/400x520?text=Book+Cover"
          }
          alt={book.title}
          className="w-full h-44 object-cover rounded-t-lg transition"
          style={{ objectFit: "cover", width: "100%" }}
        />
        {isOwn && (onEdit || onDelete) && (
          <div className="absolute right-2 top-2 flex gap-2 z-10">
            {onEdit && (
              <button
                className="bg-yellow-400/80 px-2 py-0.5 rounded text-xs font-bold text-gray-800 shadow-sm hover:bg-yellow-400 transition"
                onClick={e => { e.stopPropagation(); onEdit(); }}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                className="bg-red-500/70 px-2 py-0.5 rounded text-xs font-bold text-white shadow-sm hover:bg-red-600 transition"
                onClick={e => { e.stopPropagation(); onDelete(); }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      <div
        onClick={() => navigate(`/read/${book.id}`)}
        className="cursor-pointer flex flex-col flex-1 justify-between"
      >
        <CardHeader className="pb-1">
          <CardTitle className="text-green-900 text-base line-clamp-2 min-h-[48px]">{book.title}</CardTitle>
          <div className="text-sm text-gray-500">{("author" in book ? book.author : "") || ""}</div>
        </CardHeader>
        <div className="text-xs text-gray-500 px-5 pb-2 truncate">
          {book.notes}
        </div>
      </div>
    </Card>
  );
};

export default BookCard;
