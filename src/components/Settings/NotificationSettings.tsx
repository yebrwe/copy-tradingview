import { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService';

export const NotificationSettings = () => {
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [browserNotification, setBrowserNotification] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // 저장된 설정 로드
    notificationService.loadFromStorage();
    const config = notificationService.getConfig();

    if (config.telegram) {
      setTelegramBotToken(config.telegram.botToken);
      setTelegramChatId(config.telegram.chatId);
    }
    if (config.discord) {
      setDiscordWebhookUrl(config.discord.webhookUrl);
    }
    setBrowserNotification(config.browser || false);
  }, []);

  const handleSave = () => {
    const config: any = {};

    if (telegramBotToken && telegramChatId) {
      config.telegram = {
        botToken: telegramBotToken,
        chatId: telegramChatId,
      };
    }

    if (discordWebhookUrl) {
      config.discord = {
        webhookUrl: discordWebhookUrl,
      };
    }

    config.browser = browserNotification;

    notificationService.initialize(config);
    notificationService.saveToStorage();

    alert('알림 설정이 저장되었습니다!');
  };

  const handleTest = async () => {
    try {
      await notificationService.sendTestNotification();
      alert('테스트 알림을 전송했습니다. 확인해주세요.');
    } catch (error) {
      alert('알림 전송에 실패했습니다. 설정을 확인해주세요.');
    }
  };

  return (
    <div className="bg-[#1e222d] rounded-lg p-4 border border-[#2a2e39]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">주문 체결 알림 설정</h3>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {showInstructions ? '설명 숨기기' : '설정 방법 보기'}
        </button>
      </div>

      {/* 설정 방법 안내 */}
      {showInstructions && (
        <div className="mb-4 p-3 bg-[#131722] rounded text-xs text-gray-400 space-y-2">
          <div>
            <div className="text-blue-400 font-semibold mb-1">📱 Telegram 봇 설정 (추천)</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Telegram에서 @BotFather 검색 후 대화 시작</li>
              <li>/newbot 명령어로 봇 생성 → 봇 토큰 받기</li>
              <li>생성한 봇과 대화 시작 (아무 메시지나 전송)</li>
              <li>
                브라우저에서{' '}
                <code className="text-blue-400">
                  https://api.telegram.org/bot{'<YOUR_TOKEN>'}/getUpdates
                </code>{' '}
                접속
              </li>
              <li>응답에서 "chat": {"{"}"id": 숫자{"}"} 찾아서 Chat ID 확인</li>
            </ol>
          </div>
          <div>
            <div className="text-purple-400 font-semibold mb-1">💬 Discord 웹후크 설정</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Discord 서버 설정 → 연동 → 웹후크</li>
              <li>새 웹후크 생성 후 웹후크 URL 복사</li>
            </ol>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Telegram 설정 */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400 flex items-center gap-2">
            <span>📱 Telegram Bot Token</span>
            <span className="text-xs text-gray-500">(추천)</span>
          </label>
          <input
            type="text"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full px-3 py-2 bg-[#131722] border border-[#2a2e39] rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />

          <label className="text-sm text-gray-400">Chat ID</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="123456789"
            className="w-full px-3 py-2 bg-[#131722] border border-[#2a2e39] rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Discord 설정 */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">💬 Discord Webhook URL</label>
          <input
            type="text"
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full px-3 py-2 bg-[#131722] border border-[#2a2e39] rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 브라우저 알림 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="browser-notification"
            checked={browserNotification}
            onChange={(e) => setBrowserNotification(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="browser-notification" className="text-sm text-gray-400">
            🔔 브라우저 알림 (브라우저가 열려있을 때만)
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            저장
          </button>
          <button
            onClick={handleTest}
            className="px-4 py-2 bg-[#2a2e39] text-gray-400 rounded hover:bg-[#363a45] hover:text-white transition-colors text-sm"
          >
            테스트
          </button>
        </div>

        {/* 알림 예시 */}
        <div className="mt-4 p-3 bg-[#131722] rounded border border-[#2a2e39]">
          <div className="text-xs text-gray-500 mb-2">알림 예시:</div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>🟢 <span className="text-white">주문 체결</span></div>
            <div className="ml-4">ETHUSDT BUY LIMIT</div>
            <div className="ml-4">가격: $2,450.00</div>
            <div className="ml-4">수량: 0.5000</div>
          </div>
        </div>
      </div>
    </div>
  );
};
