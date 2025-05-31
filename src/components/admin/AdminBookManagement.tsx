
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus } from "lucide-react";

const AdminBookManagement = () => {
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch all books (admin can see all)
  const { data: books, isLoading } = useQuery({
    queryKey: ["adminBooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // Update book access level
  const updateBookMutation = useMutation({
    mutationFn: async ({ bookId, updates }: { bookId: string; updates: any }) => {
      const { error } = await supabase
        .from("books")
        .update(updates)
        .eq("id", bookId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBooks"] });
      toast({ title: "Book updated successfully" });
      setEditingBook(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Delete book
  const deleteBookMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", bookId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBooks"] });
      toast({ title: "Book deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Delete failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleUpdateAccessLevel = (bookId: string, accessLevel: string) => {
    updateBookMutation.mutate({ 
      bookId, 
      updates: { access_level: accessLevel } 
    });
  };

  const handleDeleteBook = (bookId: string) => {
    if (window.confirm("Are you sure you want to delete this book?")) {
      deleteBookMutation.mutate(bookId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading books...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Book Management</CardTitle>
          <Button onClick={() => setIsAddingBook(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Admin Book
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {books?.map((book) => (
            <div key={book.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h3 className="font-semibold">{book.title}</h3>
                <p className="text-sm text-gray-600">
                  Owner: {book.owner_id ? "User Upload" : "Admin Upload"}
                </p>
                <p className="text-sm text-gray-600">
                  Access: {book.access_level}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Select
                  value={book.access_level}
                  onValueChange={(value) => handleUpdateAccessLevel(book.id, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBook(book)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteBook(book.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {books?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No books found. Add your first admin book!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminBookManagement;
