import { useState, useEffect } from 'react';
import { useChartStore } from '../../store/chartStore';

export const BacktestingPanel = () => {
  const {
    isBacktesting,
    fullCandlestickData,
    backtestingIndex,
    startBacktesting,
    stopBacktesting,
    setBacktestingIndex,
    channelPattern,
    recommendedEntries,
  } = useChartStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1); // 캔들 / 초
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEntryDetails, setShowEntryDetails] = useState(false);

  // 자동 재생
  useEffect(() => {
    if (!isBacktesting || !isPlaying) return;

    const interval = setInterval(() => {
      if (backtestingIndex >= fullCandlestickData.length - 1) {
        setIsPlaying(false);
        return;
      }

      setBacktestingIndex(backtestingIndex + 1);
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
  }, [isBacktesting, isPlaying, backtestingIndex, fullCandlestickData.length, playSpeed, setBacktestingIndex]);

  const handleStart = () => {
    startBacktesting();
  };

  const handleStop = () => {
    stopBacktesting();
    setIsPlaying(false);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setBacktestingIndex(value);
  };

  const handleStepBack = () => {
    if (backtestingIndex > 50) {
      setBacktestingIndex(backtestingIndex - 1);
    }
  };

  const handleStepForward = () => {
    if (backtestingIndex < fullCandlestickData.length - 1) {
      setBacktestingIndex(backtestingIndex + 1);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // 현재 시점의 날짜 표시
  const getCurrentTime = () => {
    if (!isBacktesting || fullCandlestickData.length === 0) return '';
    const candle = fullCandlestickData[backtestingIndex];
    return new Date(candle.time * 1000).toLocaleString();
  };

  // 패턴별 추천 전략 설명
  const getStrategyDescription = () => {
    switch (channelPattern) {
      case 'ascending':
        return '상승 추세 - 저점채널 진입 (가격 > MA200)';
      case 'descending':
        return '하락 추세 - 고점채널 진입 (가격 < MA200)';
      default:
        return '추세 분석 중...';
    }
  };

  if (!isBacktesting) {
    return (
      <div className="bg-gray-800 rounded-lg mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700 transition rounded-lg"
        >
          <h2 className="text-xl font-semibold text-blue-400">📊 백테스팅</h2>
          <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4">
            <p className="text-gray-300 mb-4 text-sm">
              현재 차트를 스냅샷으로 저장하고, 원하는 시점으로 이동하여 당시의 추천 전략을 확인할 수 있습니다.
            </p>
            <button
              onClick={handleStart}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              백테스팅 시작
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg mb-4 border-2 border-blue-500">
      <div className="flex justify-between items-center p-3 bg-blue-900/30">
        <h2 className="text-lg font-semibold text-blue-400">📊 백테스팅 모드</h2>
        <button
          onClick={handleStop}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded text-sm transition"
        >
          종료
        </button>
      </div>

      <div className="p-4">
        {/* 현재 시점 및 전략 - 그리드 레이아웃 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 현재 시점 */}
          <div className="p-3 bg-gray-700 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">현재 시점</div>
            <div className="text-sm font-semibold text-white">{getCurrentTime()}</div>
            <div className="text-xs text-gray-400 mt-1">
              {backtestingIndex + 1} / {fullCandlestickData.length}
            </div>
          </div>

          {/* 추천 전략 */}
          <div className="p-3 bg-gray-700 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">추천 전략</div>
            <div className={`text-sm font-semibold ${
              channelPattern === 'ascending' ? 'text-green-400' :
              channelPattern === 'descending' ? 'text-red-400' :
              'text-gray-500'
            }`}>
              {channelPattern === 'ascending' ? '상승 (저점채널)' :
               channelPattern === 'descending' ? '하락 (고점채널)' : '분석 중'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {recommendedEntries.length}개 진입점
            </div>
          </div>
        </div>

        {/* 추천 진입점 - 토글 가능 */}
        {recommendedEntries.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowEntryDetails(!showEntryDetails)}
              className="w-full flex justify-between items-center p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm"
            >
              <span className="text-gray-300">진입점 상세</span>
              <span className="text-gray-400">{showEntryDetails ? '▼' : '▶'}</span>
            </button>

            {showEntryDetails && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {recommendedEntries.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm ${
                      entry.type === 'long' ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">
                        {entry.type === 'long' ? '🔼 롱' : '🔻 숏'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {entry.priority === 'primary' ? '주' : '보조'}
                      </span>
                    </div>
                    <div className="text-lg font-bold mt-1">
                      ${entry.price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 슬라이더 */}
        <div className="mb-3">
          <input
            type="range"
            min="50"
            max={fullCandlestickData.length - 1}
            value={backtestingIndex}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                ((backtestingIndex - 50) / (fullCandlestickData.length - 51)) * 100
              }%, #4b5563 ${
                ((backtestingIndex - 50) / (fullCandlestickData.length - 51)) * 100
              }%, #4b5563 100%)`,
            }}
          />
        </div>

        {/* 컨트롤 버튼 */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          <button
            onClick={handleStepBack}
            disabled={backtestingIndex <= 50}
            className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 rounded text-sm transition"
          >
            ◀
          </button>
          <button
            onClick={handlePlayPause}
            className="col-span-5 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded text-sm transition"
          >
            {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
          </button>
          <button
            onClick={handleStepForward}
            disabled={backtestingIndex >= fullCandlestickData.length - 1}
            className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 rounded text-sm transition"
          >
            ▶
          </button>
        </div>

        {/* 재생 속도 조절 */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-gray-400">속도:</span>
          {[0.5, 1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={`px-2 py-1 rounded text-xs ${
                playSpeed === speed ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              } transition`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
