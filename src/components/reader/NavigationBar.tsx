
import { Button } from "@/components/ui/button";

type NavigationBarProps = {
  currentPage: number;
  onPrev: () => void;
  onNext: () => void;
};

const NavigationBar = ({ currentPage, onPrev, onNext }: NavigationBarProps) => (
  <div className="flex items-center gap-2 mb-8">
    <Button
      size="sm"
      variant="outline"
      disabled={currentPage <= 1}
      onClick={onPrev}
    >
      Previous
    </Button>
    <span>Page {currentPage}</span>
    <Button
      size="sm"
      variant="outline"
      onClick={onNext}
    >
      Next
    </Button>
  </div>
);

export default NavigationBar;
