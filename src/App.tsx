
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Index from "@/pages/Index";
import Library from "@/pages/Library";
import Upload from "@/pages/Upload";
import Vocab from "@/pages/Vocab";
import Study from "@/pages/Study";
import ReadBook from "@/pages/ReadBook";
import Account from "@/pages/Account";
import Upgrade from "@/pages/Upgrade";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import AdSenseScript from "@/components/ads/AdSenseScript";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AdSenseScript />
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/library" element={<Library />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/vocab" element={<Vocab />} />
            <Route path="/study" element={<Study />} />
            <Route path="/read/:bookId" element={<ReadBook />} />
            <Route path="/account" element={<Account />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
