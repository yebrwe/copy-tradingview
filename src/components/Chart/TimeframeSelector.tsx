import { useChartStore } from '../../store/chartStore';
import type { TimeFrame } from '../../types/trading.types';

const timeframes: TimeFrame[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w', '1M'];

export const TimeframeSelector = () => {
  const { timeFrame, setTimeFrame } = useChartStore();

  return (
    <div className="flex gap-1 bg-gray-800 p-2 rounded">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeFrame(tf)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            timeFrame === tf
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
};
