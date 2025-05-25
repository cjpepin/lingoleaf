
import { useVocabWords } from "@/hooks/useVocabWords";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

const VocabWords = ({ folderId }: { folderId: string | null }) => {
  const { user } = useAuth();
  const { words, addWord, removeWord, updateNote, loading } = useVocabWords(folderId);
  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newNote, setNewNote] = useState("");

  if (loading) {
    return <div className="text-gray-400">Loading…</div>;
  }
  return (
    <div>
      <div className="mb-2 flex flex-col sm:flex-row items-start gap-3 sm:items-end justify-between">
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newWord.trim() || !newTranslation.trim()) {
              toast({ title: "Provide both word and translation" });
              return;
            }
            await addWord(newWord.trim(), newTranslation.trim(), newNote.trim());
            setNewWord("");
            setNewTranslation("");
            setNewNote("");
          }}
        >
          <input
            className="border rounded px-2 py-1"
            value={newWord}
            onChange={e => setNewWord(e.target.value)}
            placeholder="Word"
            maxLength={80}
            required
          />
          <input
            className="border rounded px-2 py-1"
            value={newTranslation}
            onChange={e => setNewTranslation(e.target.value)}
            placeholder="Translation"
            maxLength={80}
            required
          />
          <input
            className="border rounded px-2 py-1 sm:w-32"
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={180}
          />
          <Button type="submit" variant="default">
            + Add
          </Button>
        </form>
      </div>
      <table className="w-full mt-3 border text-sm bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 font-medium text-left">Word</th>
            <th className="p-2 font-medium text-left">Translation</th>
            <th className="p-2 font-medium text-left">Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {words?.map((w) => (
            <tr key={w.id}>
              <td className="p-2">{w.word}</td>
              <td className="p-2">{w.translation}</td>
              <td className="p-2">
                <input
                  className="border rounded px-1 py-0.5 w-full"
                  defaultValue={w.context ?? ""}
                  onBlur={e => updateNote(w.id, e.target.value)}
                />
              </td>
              <td className="p-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeWord(w.id)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
          {words?.length === 0 && (
            <tr>
              <td colSpan={4} className="p-2 text-gray-400 text-center">
                No words found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default VocabWords;
