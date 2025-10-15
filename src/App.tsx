import { TradingChart } from './components/Chart/TradingChart';
import { TimeframeSelector } from './components/Chart/TimeframeSelector';
import { Toolbar } from './components/Chart/Toolbar';
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket';
import { useChartStore } from './store/chartStore';

function App() {
  // 바이낸스 데이터 로드
  useBinanceWebSocket();

  const { symbol, timeFrame, highChannelEntryPoints } = useChartStore();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-[1600px] mx-auto">
        {/* 헤더 */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2">트레이딩뷰 차트 복제</h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-lg">
              <span className="text-gray-400">심볼:</span>{' '}
              <span className="font-semibold text-green-400">{symbol}</span>
            </div>
            <div className="text-lg">
              <span className="text-gray-400">타임프레임:</span>{' '}
              <span className="font-semibold text-blue-400">{timeFrame}</span>
            </div>
            {highChannelEntryPoints.shortEntry !== null && (
              <>
                <div className="h-6 w-px bg-gray-600" />
                <div className="text-lg">
                  <span className="text-gray-400">숏 진입:</span>{' '}
                  <span className="font-semibold text-red-400">
                    ${highChannelEntryPoints.shortEntry.toFixed(2)}
                  </span>
                </div>
                <div className="text-lg">
                  <span className="text-gray-400">롱 진입:</span>{' '}
                  <span className="font-semibold text-green-400">
                    ${highChannelEntryPoints.longEntry?.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 툴바 */}
        <div className="mb-4 flex gap-4">
          <Toolbar />
          <TimeframeSelector />
        </div>

        {/* 차트 영역 */}
        <div className="relative bg-chart-bg rounded-lg overflow-hidden shadow-2xl">
          <TradingChart />
        </div>

        {/* 사용법 안내 */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">사용법</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>타임프레임 버튼을 클릭하여 차트 시간 간격을 변경할 수 있습니다</li>
            <li>그리기 도구를 선택한 후 차트에 드래그하여 추세선, 수평선, 사각형을 그릴 수 있습니다</li>
            <li>실시간 가격 데이터가 바이낸스 WebSocket을 통해 업데이트됩니다</li>
            <li>'모두 삭제' 버튼으로 그린 도형들을 제거할 수 있습니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
