
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Library from "./pages/Library";
import Upload from "./pages/Upload";
import Vocab from "./pages/Vocab";
import Account from "./pages/Account";
import ReadBook from "./pages/ReadBook";
import Study from "./pages/Study"; // ADD

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/library" element={<Library />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/vocab" element={<Vocab />} />
          <Route path="/study" element={<Study />} /> {/* NEW STUDY ROUTE */}
          <Route path="/account" element={<Account />} />
          <Route path="/read/:bookId" element={<ReadBook />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
