import Navbar from "@/components/Navbar";
import BookGrid from "@/components/library/BookGrid";
import { useLibraryBooks } from "@/hooks/useLibraryBooks";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import BookCard from "@/components/library/BookCard";

const Library = () => {
  const { user } = useAuth();
  const { booksToShow, isLoading, error, refetch } = useLibraryBooks();
  const navigate = useNavigate();

  // Separate own and general library books
  const ownBooks = user
    ? booksToShow.filter((b: any) => b.owner_id === user.id)
    : [];
  const generalBooks = booksToShow.filter(
    (b: any) => !user || b.owner_id !== user.id
  );

  // Edit / delete actions
  const handleEdit = (book: any) => {
    // Modal logic for edit goes here (prompt for title/notes/image...)
    const newTitle = prompt("Edit book title:", book.title);
    if (!newTitle) return;
    supabase
      .from("books")
      .update({ title: newTitle })
      .eq("id", book.id)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Failed to update book", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Book updated!" });
          refetch();
        }
      });
  };

  const handleDelete = (book: any) => {
    if (!window.confirm("Delete this book? This cannot be undone.")) return;
    supabase
      .from("books")
      .delete()
      .eq("id", book.id)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Book deleted" });
          refetch();
        }
      });
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={!!user} />
      <UpgradeModal />
      <main className="max-w-5xl mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold text-green-800 mb-6">
          {user && ownBooks.length > 0
            ? "Your Library"
            : "Library"}
        </h2>
        {user && (
          <div className="mb-8">
            <Button
              className="bg-green-600 text-white rounded px-3 py-2 hover:bg-green-700 transition"
              onClick={() => navigate("/upload")}
            >
              + Upload a Book
            </Button>
          </div>
        )}
        {user && isLoading ? (
          <div className="text-lg text-gray-600 py-16 text-center">Loading your books...</div>
        ) : error ? (
          <div className="text-red-600 text-center">{error.message}</div>
        ) : (
          <>
            {user && ownBooks.length > 0 && (
              <section className="mb-12">
                <h3 className="text-xl font-bold mb-2">Your Books</h3>
                <BookGrid
                  books={ownBooks}
                  ownedBooksOnly
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </section>
            )}
            <section>
              <h3 className="text-xl font-bold mb-2">{generalBooks.length > 0 ? "Library Highlights" : ""}</h3>
              <BookGrid books={generalBooks} />
            </section>
          </>
        )}
      </main>
    </div>
  );
};
export default Library;
