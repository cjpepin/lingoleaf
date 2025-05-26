
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { BadgeDollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const UPGRADE_TEXT = "Upgrade to Premium";
const BENEFITS = [
  "Unlimited book uploads",
  "Read ALL library books",
  "Unlimited vocab folders",
  "Premium language tools",
];

const UpgradeModal = () => {
  const { isOpen, closeModal } = useUpgradeModal();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Start Stripe Checkout
  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {},
      });
      if (error || !data?.url) {
        throw new Error(error?.message || "Could not start checkout");
      }
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({
        title: "Stripe upgrade failed",
        description: err.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeDollarSign className="text-green-600" /> {UPGRADE_TEXT}
          </DialogTitle>
          <DialogDescription>
            Unlock access to premium features and more by upgrading your LinguaLeaf account.
          </DialogDescription>
        </DialogHeader>
        <ul className="my-4 list-disc list-inside text-green-800">
          {BENEFITS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            onClick={handleUpgrade}
            className="bg-green-700 hover:bg-green-800 w-full"
            disabled={loading}
          >
            {loading ? "Starting Stripe Checkout..." : "Upgrade with Stripe"}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" className="w-full mt-2">Maybe later</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
