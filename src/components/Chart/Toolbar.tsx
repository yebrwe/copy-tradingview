import { useChartStore } from '../../store/chartStore';

export const Toolbar = () => {
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
    <div className="flex items-center gap-3 bg-gray-800 p-3 rounded">
      {/* 채널 그리기 버튼들 */}
      <button
        onClick={connectMajorPeaks}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition"
        title="6시간 & 15일 고점을 연결한 채널 생성"
      >
        고점 채널 그리기
      </button>

      <button
        onClick={connectMajorLows}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition"
        title="6시간 & 15일 저점을 연결한 채널 생성"
      >
        저점 채널 그리기
      </button>

      {/* 구분선 */}
      <div className="h-8 w-px bg-gray-600" />

      {/* 패턴 정보 */}
      <div className="text-sm">
        <span className="text-gray-400">채널 패턴:</span>{' '}
        <span className={`font-semibold ${currentPattern.color}`}>
          {currentPattern.label}
        </span>
      </div>
    </div>
  );
};
