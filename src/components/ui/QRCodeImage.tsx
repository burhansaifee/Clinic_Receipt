import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeImageProps {
  text: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const QRCodeImage: React.FC<QRCodeImageProps> = ({ text, size = 110, className, style }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!text || !text.trim()) {
      setDataUrl('');
      return;
    }
    // Set 3x scale for crystal-clear resolution on printouts
    QRCode.toDataURL(text, { width: size * 3, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => setDataUrl(url))
      .catch(err => console.error('Failed to generate QR code:', err));
  }, [text, size]);

  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt="QR Code"
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        ...style,
      }}
    />
  );
};

export default QRCodeImage;
