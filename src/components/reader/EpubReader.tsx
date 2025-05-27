import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { translateText } from "@/utils/translate";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import HighlightPopup from "./HighlightPopup";
import { useUserBookMetadata } from "@/hooks/useUserBookMetadata";

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

  // Metadata usage
  const {
    currentPage,
    highlights,
    updatePage,
    updateHighlights,
    loading: metaLoading,
    setCurrentPage,
    setHighlights
  } = useUserBookMetadata(bookId);

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
  const [pageReady, setPageReady] = useState(false);

  // Go to a given spine location in the epub
  const goToPage = async (page: number) => {
    if (!renditionRef.current || !bookRef.current || !totalPages) return;
    const spineItems = bookRef.current.spine.items;
    const pageCount = spineItems.length || 1;
    let targetPage = page;
    if (targetPage < 1) targetPage = 1;
    if (targetPage > pageCount) targetPage = pageCount;
    // Use book's spine to display correct location
    if (spineItems && spineItems.length) {
      const loc = spineItems[targetPage - 1]?.href ?? spineItems[0].href;
      await renditionRef.current.display(loc);
      updatePage(targetPage);
    }
  };

  useEffect(() => {
    const loadEpub = async () => {
      try {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();

        const epubjs = await import("epubjs");
        const book = epubjs.default(buffer);
        bookRef.current = book;

        book.ready.then(() => {
          const spineItems = (book.spine as unknown as ExtendedSpine).items;
          setTotalPages(spineItems.length || 1);
          // Navigate to the last saved page (restore)
          if (currentPage && spineItems.length) {
            const safePage = Math.min(currentPage, spineItems.length);
            const spineLoc = spineItems[safePage - 1]?.href ?? spineItems[0].href;
            renditionRef.current?.display(spineLoc);
          }
        });

        const rendition = book.renderTo(viewerRef.current!, {
          width: "50vw",
          height: "calc(100vh - 120px)",
          allowScriptedContent: true,
        });
        renditionRef.current = rendition;

        rendition.on("relocated", (location: any) => {
          // Update current page when location changes
          if (book.spine) {
            const spineItems = (book.spine as unknown as ExtendedSpine).items;
            const idx = spineItems.findIndex((item: any) => item.href === location.start.href) + 1;
            if (idx > 0) updatePage(idx);
          }
        });

        setPageReady(true);

      } catch (err: any) {
        setError("Failed to load EPUB: " + (err.message || err));
      }
    };

    loadEpub();

    return () => {
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
    };
    // eslint-disable-next-line
  }, [fileUrl, currentPage]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
        setTranslation(null);
        return;
      }

      const selectedText = selection.toString();
      if (!selectedText || selectedText.length > 120) return;

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

  const handleTranslate = async (text: string) => {
    const result = await translateText(text);
    setTranslation(result);
  };

  const handleSaveVocab = async () => {
    if (!bookId || !popup.selectedText || !translation) return;
    await save({
      word: popup.selectedText,
      translation,
      bookId,
      pageNumber: currentPage,
    });
  };

  const handleHighlight = () => {
    updateHighlights([
      ...highlights,
      { text: popup.selectedText, rect: popup.rect, page: currentPage },
    ]);
    setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null });
    setTranslation(null);
    window.getSelection()?.removeAllRanges();
  };

  // Page navigation handlers
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

  // Render highlights (visual, for improvement)
  useEffect(() => {
    // In a real app, we'd visually overlay the highlights based on rect (TODO)
  }, [highlights, currentPage]);

  return (
    <div className="h-screen flex flex-col items-center justify-between overflow-hidden relative">
      {/* Page navigation (like in PDF) */}
      <div className="flex items-center gap-4 my-2">
        <button
          className="px-3 py-1 bg-gray-100 rounded border"
          onClick={handlePrev}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} {totalPages ? `of ${totalPages}` : ""}
        </span>
        <button
          className="px-3 py-1 bg-gray-100 rounded border"
          onClick={handleNext}
          disabled={!!totalPages && currentPage >= totalPages}
        >
          Next
        </button>
      </div>
      <div
        ref={viewerRef}
        className="border shadow bg-white rounded p-2  h-full mx-auto overflow-hidden"
      />
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
      {error && <div className="text-red-600 absolute top-4">{error}</div>}
    </div>
  );
};

export default EpubReader;
