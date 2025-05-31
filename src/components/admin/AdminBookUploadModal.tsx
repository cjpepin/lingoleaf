
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AdminBookUploadModalProps {
  onSuccess: () => void;
}

const AdminBookUploadModal = ({ onSuccess }: AdminBookUploadModalProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    file: undefined as File | undefined,
    image: undefined as File | undefined,
    notes: "",
    accessLevel: "free" as "free" | "paid" | "personal",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
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

    try {
      // Generate unique file paths
      const fileExt = form.file.name.split(".").pop();
      const bookId = crypto.randomUUID();
      const filePath = `admin/${bookId}.${fileExt}`;

      // Upload book file
      const { error: fileError } = await supabase.storage
        .from("books")
        .upload(filePath, form.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (fileError) throw fileError;

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
        
        if (imgError) throw imgError;
        
        const { data } = supabase.storage.from("covers").getPublicUrl(imagePath);
        cover_image_url = data?.publicUrl || null;
      }

      // Insert book metadata
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

      if (insertError) throw insertError;

      toast({
        title: "Admin Book Uploaded",
        description: "Book has been successfully added to the library!",
      });

      // Reset form and close modal
      setForm({
        title: "",
        file: undefined,
        image: undefined,
        notes: "",
        accessLevel: "free",
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Admin Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Admin Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="admin-title">Title *</Label>
            <Input
              id="admin-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              required
              disabled={uploading}
            />
          </div>
          
          <div>
            <Label htmlFor="admin-file">Book File *</Label>
            <Input
              id="admin-file"
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
            <Label htmlFor="admin-image">Cover Image</Label>
            <Input
              id="admin-image"
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
            <Label htmlFor="admin-access">Access Level</Label>
            <Select
              value={form.accessLevel}
              onValueChange={(value: "free" | "paid" | "personal") => 
                setForm(f => ({ ...f, accessLevel: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="admin-notes">Notes</Label>
            <Textarea
              id="admin-notes"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              disabled={uploading}
              rows={3}
            />
          </div>
          
          <div className="flex gap-2">
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading ? "Uploading..." : "Upload Book"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookUploadModal;
