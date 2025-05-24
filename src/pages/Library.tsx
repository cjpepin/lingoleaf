
import Navbar from "@/components/Navbar";
import BookGrid from "@/components/library/BookGrid";
import { useLibraryBooks } from "@/hooks/useLibraryBooks";
import { useNavigate } from "react-router-dom";

const Library = () => {
  const { user, booksToShow, isLoading, error, refetch } = useLibraryBooks();
  const navigate = useNavigate();

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={!!user} />
      <main className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold text-green-800 mb-6">
          {user && booksToShow.length > 0
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
          <BookGrid books={booksToShow} />
        )}
      </main>
    </div>
  );
};

export default Library;
