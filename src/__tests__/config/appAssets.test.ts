import fs from 'fs';
import path from 'path';

interface PngDimensions {
  width: number;
  height: number;
}

const PNG_HEADER_LENGTH = 24;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PROJECT_ROOT = process.cwd();

function readPngDimensions(assetPath: string): PngDimensions {
  const file = fs.readFileSync(assetPath);

  expect(file.length).toBeGreaterThanOrEqual(PNG_HEADER_LENGTH);
  expect(file.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

describe('app icon assets', () => {
  it('uses square png assets for Expo app icons', () => {
    const appConfigPath = path.join(PROJECT_ROOT, 'app.json');
    const config = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    const iconPaths = [
      config.expo.icon,
      config.expo.android.adaptiveIcon.foregroundImage,
    ] as string[];

    iconPaths.forEach((assetPath) => {
      const absolutePath = path.join(PROJECT_ROOT, assetPath);
      const { width, height } = readPngDimensions(absolutePath);

      expect(width).toBe(height);
      expect(width).toBeGreaterThanOrEqual(512);
    });
  });
});
