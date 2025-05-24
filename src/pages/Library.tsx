
import Navbar from "@/components/Navbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserBooks } from "@/hooks/useUserBooks";
import { useEffect } from "react";

const DUMMY_BOOKS = [
  {
    id: "1",
    title: "French for Beginners",
    author: "Marie Dubois",
    cover: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=cover&w=400&q=80"
  },
  {
    id: "2",
    title: "Learn Spanish Fast",
    author: "Carlos Garcia",
    cover: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=cover&w=400&q=80"
  },
  {
    id: "3",
    title: "Mandarin Tales",
    author: "Sun Yan",
    cover: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=cover&w=400&q=80"
  }
];

const Library = () => {
  const { user, loading } = useAuth();
  const { data: userBooks, isLoading, error, refetch } = useUserBooks(user?.id);
  const navigate = useNavigate();

  // Refetch whenever user changes (on login/logout)
  useEffect(() => {
    if (user?.id) refetch();
  }, [user?.id]);

  const booksToShow = user && userBooks && userBooks.length > 0 ? userBooks : DUMMY_BOOKS;

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={!!user} />
      <main className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold text-green-800 mb-6">
          {user && userBooks && userBooks.length > 0
            ? "Your Library"
            : "Library"}
        </h2>
        {user && (
          <div className="mb-8">
            <button
              className="bg-green-600 text-white rounded px-3 py-2 hover:bg-green-700 transition"
              onClick={() => navigate("/upload")}
            >
              + Upload a Book
            </button>
          </div>
        )}
        {user && isLoading ? (
          <div className="text-lg text-gray-600 py-16 text-center">Loading your books...</div>
        ) : error ? (
          <div className="text-red-600 text-center">{error.message}</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-7">
            {booksToShow.map((book: any) => (
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
                      {"author" in book ? book.author : ""}
                    </div>
                  </CardHeader>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;
