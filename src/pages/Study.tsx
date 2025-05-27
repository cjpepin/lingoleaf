
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import FlashcardQuiz from "@/components/study/FlashcardQuiz";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const Study = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Parse folderId from query
  const query = new URLSearchParams(location.search);
  const folderIdRaw = query.get("folderId");
  const folderId = folderIdRaw === "all-words" ? null : folderIdRaw;

  const [mode, setMode] = useState<"word" | "translation">("word");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-[#f8fafc] min-h-screen">
        <Navbar authenticated={false} />
        <main className="max-w-xl mx-auto py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-6 text-green-800">
            Study Your Vocabulary
          </h2>
          <p className="mb-6 text-lg text-gray-700">
            Please sign in to use flashcard study.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={true} />
      <main className="max-w-2xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-bold mb-2 text-green-900">Study (Flashcards)</h2>
        <div className="flex gap-4 items-center my-4">
          <label className="flex items-center gap-2 font-medium text-gray-800">
            <span>Front of card:</span>
            <span>Your Language</span>
            <Switch
              checked={mode === "translation"}
              onCheckedChange={val => setMode(val ? "translation" : "word")}
            />
            <span>Learning Language</span>
          </label>
        </div>
        <FlashcardQuiz folderId={folderId} mode={mode} />
      </main>
    </div>
  );
};

export default Study;
