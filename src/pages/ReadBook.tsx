
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Basic Reader page for /read/:bookId
 * Features: fetch book metadata, render file (pdf/epub/txt), basic page nav, highlight placeholders.
 */
const ReadBook = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const [book, setBook] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // For now, only "page" navigation stub.
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (!bookId) return;
    // Fetch book metadata
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
      setBook(bookData);

      // Generate a signed URL to download the file
      if (bookData?.file_path) {
        const { data, error: urlError } = await supabase.storage
          .from("books")
          .createSignedUrl(bookData.file_path, 60 * 60); // 1hr
        if (urlError) {
          setError(urlError.message);
        } else {
          setFileUrl(data.signedUrl);
        }
      }
    };
    fetchBook();
  }, [bookId]);

  // (File type detection for rendering)
  const ext = (book?.file_path || "").split(".").pop()?.toLowerCase();

  // Simple rendering by type - improve with custom readers later!
  let bookContent;
  if (!book) {
    bookContent = error ? (
      <div className="text-red-500">{error}</div>
    ) : (
      <div>Loading book...</div>
    );
  } else if (!fileUrl) {
    bookContent = <div className="text-gray-600">Preparing book file URL...</div>;
  } else if (ext === "pdf") {
    bookContent = (
      <iframe
        src={fileUrl}
        title={book.title}
        className="w-full min-h-[70vh] bg-white border"
      />
    );
  } else if (ext === "txt" || ext === "text") {
    // For demo, fetch and render as text
    bookContent = (
      <TextFileViewer fileUrl={fileUrl} />
    );
  } else {
    bookContent = <div>Unsupported file type: {ext}</div>;
  }

  // Placeholder: chapter/page nav & highlight bar
  return (
    <div className="bg-[#f9fafb] min-h-screen">
      <Navbar authenticated={!!user} />
      <main className="max-w-3xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => window.history.back()} className="mb-6">
          &larr; Back to Library
        </Button>
        <h2 className="text-2xl font-bold mb-2 text-green-800">{book?.title ?? ""}</h2>
        <div className="mb-4 text-gray-700">{book?.notes}</div>
        {/* File rendering */}
        <section className="mb-6">{bookContent}</section>
        {/* Page Navigation (Stub for PDF/EPUB) */}
        <div className="flex items-center gap-2 mb-8">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span>Page {currentPage}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
        {/* Text selection, highlight & popup placeholder */}
        <div
          className="relative border rounded p-6 transition shadow bg-white mb-6"
          style={{ minHeight: 120 }}
        >
          <p className="text-gray-500 italic">
            (Highlight a word or phrase to see translation &amp; vocab features here)
          </p>
        </div>
      </main>
    </div>
  );
};

// Simple text viewer for txt files (fetches and displays file content)
const TextFileViewer = ({ fileUrl }: { fileUrl: string }) => {
  const [content, setContent] = useState<string | null>(null);
  useEffect(() => {
    fetch(fileUrl)
      .then(r => r.text())
      .then(setContent)
      .catch(() => setContent("(Failed to load text file)"));
  }, [fileUrl]);
  return (
    <pre className="bg-gray-100 text-sm rounded p-4 max-h-[65vh] overflow-auto whitespace-pre-wrap">
      {content ?? "Loading..."}
    </pre>
  );
};

export default ReadBook;
