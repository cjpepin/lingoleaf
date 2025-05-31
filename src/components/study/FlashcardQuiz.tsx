
import React, { useState, useEffect } from "react";
import { useVocabWords } from "@/hooks/useVocabWords";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type FlashcardQuizProps = {
  folderId: string | null;
  mode: "word" | "translation";
};

const shuffle = <T,>(a: T[]): T[] => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const FlashcardQuiz = ({ folderId, mode }: FlashcardQuizProps) => {
  const { words, loading } = useVocabWords(folderId);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [flipping, setFlipping] = useState(false); // for flip animation
  const [correct, setCorrect] = useState<number[]>([]);
  const [missed, setMissed] = useState<number[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (words && words.length > 0) {
      setOrder(shuffle(words.map((_, i) => i)));
      setIdx(0);
      setShowBack(false);
      setCorrect([]);
      setMissed([]);
    }
    if (!folderId) {
      navigate("/vocab");
    }
  }, [words]);

  if (loading) {
    return <div className="text-gray-400">Loading words…</div>;
  }
  if (!words || words.length === 0) {
    return <div className="text-gray-400">No vocab found in this folder.</div>;
  }
  if (idx >= order.length) {
    return (
      <div className="p-6 text-center">
        <div className="mb-4 font-bold text-lg text-green-700">Done!</div>
        <div className="mb-2">You studied {order.length} cards.</div>
        <div className="mb-3 text-sm text-gray-600">
          Known: <span className="text-green-600 font-bold">{correct.length}</span> &nbsp;|&nbsp;
          Missed: <span className="text-red-500 font-bold">{missed.length}</span>
        </div>
        <Button onClick={() => setIdx(0)}>Restart</Button>
      </div>
    );
  }

  const w = words[order[idx]];

  // Bug fix: flip logic for displaying correct content
  const showFrontText = mode === "word" ? w.word : w.translation;
  const showBackText = mode === "word" ? w.translation : w.word;

  // Animating flip
  const handleFlip = () => {
    setFlipping(true);
    setTimeout(() => {
      setShowBack((v) => !v);
      setFlipping(false);
    }, 180);
  };

  return (
    <div className="flex flex-col items-center mt-8">
      <div className="mb-6">
        <div
          className={cn(
            "relative bg-white rounded-lg shadow-xl px-10 py-8 min-w-[220px] min-h-[100px] text-center select-none cursor-pointer border border-gray-200 hover:bg-green-50 transition-all transform-style-3d animate-fade-in",
            "flip-card",
            flipping ? "animate-[flip_0.36s]" : "",
            showBack ? "rotate-y-180" : ""
          )}
          style={{
            perspective: "1000px",
            transition: "transform 0.36s cubic-bezier(0.4,0,0.2,1)",
            transform: flipping
              ? "rotateY(180deg)"
              : showBack
              ? "rotateY(180deg)"
              : "rotateY(0deg)",
          }}
          onClick={handleFlip}
        >
          <span
            className={cn(
              "text-xl font-semibold absolute inset-0 flex justify-center items-center",
              "transition-opacity duration-150",
              showBack ? "opacity-0" : "opacity-100"
            )}
            style={{
              backfaceVisibility: "hidden",
            }}
          >
            {showFrontText}
          </span>
          <span
            className={cn(
              "text-xl font-semibold absolute inset-0 flex justify-center items-center",
              "transition-opacity duration-150",
              showBack ? "opacity-100" : "opacity-0"
            )}
            style={{
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
            }}
          >
            {showBackText}
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-400 italic">
          Click card to flip
        </div>
        {w.context && (
          <div className="mt-3 text-sm text-gray-500">Note: {w.context}</div>
        )}
      </div>
      {!showBack ? (
        <Button variant="secondary" onClick={() => setShowBack(true)}>
          Show Answer
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              setCorrect(c => [...c, idx]);
              setShowBack(false);
              setIdx(i => i + 1);
            }}>
            I knew it
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setMissed(m => [...m, idx]);
              setShowBack(false);
              setIdx(i => i + 1);
            }}>
            Missed it
          </Button>
        </div>
      )}
    </div>
  );
};

export default FlashcardQuiz;
