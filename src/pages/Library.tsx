import Navbar from "@/components/Navbar";
import BookGrid from "@/components/library/BookGrid";
import { useLibraryBooks } from "@/hooks/useLibraryBooks";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

const Library = () => {
  const { user, booksToShow, isLoading, error, refetch } = useLibraryBooks();
  const navigate = useNavigate();
  const openUpgrade = useUpgradeModal((s) => s.openModal);

  // Example: Mark books with id "2" as premium for demo purposes
  const isPremiumBook = (book: any) => book.id === "2";
  const handleBookClick = (book: any) => {
    if (isPremiumBook(book) && !user) {
      openUpgrade();
      return;
    }
    navigate(`/read/${book.id}`);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={!!user} />
      <UpgradeModal />
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
          <div className="grid md:grid-cols-3 gap-7">
            {booksToShow.map(book => (
              <div
                key={book.id}
                className="relative"
                tabIndex={0}
                onClick={() => handleBookClick(book)}
                style={{ cursor: isPremiumBook(book) && !user ? "not-allowed" : "pointer" }}
              >
                <BookGrid books={[book]} />
                {isPremiumBook(book) && !user && (
                  <div className="absolute inset-0 bg-green-900/70 flex flex-col items-center justify-center rounded-lg z-10">
                    <span className="text-white text-lg font-bold">Premium book</span>
                    <Button className="mt-2 bg-green-600" onClick={e => { e.stopPropagation(); openUpgrade(); }}>Upgrade</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
export default Library;
