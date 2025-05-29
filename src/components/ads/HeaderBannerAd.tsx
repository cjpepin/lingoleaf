
import GoogleAd from './GoogleAd';

const HeaderBannerAd = () => {
  return (
    <div className="w-full bg-gray-50 border-b border-gray-200 py-2">
      <div className="max-w-5xl mx-auto px-4">
        <GoogleAd
          adSlot="1234567890" // Replace with your actual ad slot ID
          adFormat="horizontal"
          className="text-center"
          style={{ minHeight: '50px' }}
        />
      </div>
    </div>
  );
};

export default HeaderBannerAd;
