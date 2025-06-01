
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

interface AdminBookUploadModalProps {
  onSuccess: () => void;
}

const AdminBookUploadModal = ({ onSuccess }: AdminBookUploadModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    file: undefined as File | undefined,
    image: undefined as File | undefined,
    notes: "",
    accessLevel: "free" as "free" | "paid",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    if (!form.title || !form.file) {
      toast({
        title: "Upload Failed",
        description: "Please fill out the book title and select a book file.",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const fileExt = form.file.name.split(".").pop();
    const bookId = crypto.randomUUID();
    
    // Use different bucket based on access level
    const bucketName = form.accessLevel === 'free' ? 'public-books' : 'private-books';
    const filePath = `admin/${bookId}.${fileExt}`;

    // Upload book file
    const { error: fileError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, form.file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (fileError) {
      toast({
        title: "File Upload Failed",
        description: fileError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    // Handle cover image upload
    let cover_image_url: string | null = null;
    if (form.image) {
      const imageExt = form.image.name.split(".").pop();
      const imagePath = `admin/${bookId}-cover.${imageExt}`;
      const { error: imgError } = await supabase.storage
        .from("covers")
        .upload(imagePath, form.image, {
          cacheControl: "3600",
          upsert: false,
        });
      if (!imgError) {
        const { data } = supabase.storage.from("covers").getPublicUrl(imagePath);
        cover_image_url = data?.publicUrl || null;
      }
    }

    // Insert into books table
    const { error: insertError } = await supabase
      .from("books")
      .insert([
        {
          id: bookId,
          owner_id: null, // Admin books have no owner
          title: form.title,
          file_path: filePath,
          cover_image_url,
          notes: form.notes || null,
          access_level: form.accessLevel,
        },
      ]);

    if (insertError) {
      toast({
        title: "Database Insert Failed",
        description: insertError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    toast({
      title: "Upload Successful",
      description: "Admin book uploaded successfully!",
    });

    setForm({
      title: "",
      file: undefined,
      image: undefined,
      notes: "",
      accessLevel: "free",
    });
    setUploading(false);
    setIsOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Upload Admin Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Admin Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <Input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              required
              disabled={uploading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Level *
            </label>
            <Select
              value={form.accessLevel}
              onValueChange={(value) => setForm(f => ({ ...f, accessLevel: value as "free" | "paid" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free (Public Library)</SelectItem>
                <SelectItem value="paid">Paid (Premium Library)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book File *
            </label>
            <Input
              type="file"
              accept=".pdf,.epub,.txt"
              onChange={(e) => setForm(f => ({
                ...f,
                file: e.target.files ? e.target.files[0] : undefined,
              }))}
              required
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setForm(f => ({
                ...f,
                image: e.target.files ? e.target.files[0] : undefined,
              }))}
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
              disabled={uploading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookUploadModal;
