
// This wrapper chooses between simple iframe OR our interactive highlighter if enabled
import PdfHighlighter from "./PdfHighlighter";

type PdfRendererProps = {
  fileUrl: string;
  title?: string;
};

const PdfRenderer = ({ fileUrl, title }: PdfRendererProps) => {
  // For now, always use the PdfHighlighter so user can select/highlight
  return <PdfHighlighter fileUrl={fileUrl} pageNum={1} />;
};

export default PdfRenderer;
