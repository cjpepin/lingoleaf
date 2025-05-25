
const EpubPlaceholder = () => (
  <div className="flex flex-col items-center justify-center min-h-[200px] border rounded shadow bg-white p-4">
    <p className="text-lg font-bold mb-2 text-green-800">EPUB Reader coming soon</p>
    <p className="text-gray-600 text-center">
      EPUB highlighting and vocab/translation features are part of our roadmap.
    </p>
    <p className="text-xs text-gray-400 mt-2">
      (Native EPUB parsing is not available in browsers without third-party libraries. Contact us if you want to prioritize this feature!)
    </p>
  </div>
);
export default EpubPlaceholder;
