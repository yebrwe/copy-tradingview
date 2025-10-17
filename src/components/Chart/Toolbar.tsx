import { useChartStore } from '../../store/chartStore';

interface ToolbarProps {
  onSettingsClick?: () => void;
}

export const Toolbar = ({ onSettingsClick }: ToolbarProps) => {
  const { connectMajorPeaks, connectMajorLows, channelPattern } = useChartStore();

  const patternLabels: Record<string, { label: string; color: string }> = {
    ascending: { label: '상승 채널 (Ascending)', color: 'text-green-400' },
    descending: { label: '하락 채널 (Descending)', color: 'text-red-400' },
    symmetrical: { label: '대칭 수렴 (Symmetrical)', color: 'text-yellow-400' },
    ranging: { label: '횡보 (Ranging)', color: 'text-gray-400' },
    none: { label: '패턴 없음', color: 'text-gray-500' },
  };

  const currentPattern = patternLabels[channelPattern] || patternLabels.none;

  return (
    <div className="flex items-center justify-between bg-[#1e222d] border border-[#2a2e39] p-3 rounded-lg">
      {/* 패턴 정보 */}
      <div className="text-sm">
        <span className="text-gray-400 font-medium">채널 패턴</span>
        <span className="mx-2 text-gray-600">|</span>
        <span className={`font-semibold ${currentPattern.color}`}>
          {currentPattern.label}
        </span>
      </div>

      {/* 알림 설정 버튼 */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
        >
          알림 설정
        </button>
      )}
    </div>
  );
};
