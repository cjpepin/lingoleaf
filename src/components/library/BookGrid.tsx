import BookCard from "./BookCard";
import { useAuth } from "@/hooks/useAuth";

type BookGridProps = {
  books: any[];
  onEdit?: (b: any) => void;
  onDelete?: (b: any) => void;
  ownedBooksOnly?: boolean;
};

const BookGrid = ({ books, onEdit, onDelete, ownedBooksOnly }: BookGridProps) => {
  const { user } = useAuth();
  return (
    <div className="grid md:grid-cols-3 gap-7">
      {books.map(book => (
        <BookCard
          key={book.id}
          book={book}
          isOwn={ownedBooksOnly}
          onEdit={onEdit ? () => onEdit(book) : undefined}
          onDelete={onDelete ? () => onDelete(book) : undefined}
        />
      ))}
    </div>
  );
};

export default BookGrid;
