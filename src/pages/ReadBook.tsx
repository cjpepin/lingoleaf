import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PdfRenderer from "@/components/reader/PdfRenderer";
import TextFileViewer from "@/components/reader/TextFileViewer";
import EpubReader from "@/components/reader/EpubReader";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { useUserBookMetadata } from "@/hooks/useUserBookMetadata";
import { Trash2, MapPin } from "lucide-react";

const ReadBook = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const openUpgrade = useUpgradeModal((s) => s.openModal);
  const [book, setBook] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { highlights, updateHighlights } = useUserBookMetadata(bookId);

  useEffect(() => {
    if (!bookId) return;
    const fetchBook = async () => {
      setError(null);
      const { data: bookData, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .maybeSingle();
      
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      
      if (!bookData) {
        setError("Book not found");
        return;
      }

      setBook(bookData);
      console.log("Book access level:", bookData.access_level);
      console.log("File path:", bookData.file_path);

      // Check if authentication is required for this book
      const requiresAuth = bookData.access_level === 'paid' || bookData.access_level === 'personal';
      
      if (requiresAuth && !user) {
        setError("Please sign in to read this book");
        return;
      }

      if (bookData?.file_path) {
        // Determine which bucket to use based on access level
        const bucketName = bookData.access_level === 'free' ? 'public-books' : 'private-books';
        
        const { data, error: urlError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(bookData.file_path, 60 * 60);
        
        if (urlError) {
          setError(urlError.message);
        } else {
          setFileUrl(data.signedUrl);
        }
      }
    };
    fetchBook();
  }, [bookId, user]);

  const handleNavigateToHighlight = (highlight: any) => {
    // This will be handled by the EpubReader component
    const event = new CustomEvent('navigateToHighlight', { detail: highlight });
    window.dispatchEvent(event);
  };

  const handleDeleteHighlight = (highlightId: string) => {
    const updatedHighlights = highlights.filter((h: any) => h.id !== highlightId);
    updateHighlights(updatedHighlights);
    
    // Notify EpubReader to remove the annotation
    const event = new CustomEvent('deleteHighlight', { detail: { id: highlightId } });
    window.dispatchEvent(event);
  };

  const ext = (book?.file_path || "").split(".").pop()?.toLowerCase();
  let bookContent;
  
  if (!book) {
    bookContent = error ? (
      <div className="text-center">
        <div className="text-red-500 mb-4">{error}</div>
        {error === "Please sign in to read this book" && (
          <Button onClick={() => openUpgrade()}>
            Sign In to Continue
          </Button>
        )}
      </div>
    ) : (
      <div>Loading book...</div>
    );
  } else if (!fileUrl) {
    bookContent = <div className="text-gray-600">Preparing book file URL...</div>;
  } else if (ext === "pdf") {
    bookContent = (
      <PdfRenderer fileUrl={fileUrl} title={book.title} />
    );
  } else if (ext === "epub") {
    bookContent = (
      <EpubReader fileUrl={fileUrl} title={book.title} />
    );
  } else if (ext === "txt" || ext === "text") {
    bookContent = (
      <TextFileViewer fileUrl={fileUrl} />
    );
  } else {
    bookContent = <div>Unsupported file type: {ext}</div>;
  }

  return (
    <div className="bg-[#f9fafb] min-h-screen overflow-hidden">
      <Navbar authenticated={!!user} />
      <main className="flex flex-row h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-1/4 px-6 py-8 border-r border-gray-200 flex flex-col gap-4">
          <Button variant="ghost" onClick={() => navigate("/library")}>
            &larr; Back to Library
          </Button>
          <h2 className="text-2xl font-bold text-green-800 break-words">{book?.title ?? ""}</h2>
          <div className="text-gray-700 overflow-y-auto max-h-[20vh]">{book?.notes}</div>
          
          {/* Highlights Section */}
          {highlights && highlights.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Highlights ({highlights.length})
              </h3>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {highlights.map((highlight: any) => (
                  <div
                    key={highlight.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
                  >
                    <div
                      className="text-sm text-gray-800 mb-2"
                      onClick={() => handleNavigateToHighlight(highlight)}
                    >
                      {highlight.text.length > 60
                        ? highlight.text.substring(0, 60) + "..."
                        : highlight.text}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Page {highlight.page}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHighlight(highlight.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
        {/* Book content */}
        <section className="w-3/4 flex items-center justify-center ">
          <div className="max-h-full max-w-full ">
            {bookContent}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ReadBook;
