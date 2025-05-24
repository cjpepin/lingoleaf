
import BookCard from "./BookCard";

type BookGridProps = {
  books: any[];
};

const BookGrid = ({ books }: BookGridProps) => (
  <div className="grid md:grid-cols-3 gap-7">
    {books.map(book => <BookCard key={book.id} book={book} />)}
  </div>
);

export default BookGrid;
