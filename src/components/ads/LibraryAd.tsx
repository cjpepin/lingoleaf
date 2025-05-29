
import GoogleAd from './GoogleAd';

interface LibraryAdProps {
  placement: 'between-books' | 'sidebar';
}

const LibraryAd = ({ placement }: LibraryAdProps) => {
  if (placement === 'between-books') {
    return (
      <div className="col-span-full my-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs text-gray-500 mb-2 text-center">Advertisement</div>
        <GoogleAd
          adSlot="2345678901" // Replace with your actual ad slot ID
          adFormat="rectangle"
          style={{ minHeight: '250px' }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
      <div className="text-xs text-gray-500 mb-2">Advertisement</div>
      <GoogleAd
        adSlot="3456789012" // Replace with your actual ad slot ID
        adFormat="rectangle"
        style={{ minHeight: '250px' }}
      />
    </div>
  );
};

export default LibraryAd;
