
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type BookCardProps = {
  book: any;
};

const BookCard = ({ book }: BookCardProps) => {
  const navigate = useNavigate();
  return (
    <Card key={book.id} className="hover-scale transition">
      <div
        onClick={() => navigate(`/read/${book.id}`)}
        className="cursor-pointer"
      >
        <img
          src={
            book.cover_image_url ||
            book.cover ||
            "https://placehold.co/400x520?text=Book+Cover"
          }
          alt={book.title}
          className="w-full h-52 object-cover rounded-t-lg"
        />
        <CardHeader>
          <CardTitle className="text-green-900 text-lg">{book.title}</CardTitle>
          <div className="text-sm text-gray-500">
            {("author" in book ? book.author : "") || ""}
          </div>
        </CardHeader>
      </div>
    </Card>
  );
};

export default BookCard;
