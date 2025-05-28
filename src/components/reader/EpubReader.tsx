
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { translateText } from "@/utils/translate";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import HighlightPopup from "./HighlightPopup";
import { useUserBookMetadata } from "@/hooks/useUserBookMetadata";

// Type definitions for EPUB.js objects
interface SpineItem {
  href: string;
}

interface ExtendedSpine {
  items: SpineItem[];
}

type Props = {
  fileUrl: string;
  title?: string;
};

const EpubReader = ({ fileUrl, title }: Props) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);

  const { bookId } = useParams<{ bookId: string }>();
  const { save, saving, savingDone } = useSaveVocabWord();

  // Hook to manage user's reading progress and highlights for this book
  const {
    currentPage,
    highlights,
    updatePage,
    updateHighlights,
    loading: metaLoading,
  } = useUserBookMetadata(bookId);

  // State for text selection and translation popup
  const [popup, setPopup] = useState({
    show: false,
    x: 0,
    y: 0,
    selectedText: "",
    rect: null as DOMRect | null,
  });

  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);

  /**
   * Navigate to a specific page/chapter in the EPUB
   * Uses spine items to determine valid page range
   */
  const goToPage = async (page: number) => {
    if (!renditionRef.current || !bookRef.current || !totalPages) return;
    
    // Cast spine to ExtendedSpine through unknown to satisfy TypeScript
    const spineItems = (bookRef.current.spine as unknown as ExtendedSpine).items;
    const pageCount = spineItems.length || 1;
    
    // Ensure page is within valid range
    let targetPage = page;
    if (targetPage < 1) targetPage = 1;
    if (targetPage > pageCount) targetPage = pageCount;
    
    // Navigate to the specific spine location
    if (spineItems && spineItems.length) {
      const loc = spineItems[targetPage - 1]?.href ?? spineItems[0].href;
      await renditionRef.current.display(loc);
      updatePage(targetPage);
    }
  };

  // Load and initialize EPUB reader
  useEffect(() => {
    const loadEpub = async () => {
      try {
        // Fetch the EPUB file and convert to ArrayBuffer
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();

        // Dynamically import EPUB.js library
        const epubjs = await import("epubjs");
        const book = epubjs.default(buffer);
        bookRef.current = book;

        // Initialize book and set up spine navigation
        book.ready.then(() => {
          // Cast spine to ExtendedSpine through unknown to satisfy TypeScript
          const spineItems = (book.spine as unknown as ExtendedSpine).items;
          setTotalPages(spineItems.length || 1);
          
          // Restore user's last reading position
          if (currentPage && spineItems.length) {
            const safePage = Math.min(currentPage, spineItems.length);
            const spineLoc = spineItems[safePage - 1]?.href ?? spineItems[0].href;
            renditionRef.current?.display(spineLoc);
          }
        });

        // Create rendition (visual display) of the book
        const rendition = book.renderTo(viewerRef.current!, {
          width: "50vw",
          height: "calc(100vh - 120px)",
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        // Track when user navigates to update current page
        rendition.on("relocated", (location: any) => {
          if (book.spine) {
            // Cast spine to ExtendedSpine through unknown to satisfy TypeScript
            const spineItems = (book.spine as unknown as ExtendedSpine).items;
            const idx = spineItems.findIndex((item: SpineItem) => item.href === location.start.href) + 1;
            if (idx > 0) updatePage(idx);
          }
        });

      } catch (err: any) {
        setError("Failed to load EPUB: " + (err.message || err));
      }
    };

    loadEpub();

    // Cleanup when component unmounts
    return () => {
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
    };
  }, [fileUrl, currentPage]);

  // Handle text selection for translation and highlighting
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
        setTranslation(null);
        return;
      }

      const selectedText = selection.toString();
      // Limit selection length to prevent UI issues
      if (!selectedText || selectedText.length > 120) return;

      // Position popup near the selected text
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top - rect.height / 2;

      setPopup({
        show: true,
        x,
        y,
        selectedText,
        rect,
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Translate selected text using translation service
  const handleTranslate = async (text: string) => {
    const result = await translateText(text);
    setTranslation(result);
  };

  // Save selected word and translation to vocabulary
  const handleSaveVocab = async () => {
    if (!bookId || !popup.selectedText || !translation) return;
    await save({
      word: popup.selectedText,
      translation,
      bookId,
      pageNumber: currentPage,
    });
  };

  // Save highlight and close popup
  const handleHighlight = () => {
    updateHighlights([
      ...highlights,
      { text: popup.selectedText, rect: popup.rect, page: currentPage },
    ]);
    setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
    setTranslation(null);
    window.getSelection()?.removeAllRanges();
  };

  // Navigation handlers for previous/next page
  const handlePrev = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (totalPages && currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-between overflow-hidden relative">
      {/* Page navigation controls */}
      <div className="flex items-center gap-4 my-2">
        <button
          className="px-3 py-1 bg-gray-100 rounded border disabled:opacity-50"
          onClick={handlePrev}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} {totalPages ? `of ${totalPages}` : ""}
        </span>
        <button
          className="px-3 py-1 bg-gray-100 rounded border disabled:opacity-50"
          onClick={handleNext}
          disabled={!!totalPages && currentPage >= totalPages}
        >
          Next
        </button>
      </div>

      {/* EPUB viewer container */}
      <div
        ref={viewerRef}
        className="border shadow bg-white rounded p-2 h-full mx-auto overflow-hidden"
      />

      {/* Text selection popup for translation/highlighting */}
      {popup.show && popup.selectedText && (
        <HighlightPopup
          x={popup.x}
          y={popup.y}
          selectedText={popup.selectedText}
          onHighlight={handleHighlight}
          onTranslate={handleTranslate}
          translation={translation}
          onSaveVocab={handleSaveVocab}
          saving={saving}
          savingDone={savingDone}
          onClose={() => {
            setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
            setTranslation(null);
          }}
        />
      )}

      {/* Error display */}
      {error && <div className="text-red-600 absolute top-4">{error}</div>}
    </div>
  );
};

export default EpubReader;
