
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useVocabFolders } from "@/hooks/useVocabFolders";
import FlashcardQuiz from "@/components/study/FlashcardQuiz";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const Study = () => {
  const { user, loading } = useAuth();
  const { folders } = useVocabFolders();
  const [folderId, setFolderId] = useState<string | null>(null); // Default to All Words
  const [mode, setMode] = useState<"word" | "translation">("word");
  const [start, setStart] = useState(false);

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
        <div className="space-y-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div>
              <span className="font-medium mr-2">Folder:</span>
              <Select value={folderId ?? ""} onValueChange={v => setFolderId(v || null)}>
                <SelectTrigger className="w-40 min-w-[120px]">
                  <SelectValue placeholder="All Words" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-words">All Words</SelectItem>
                  {folders?.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="font-medium mr-2">Show front:</span>
              <Select value={mode} onValueChange={str => setMode(str as "word" | "translation")}>
                <SelectTrigger className="w-44 min-w-[120px]">
                  <SelectValue placeholder="Front of card" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">Your Language</SelectItem>
                  <SelectItem value="translation">Learning Language</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="md:ml-4"
              onClick={() => setStart(true)}
              disabled={start}
            >
              Start Study
            </Button>
            {start && (
              <Button
                className="md:ml-2"
                variant="outline"
                onClick={() => setStart(false)}
              >
                Change Options
              </Button>
            )}
          </div>
        </div>
        {start && (
          <FlashcardQuiz folderId={folderId} mode={mode} />
        )}
      </main>
    </div>
  );
};

export default Study;
