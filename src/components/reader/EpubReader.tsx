
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { translateText } from "@/utils/translate";
import { useSaveVocabWord } from "@/hooks/useSaveVocabWord";
import HighlightPopup from "./HighlightPopup";
import { useUserBookMetadata } from "@/hooks/useUserBookMetadata";

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
  const {
    currentPage,
    highlights,
    updatePage,
    updateHighlights,
  } = useUserBookMetadata(bookId);

  const [popup, setPopup] = useState({
    show: false,
    x: 0,
    y: 0,
    selectedText: "",
    rect: null as DOMRect | null,
    cfiRange: "",
  });

  const [translation, setTranslation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loadingBook, setLoadingBook] = useState(true);
  const [hoverPage, setHoverPage] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [dragPage, setDragPage] = useState<number>(currentPage);

  // Generate unique ID for highlights
  const generateHighlightId = () => {
    return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle navigation to highlight from sidebar
  useEffect(() => {
    const handleNavigateToHighlight = (event: CustomEvent) => {
      const highlight = event.detail;
      if (renditionRef.current && highlight.cfi) {
        renditionRef.current.display(highlight.cfi);
      }
    };

    const handleDeleteHighlight = (event: CustomEvent) => {
      const { id } = event.detail;
      if (renditionRef.current) {
        // Remove from EPUB.js annotations
        const existingHighlight = highlights.find((h: any) => h.id === id);
        if (existingHighlight && existingHighlight.cfi) {
          renditionRef.current.annotations.remove(existingHighlight.cfi, "highlight");
        }
      }
    };

    window.addEventListener('navigateToHighlight', handleNavigateToHighlight as EventListener);
    window.addEventListener('deleteHighlight', handleDeleteHighlight as EventListener);

    return () => {
      window.removeEventListener('navigateToHighlight', handleNavigateToHighlight as EventListener);
      window.removeEventListener('deleteHighlight', handleDeleteHighlight as EventListener);
    };
  }, [highlights]);

  // Restore highlights when component loads or highlights change
  useEffect(() => {
    if (renditionRef.current && highlights && highlights.length > 0) {
      // Clear existing annotations first
      renditionRef.current.annotations.remove(null, "highlight");
      
      // Add all highlights as annotations
      highlights.forEach((highlight: any) => {
        if (highlight.cfi) {
          renditionRef.current.annotations.add("highlight", highlight.cfi, {}, null, "hl", {
            fill: "yellow",
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply"
          });
        }
      });

      // Handle clicks on highlighted text for removal
      renditionRef.current.on("markClicked", (cfiRange: string, data: any) => {
        const highlightToRemove = highlights.find((h: any) => h.cfi === cfiRange);
        if (highlightToRemove) {
          const updatedHighlights = highlights.filter((h: any) => h.id !== highlightToRemove.id);
          updateHighlights(updatedHighlights);
          renditionRef.current.annotations.remove(cfiRange, "highlight");
        }
      });
    }
  }, [highlights, renditionRef.current]);

  const goToPage = async (prev: boolean) => {
    if (!renditionRef.current) return;
    
    try {
      const newLocation = prev 
        ? await renditionRef.current.prev() 
        : await renditionRef.current.next();

      if (newLocation && newLocation.start && newLocation.start.cfi && bookRef.current) {
        const current = bookRef.current.locations.percentageFromCfi(newLocation.start.cfi);
        const newPage = Math.round(current * (totalPages - 1)) + 1;
        setDragPage(newPage);
        updatePage(newPage);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const dragToPage = () => {
    if (bookRef.current && renditionRef.current && totalPages > 1) {
      const percentage = (dragPage - 1) / (totalPages - 1);
      const cfi = bookRef.current.locations.cfiFromPercentage(percentage);
      renditionRef.current.display(cfi);
      updatePage(dragPage);
    }
  }

  useEffect(() => {
    let rendition: any;

    const loadEpub = async () => {
      try {
        const res = await fetch(fileUrl);
        const buffer = await (await res.blob()).arrayBuffer();
        const epubjs = await import("epubjs");
        const book = epubjs.default(buffer);
        bookRef.current = book;

        const setupRendition = () => {
          const container = viewerRef.current!;
          const { width } = container.getBoundingClientRect();
          rendition = book.renderTo(container, {
            width,
            height: window.innerHeight - 160,
            flow: "paginated",
            allowScriptedContent: true,
          });
          renditionRef.current = rendition;

          rendition.on("relocated", (location: any) => {
            const current = book.locations.percentageFromCfi(location.start.cfi);
            const currentPage = Math.round(current * (totalPages - 1)) + 1;
            setDragPage(currentPage);
            updatePage(currentPage);
          });

          rendition.on("rendered", () => setupSelectionHandlers(rendition));
        };

        await book.ready;
        await book.locations.generate(1024);
        const length = book.locations.length() || 1;
        setTotalPages(length);
        const safePage = Math.min(currentPage, length);
        const cfi = bookRef.current.locations.cfiFromPercentage((safePage - 1) / (length - 1));
        setupRendition();
        rendition.display(cfi).then(() => {
          setLoadingBook(false)
        });
      } catch (err: any) {
        setError("Failed to load EPUB: " + (err.message || err));
      }
    };

    loadEpub();

    const handleResize = () => {
      const container = viewerRef.current;
      if (container && renditionRef.current) {
        const width = container.getBoundingClientRect().width;
        const height = window.innerHeight - 160;
        renditionRef.current.resize(width, height);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
    };
  }, [fileUrl]);

  const setupSelectionHandlers = (rendition: any) => {
    rendition.on("selected", (cfiRange: string, contents: any) => {
      const selection = contents.window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length > 120) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframe = contents.document.defaultView.frameElement;
      const iframeRect = iframe?.getBoundingClientRect() || { left: 0, top: 0 };
      const x = iframeRect.left + rect.left + rect.width / 2;
      const y = iframeRect.top + rect.top - 10;
      setPopup({ 
        show: true, 
        x, 
        y, 
        selectedText, 
        rect: new DOMRect(x, y, rect.width, rect.height),
        cfiRange 
      });
    });

    rendition.on("unselected", () => {
      setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null, cfiRange: "" });
      setTranslation(null);
    });
  };

  const handleTranslate = async (text: string) => setTranslation(await translateText(text));

  const handleSaveVocab = async (opts?: { folderId?: string | null }) => {
    if (!bookId || !popup.selectedText || !translation) return;
    await save({
      word: popup.selectedText,
      translation,
      bookId,
      bookTitle: title,
      pageNumber: currentPage,
      folderId: opts?.folderId || null,
    });
  };

  const handleHighlight = () => {
    if (!popup.cfiRange || !popup.selectedText) return;

    const highlightId = generateHighlightId();
    const newHighlight = {
      id: highlightId,
      text: popup.selectedText,
      cfi: popup.cfiRange,
      page: currentPage,
      createdAt: new Date().toISOString(),
    };

    // Add to highlights array
    updateHighlights([...highlights, newHighlight]);

    // Add annotation to EPUB.js
    renditionRef.current?.annotations.add("highlight", popup.cfiRange, {}, null, "hl", {
      fill: "yellow",
      "fill-opacity": "0.3",
      "mix-blend-mode": "multiply"
    });

    // Close popup
    setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null, cfiRange: "" });
    setTranslation(null);
  };

  return (
    <div className="h-screen flex flex-col items-center relative">
      {loadingBook && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600" />
        </div>
      )}

      <div
        ref={viewerRef}
        className="border shadow bg-white rounded h-full mx-auto overflow-hidden mt-1 w-[72vw] max-w-[950px] max-h-[calc(100vh-150px)] relative"
      />

      <div className="relative w-full px-6 mt-2 max-w-xl">
        <input
          type="range"
          min={1}
          max={totalPages}
          value={dragPage}
          onChange={(e) => {
            const val = Number(e.target.value);
            setDragPage(val);
          }}
          onMouseMove={(e) => {
            const rect = (e.target as HTMLInputElement).getBoundingClientRect();
            const offsetX = e.nativeEvent.offsetX;
            const percent = offsetX / rect.width;
            const val = Math.round(percent * (totalPages - 1)) + 1;

            setHoverPage(val);
            setHoverX(offsetX);
          }}
          onMouseLeave={() => {
            setHoverPage(null);
            setHoverX(null);
          }}
          onMouseUp={() => {
            dragToPage();
          }}
          onTouchEnd={() => {
            dragToPage();
          }}
          className="w-full accent-green-600 cursor-pointer"
        />

        {hoverPage !== null && hoverX !== null && (
          <div
            className="absolute -top-8 text-sm bg-green-600 text-white rounded px-2 py-0.5 ml-6 shadow z-50 whitespace-nowrap"
            style={{
              left: `${hoverX}px`,
              transform: "translateX(-50%)",
            }}
          >
            Page {hoverPage}
          </div>
        )}
      </div>

      {/* Page navigation controls */}
      <div className="flex items-center gap-4 mt-1">
        <button
          className="px-3 py-1 bg-gray-100 rounded border disabled:opacity-50"
          onClick={() => goToPage(true)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} {totalPages ? `of ${totalPages}` : ""}
        </span>
        <button
          className="px-3 py-1 bg-gray-100 rounded border disabled:opacity-50"
          onClick={() => goToPage(false)}
          disabled={!!totalPages && currentPage >= totalPages}
        >
          Next
        </button>
      </div>
      
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
            setPopup({ show: false, x: 0, y: 0, selectedText: "", rect: null, cfiRange: "" });
            setTranslation(null);
          }}
        />
      )}
    </div>
  );
};

export default EpubReader;
