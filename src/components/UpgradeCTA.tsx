
import { Button } from "@/components/ui/button";
import { BadgeDollarSign } from "lucide-react";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

export const UpgradeCTA = ({
  message = "Unlock all features with LinguaLeaf Premium!",
  buttonText = "Upgrade to Premium",
  className = "",
}: {
  message?: string;
  buttonText?: string;
  className?: string;
}) => {
  const openModal = useUpgradeModal((s) => s.openModal);

  return (
    <div className={`rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-green-900 font-medium">
        <BadgeDollarSign className="mr-2 text-green-500" />
        <span>{message}</span>
      </div>
      <Button className="bg-green-700 hover:bg-green-800 text-white" onClick={openModal}>
        {buttonText}
      </Button>
    </div>
  );
};

export default UpgradeCTA;
