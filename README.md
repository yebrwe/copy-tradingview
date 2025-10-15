# 트레이딩뷰 차트 복제 프로젝트

이더리움(ETH) 실시간 가격 차트와 그리기 도구를 제공하는 TradingView 스타일의 웹 애플리케이션입니다.

## 🚀 주요 기능

- ✅ **실시간 가격 데이터**: 바이낸스 WebSocket을 통한 실시간 ETH/USDT 캔들 차트
- ✅ **다양한 타임프레임**: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 3d, 1w, 1M
- ✅ **그리기 도구**: 추세선, 수평선, 사각형 그리기
- ✅ **볼륨 차트**: 거래량 히스토그램 표시
- ✅ **반응형 디자인**: 다크모드 UI

## 🛠️ 기술 스택

### 프론트엔드
- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링

### 차트 & 데이터
- **Lightweight Charts** - TradingView 공식 차트 라이브러리
- **Binance WebSocket API** - 실시간 kline 데이터
- **Binance REST API** - 히스토리 데이터

### 상태 관리
- **Zustand** - 가벼운 상태 관리

## 📦 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 3. 프로덕션 빌드
```bash
npm run build
```

## 📁 프로젝트 구조

```
src/
├── components/
│   └── Chart/
│       ├── TradingChart.tsx       # 메인 차트 컴포넌트
│       ├── TimeframeSelector.tsx  # 타임프레임 선택기
│       ├── Toolbar.tsx            # 그리기 도구 툴바
│       └── DrawingLayer.tsx       # Canvas 그리기 레이어
├── hooks/
│   └── useBinanceWebSocket.ts     # 바이낸스 WebSocket 훅
├── services/
│   ├── binanceAPI.ts              # REST API 서비스
│   └── websocketService.ts        # WebSocket 서비스
├── store/
│   └── chartStore.ts              # Zustand 스토어
├── types/
│   └── trading.types.ts           # TypeScript 타입 정의
└── App.tsx                        # 메인 앱 컴포넌트
```

## 🎨 사용법

### 타임프레임 변경
상단의 타임프레임 버튼(1m, 5m, 1h 등)을 클릭하여 차트 시간 간격을 변경할 수 있습니다.

### 그리기 도구 사용
1. 툴바에서 원하는 도구(추세선, 수평선, 사각형)를 선택
2. 차트 위에서 마우스를 드래그하여 그리기
3. '모두 삭제' 버튼으로 그린 도형 제거

### 차트 인터랙션
- **마우스 휠**: 줌 인/아웃
- **드래그**: 차트 이동
- **십자선**: 마우스를 차트 위에 올리면 가격/시간 정보 표시

## 🔧 향후 개선 사항

- [ ] 더 많은 그리기 도구 추가 (피보나치, 평행 채널 등)
- [ ] 기술적 지표 (MA, RSI, MACD, 볼린저 밴드)
- [ ] 저장/불러오기 기능 (LocalStorage/IndexedDB)
- [ ] 다중 심볼 지원 (BTC, SOL 등)
- [ ] 가격 알림 기능
- [ ] 모바일 최적화

## 📝 API 참고

- [Binance WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- [Binance REST API](https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data)
- [Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)

## 📄 라이선스

MIT License
