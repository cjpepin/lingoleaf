
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

const ReadBook = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const openUpgrade = useUpgradeModal((s) => s.openModal);
  const [book, setBook] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      // <BackupEpubReader fileUrl={fileUrl} />
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
          <div className="text-gray-700 overflow-y-auto max-h-[40vh]">{book?.notes}</div>
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
