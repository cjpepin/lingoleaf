
import Navbar from "@/components/Navbar";
import BookGrid from "@/components/library/BookGrid";
import EditBookModal from "@/components/library/EditBookModal";
import { useLibraryBooks } from "@/hooks/useLibraryBooks";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import HeaderBannerAd from "@/components/ads/HeaderBannerAd";
import LibraryAd from "@/components/ads/LibraryAd";
import { useUserBooks } from "@/hooks/useUserBooks";

const Library = () => {
  const { user } = useAuth();
  const { libraryBooks, isLoading, error, refetch } = useLibraryBooks();
  const { data: userBooks,  isLoading: isBooksLoading } = useUserBooks(user?.id);
  const navigate = useNavigate();
  // State for edit modal
  const [editingBook, setEditingBook] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  /**
   * Handle book title/cover editing with custom modal
   */
  const handleEdit = (book: any) => {
    setEditingBook(book);
    setIsEditModalOpen(true);
  };

  /**
   * Handle successful book update
   */
  const handleEditSuccess = () => {
    refetch();
  };

  /**
   * Close edit modal and reset state
   */
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingBook(null);
  };

  const handleDelete = (book: any) => {
    if (!window.confirm("Delete this book? This cannot be undone.")) return;
    
    supabase
      .from("books")
      .delete()
      .eq("id", book.id)
      .then(({ error }) => {
        if (error) {
          toast({ 
            title: "Couldn't delete", 
            description: error.message, 
            variant: "destructive" 
          });
        } else {
          toast({ title: "Book deleted" });
          refetch();
        }
      });
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      {/* Header Banner Ad */}
      
      <Navbar authenticated={!!user} />
      <HeaderBannerAd />
      <UpgradeModal />
      <EditBookModal
        book={editingBook}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
      />
      
      <main className="max-w-7xl mx-auto py-8 px-4 flex gap-8">
        {/* Main content area */}
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-green-800 mb-6">
            {user && userBooks?.length > 0 ? "Your Library" : "Library"}
          </h2>
          
          {/* Upload button for authenticated users */}
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

          {/* Loading and error states */}
          {user && isLoading ? (
            <div className="text-lg text-gray-600 py-16 text-center">
              Loading your books...
            </div>
          ) : error ? (
            <div className="text-red-600 text-center">{error.message}</div>
          ) : (
            <>
              {/* User's personal books section */}
              {user && userBooks?.length > 0 && (
                <section className="mb-12">
                  <h3 className="text-xl font-bold mb-4">Your Books</h3>
                  <div className="grid md:grid-cols-3 gap-7">
                    {userBooks.map((book, index) => (
                      <div key={book.id} className="contents">
                        <BookGrid
                          books={[book]}
                          ownedBooksOnly
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                        {/* Ad after every 6 books */}
                        {(index + 1) % 6 === 0 && index < userBooks.length - 1 && (
                          <LibraryAd placement="between-books" />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              
              {/* General library section */}
              <section>
                <h3 className="text-xl font-bold mb-4">
                  {libraryBooks.length > 0 ? "Library Highlights" : ""}
                </h3>
                <div className="grid md:grid-cols-3 gap-7">
                  {libraryBooks.map((book, index) => (
                    <div key={book.id} className="contents">
                      <BookGrid books={[book]} />
                      {/* Ad after every 6 books
                      {(index + 1) % 6 === 0 && index < libraryBooks.length - 1 && (
                        <LibraryAd placement="between-books" />
                      )} */}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Sidebar with ads */}
        <div className="hidden lg:block w-80">
          <LibraryAd placement="sidebar" />
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h4 className="font-semibold text-gray-800 mb-2">Quick Stats</h4>
            <p className="text-sm text-gray-600">
              {user ? `You have ${userBooks?.length} books` : "Sign in to track your books"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Library;
