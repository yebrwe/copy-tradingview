import { useState } from 'react';
import { TradingChart } from './components/Chart/TradingChart';
import { Toolbar } from './components/Chart/Toolbar';
import { TradingPanel } from './components/Trading/TradingPanel';
import { OrderHistoryPanel } from './components/OrderHistory/OrderHistoryPanel';
import { Toast } from './components/Toast/Toast';
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket';
import { useChartStore } from './store/chartStore';

function App() {
  // 바이낸스 데이터 로드
  useBinanceWebSocket();

  const { symbol, highChannelEntryPoints, lowChannelEntryPoints, channelPattern } = useChartStore();
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <Toast />
      <div className="max-w-[1600px] mx-auto">
        {/* 헤더 */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-3">트레이딩뷰 차트 복제</h1>

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

        {/* 사용법 안내 */}
        <div className="mt-6 bg-gray-800 rounded-lg">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700 transition rounded-lg"
          >
            <h2 className="text-xl font-semibold">📚 기능 안내</h2>
            <span className="text-gray-400">{showInstructions ? '▼' : '▶'}</span>
          </button>

          {showInstructions && (
            <div className="px-4 pb-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-green-400 mb-2">📊 채널 트레이딩 전략</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li><strong>고점 채널:</strong> 6시간 & 15일 고점을 연결 (초록색) - 하락 추세 감지</li>
                  <li><strong>저점 채널:</strong> 6시간 & 15일 저점을 연결 (빨간색) - 상승 추세 감지</li>
                  <li>차트에 진입점 마커가 표시됩니다 (▼ 숏 진입, ▲ 롱 진입)</li>
                  <li>헤더에 양방향 실시간 진입점 가격이 표시됩니다</li>
                </ul>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">🎯 이평선 기반 전략</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li><strong className="text-green-400">상승 추세:</strong> 현재 가격 &gt; 200일 이평선 → 저점채널 진입</li>
                  <li><strong className="text-red-400">하락 추세:</strong> 현재 가격 &lt; 200일 이평선 → 고점채널 진입</li>
                  <li>200일 이동평균선을 기준으로 추세를 판단하여 사용할 채널 결정</li>
                  <li>각 채널에서 롱/숏 양방향 진입점 제공 (주 전략 + 보조 전략)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">⚡ 자동 거래</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li>우측 거래 패널에서 바이낸스 선물 거래를 실행할 수 있습니다</li>
                  <li>API Key 설정 후 롱/숏 진입이 가능하며 스탑로스/테이크프로핏 설정이 지원됩니다</li>
                  <li>자동 거래 토글 ON 시 1시간마다 자동으로 주문이 갱신됩니다 (새로운 캔들 생성 후 10분 대기)</li>
                  <li>1시간봉 차트로 고정되어 있으며, 실시간 가격 데이터가 바이낸스 WebSocket을 통해 업데이트됩니다</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
