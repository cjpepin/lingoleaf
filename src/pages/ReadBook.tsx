import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PdfRenderer from "@/components/reader/PdfRenderer";
import TextFileViewer from "@/components/reader/TextFileViewer";
import NavigationBar from "@/components/reader/NavigationBar";
import HighlightBar from "@/components/reader/HighlightBar";
import EpubPlaceholder from "@/components/reader/EpubPlaceholder";

const ReadBook = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);

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
      setBook(bookData);
      if (bookData?.file_path) {
        const { data, error: urlError } = await supabase.storage
          .from("books")
          .createSignedUrl(bookData.file_path, 60 * 60);
        if (urlError) {
          setError(urlError.message);
        } else {
          setFileUrl(data.signedUrl);
        }
      }
    };
    fetchBook();
  }, [bookId]);

  const ext = (book?.file_path || "").split(".").pop()?.toLowerCase();

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
      <PdfRenderer fileUrl={fileUrl} title={book.title} />
    );
  } else if (ext === "epub") {
    bookContent = <EpubPlaceholder />;
  } else if (ext === "txt" || ext === "text") {
    bookContent = (
      <TextFileViewer fileUrl={fileUrl} />
    );
  } else {
    bookContent = <div>Unsupported file type: {ext}</div>;
  }

  return (
    <div className="bg-[#f9fafb] min-h-screen">
      <Navbar authenticated={!!user} />
      <main className="max-w-3xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() =>  navigate("/library")} className="mb-6">
          &larr; Back to Library
        </Button>
        <h2 className="text-2xl font-bold mb-2 text-green-800">{book?.title ?? ""}</h2>
        <div className="mb-4 text-gray-700">{book?.notes}</div>
        <section className="mb-6">{bookContent}</section>
        <HighlightBar />
      </main>
    </div>
  );
};

export default ReadBook;
