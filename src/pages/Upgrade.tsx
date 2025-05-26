
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Upgrade = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <Navbar authenticated={true} />
      <main className="max-w-xl mx-auto py-16 px-4 text-center">
        <h1 className="text-3xl font-bold mb-8 text-green-900">Upgrade to Premium</h1>
        <p className="mb-6 text-lg text-gray-700">
          Unlock unlimited book uploads and premium language tools!
        </p>
        <Button
          className="text-lg px-6 py-3 bg-green-700 hover:bg-green-800"
          onClick={() => alert("Stripe integration coming soon!")}
        >
          Upgrade with Stripe
        </Button>
        <div className="mt-8 text-gray-500 text-xs">
          Already a premium user? <span className="underline cursor-pointer" onClick={() => navigate("/account")}>Manage your account</span>.
        </div>
      </main>
    </div>
  );
};

export default Upgrade;
