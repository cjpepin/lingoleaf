
type PdfRendererProps = {
  fileUrl: string;
  title?: string;
};

const PdfRenderer = ({ fileUrl, title }: PdfRendererProps) => (
  <iframe
    src={fileUrl}
    title={title ?? ""}
    className="w-full min-h-[70vh] bg-white border"
  />
);

export default PdfRenderer;
