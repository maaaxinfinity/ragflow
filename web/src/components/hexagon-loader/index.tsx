import { useEffect, useState } from 'react';
import { useIsDarkTheme } from '@/components/theme-provider';
import './index.css';

interface HexagonLoaderProps {
  completed?: boolean;
  size?: number;
  className?: string;
}

export default function HexagonLoader({
  completed = false,
  size = 160,
  className = '',
}: HexagonLoaderProps) {
  const isDarkTheme = useIsDarkTheme();
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (completed) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsFinished(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsFinished(false);
    }
  }, [completed]);

  const scale = size / 160; // Original size is 160px

  return (
    <div
      className={`hexagon-loader-wrapper ${className}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      <div className={`loader ${isFinished ? 'finished' : ''} ${isDarkTheme ? 'dark' : 'light'}`}>
        <ul className="hexagon-container">
          <li className="hexagon hex_1"></li>
          <li className="hexagon hex_2"></li>
          <li className="hexagon hex_3"></li>
          <li className="hexagon hex_4"></li>
          <li className="hexagon hex_5"></li>
          <li className="hexagon hex_6"></li>
          <li className="hexagon hex_7"></li>
        </ul>
      </div>
    </div>
  );
}
