
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type EditBookModalProps = {
  book: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const EditBookModal = ({ book, isOpen, onClose, onSuccess }: EditBookModalProps) => {
  const [title, setTitle] = useState(book?.title || "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or book changes
  React.useEffect(() => {
    if (book) {
      setTitle(book.title || "");
      setCoverFile(null);
    }
  }, [book]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !title.trim()) return;
    
    setIsSubmitting(true);

    try {
      let cover_image_url = book.cover_image_url;

      // Handle cover image upload if a new file is selected
      if (coverFile) {
        const fileExt = coverFile.name.split(".").pop();
        const imagePath = `${book.owner_id}/${book.id}-cover.${fileExt}`;
        
        // Upload new cover image
        const { error: uploadError } = await supabase.storage
          .from("covers")
          .upload(imagePath, coverFile, {
            cacheControl: "3600",
            upsert: true, // Allow overwriting existing covers
          });

        if (uploadError) {
          toast({
            title: "Cover upload failed",
            description: uploadError.message,
            variant: "destructive",
          });
          return;
        }

        // Get the public URL for the new image
        const { data } = supabase.storage.from("covers").getPublicUrl(imagePath);
        cover_image_url = data?.publicUrl || book.cover_image_url;
      }

      // Update book in database
      const { error } = await supabase
        .from("books")
        .update({ 
          title: title.trim(),
          cover_image_url 
        })
        .eq("id", book.id);

      if (error) {
        toast({
          title: "Failed to update book",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Book updated successfully!" });
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter book title"
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cover">Cover Image (optional)</Label>
            <Input
              id="cover"
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              disabled={isSubmitting}
            />
            {coverFile && (
              <p className="text-sm text-gray-500">
                Selected: {coverFile.name}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Updating..." : "Update Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookModal;
