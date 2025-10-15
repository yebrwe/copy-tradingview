import { useChartStore } from '../../store/chartStore';
import type { DrawingTool } from '../../types/trading.types';

const tools: { id: DrawingTool; label: string; icon: string }[] = [
  { id: 'none', label: '선택', icon: '🖱️' },
  { id: 'trendline', label: '추세선', icon: '📈' },
  { id: 'horizontal', label: '수평선', icon: '➖' },
  { id: 'rectangle', label: '사각형', icon: '▭' },
];

export const Toolbar = () => {
  const { selectedTool, setSelectedTool, clearDrawings, connectMajorPeaks, connectMajorLows } = useChartStore();

  return (
    <div className="flex items-center gap-2 bg-gray-800 p-2 rounded">
      <div className="flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              selectedTool === tool.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={tool.label}
          >
            {tool.icon} {tool.label}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-gray-600" />

      <button
        onClick={connectMajorPeaks}
        className="px-3 py-2 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
        title="최근 6시간과 15일 최고점을 연결하여 채널을 생성합니다"
      >
        ⚡ 고점 채널 (6h-15d)
      </button>

      <button
        onClick={connectMajorLows}
        className="px-3 py-2 rounded text-sm font-medium bg-pink-600 text-white hover:bg-pink-700 transition-colors"
        title="최근 6시간과 15일 최저점을 연결하여 채널을 생성합니다"
      >
        ⚡ 저점 채널 (6h-15d)
      </button>

      <button
        onClick={clearDrawings}
        className="px-3 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
        🗑️ 모두 삭제
      </button>
    </div>
  );
};
