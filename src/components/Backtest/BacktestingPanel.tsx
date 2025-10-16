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
        return '상승 채널 - 저점채널 롱 진입 추천';
      case 'descending':
        return '하락 채널 - 고점채널 숏 진입 추천';
      case 'symmetrical':
        return '대칭 수렴 - 돌파 대기';
      case 'ranging':
        return '횡보 - 채널 내 양방향 거래';
      default:
        return '패턴 분석 중...';
    }
  };

  if (!isBacktesting) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-3 text-blue-400">📊 백테스팅</h2>
        <p className="text-gray-300 mb-4">
          현재 차트를 스냅샷으로 저장하고, 원하는 시점으로 이동하여 당시의 추천 전략을 확인할 수 있습니다.
        </p>
        <button
          onClick={handleStart}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition"
        >
          백테스팅 시작
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border-2 border-blue-500">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-blue-400">📊 백테스팅 모드</h2>
        <button
          onClick={handleStop}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          종료
        </button>
      </div>

      {/* 현재 시점 표시 */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-400 mb-1">현재 시점</div>
        <div className="text-lg font-semibold text-white">{getCurrentTime()}</div>
        <div className="text-sm text-gray-400 mt-1">
          {backtestingIndex + 1} / {fullCandlestickData.length} 캔들
        </div>
      </div>

      {/* 추천 전략 표시 */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">추천 전략</div>
        <div className={`text-lg font-semibold mb-2 ${
          channelPattern === 'ascending' ? 'text-green-400' :
          channelPattern === 'descending' ? 'text-red-400' :
          channelPattern === 'symmetrical' ? 'text-yellow-400' :
          channelPattern === 'ranging' ? 'text-gray-400' :
          'text-gray-500'
        }`}>
          {getStrategyDescription()}
        </div>

        {/* 추천 진입점 표시 */}
        {recommendedEntries.length > 0 && (
          <div className="space-y-2 mt-3">
            {recommendedEntries.map((entry, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  entry.type === 'long' ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {entry.type === 'long' ? '🔼 롱' : '🔻 숏'} 진입
                  </span>
                  <span className="text-sm text-gray-400">
                    {entry.channel === 'high' ? '고점채널' : '저점채널'}
                  </span>
                </div>
                <div className="text-xl font-bold mt-1">
                  ${entry.price.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {entry.priority === 'primary' ? '주 전략' : '보조 전략'}
                </div>
              </div>
            ))}
          </div>
        )}

        {recommendedEntries.length === 0 && channelPattern === 'symmetrical' && (
          <div className="text-sm text-gray-400 mt-2">
            ⚠️ 대칭 수렴 패턴은 돌파 방향이 불확실하므로 진입점을 추천하지 않습니다.
          </div>
        )}
      </div>

      {/* 슬라이더 */}
      <div className="mb-4">
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
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleStepBack}
          disabled={backtestingIndex <= 50}
          className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          ◀ 이전
        </button>
        <button
          onClick={handlePlayPause}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
        </button>
        <button
          onClick={handleStepForward}
          disabled={backtestingIndex >= fullCandlestickData.length - 1}
          className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          다음 ▶
        </button>
      </div>

      {/* 재생 속도 조절 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">재생 속도:</span>
        <button
          onClick={() => setPlaySpeed(0.5)}
          className={`px-3 py-1 rounded ${playSpeed === 0.5 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
        >
          0.5x
        </button>
        <button
          onClick={() => setPlaySpeed(1)}
          className={`px-3 py-1 rounded ${playSpeed === 1 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
        >
          1x
        </button>
        <button
          onClick={() => setPlaySpeed(2)}
          className={`px-3 py-1 rounded ${playSpeed === 2 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
        >
          2x
        </button>
        <button
          onClick={() => setPlaySpeed(5)}
          className={`px-3 py-1 rounded ${playSpeed === 5 ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'}`}
        >
          5x
        </button>
      </div>
    </div>
  );
};
