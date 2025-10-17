import { useState } from 'react';
import { TradingChart } from './components/Chart/TradingChart';
import { Toolbar } from './components/Chart/Toolbar';
import { TradingPanel } from './components/Trading/TradingPanel';
import { OrderHistoryPanel } from './components/OrderHistory/OrderHistoryPanel';
import { NotificationSettings } from './components/Settings/NotificationSettings';
import { Toast } from './components/Toast/Toast';
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket';
import { useChartStore } from './store/chartStore';

function App() {
  // 바이낸스 데이터 로드
  useBinanceWebSocket();

  const { symbol, highChannelEntryPoints, lowChannelEntryPoints, channelPattern } = useChartStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <Toast />
      <div className="max-w-[1600px] mx-auto">
        {/* 헤더 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-3xl font-bold">트레이딩뷰 차트 복제</h1>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 bg-[#2a2e39] text-gray-400 rounded hover:bg-[#363a45] hover:text-white transition-colors text-sm flex items-center gap-2"
            >
              <span>⚙️</span>
              <span>알림 설정</span>
            </button>
          </div>

          {/* 고정된 그리드 레이아웃 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-h-[80px]">
            {/* 기본 정보 */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">심볼 / 타임프레임</div>
              <div className="text-sm font-semibold text-green-400">{symbol}</div>
              <div className="text-xs text-blue-400 mt-1">1시간봉</div>
            </div>

            {/* 진입점 정보 - 패턴에 따라 표시 */}
            {channelPattern === 'ascending' ? (
              // 상승 추세 - 저점 채널
              <>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">저점채널 롱 (주)</div>
                  <div className="text-lg font-bold text-green-400">
                    ${lowChannelEntryPoints.longEntry?.toFixed(2) ?? '-'}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">저점채널 숏 (보조)</div>
                  <div className="text-lg font-bold text-red-400">
                    ${lowChannelEntryPoints.shortEntry?.toFixed(2) ?? '-'}
                  </div>
                </div>
              </>
            ) : channelPattern === 'descending' ? (
              // 하락 추세 - 고점 채널
              <>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">고점채널 숏 (주)</div>
                  <div className="text-lg font-bold text-red-400">
                    ${highChannelEntryPoints.shortEntry?.toFixed(2) ?? '-'}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">고점채널 롱 (보조)</div>
                  <div className="text-lg font-bold text-green-400">
                    ${highChannelEntryPoints.longEntry?.toFixed(2) ?? '-'}
                  </div>
                </div>
              </>
            ) : (
              // 패턴 없음 - 빈 공간 유지
              <>
                <div className="bg-gray-800 rounded-lg p-3 opacity-50">
                  <div className="text-xs text-gray-400 mb-1">진입점</div>
                  <div className="text-lg font-bold text-gray-500">-</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 opacity-50">
                  <div className="text-xs text-gray-400 mb-1">진입점</div>
                  <div className="text-lg font-bold text-gray-500">-</div>
                </div>
              </>
            )}

            {/* 추천 전략 */}
            <div className="bg-gray-800 rounded-lg p-3 flex flex-col">
              <div className="text-xs text-gray-400 mb-1">추천 전략</div>
              <div className={`text-sm font-semibold flex-1 flex items-center ${
                channelPattern === 'ascending' ? 'text-green-400' :
                channelPattern === 'descending' ? 'text-red-400' :
                'text-gray-500'
              }`}>
                {channelPattern === 'ascending' && '상승 (저점채널)'}
                {channelPattern === 'descending' && '하락 (고점채널)'}
                {channelPattern === 'none' && '분석 중...'}
              </div>
            </div>
          </div>
        </div>

        {/* 툴바 */}
        <div className="mb-4">
          <Toolbar />
        </div>

        {/* 차트 및 거래 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 차트 영역 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative bg-chart-bg rounded-lg overflow-hidden shadow-2xl">
              <TradingChart />
            </div>
            {/* 주문 내역 */}
            <OrderHistoryPanel />
          </div>

          {/* 거래 패널 */}
          <div className="lg:col-span-1">
            <TradingPanel />
          </div>
        </div>

        {/* 알림 설정 모달 */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="max-w-2xl w-full relative">
              <button
                onClick={() => setShowSettings(false)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl"
              >
                ✕
              </button>
              <NotificationSettings />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
