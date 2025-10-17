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
    <div className="bg-[#1e222d] rounded-lg p-6 border border-[#2a2e39]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-bold text-lg">알림 설정</h3>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-sm text-gray-400 hover:text-white font-medium"
        >
          {showInstructions ? '접기' : '설정 방법'}
        </button>
      </div>

      {/* 설정 방법 안내 */}
      {showInstructions && (
        <div className="mb-6 p-4 bg-[#131722] rounded-lg text-sm text-gray-300 space-y-4 border border-[#2a2e39]">
          <div>
            <div className="text-white font-semibold mb-2">Telegram 봇 설정 (권장)</div>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-gray-400">
              <li>Telegram에서 @BotFather 검색 후 대화 시작</li>
              <li>/newbot 명령어로 봇 생성 → 봇 토큰 받기</li>
              <li>생성한 봇과 대화 시작 (아무 메시지나 전송)</li>
              <li>
                브라우저에서{' '}
                <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  https://api.telegram.org/bot{'<YOUR_TOKEN>'}/getUpdates
                </code>{' '}
                접속
              </li>
              <li>응답에서 "chat": {"{"}"id": 숫자{"}"} 찾아서 Chat ID 확인</li>
            </ol>
          </div>
          <div>
            <div className="text-white font-semibold mb-2">Discord 웹후크 설정</div>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-gray-400">
              <li>Discord 서버 설정 → 연동 → 웹후크</li>
              <li>새 웹후크 생성 후 웹후크 URL 복사</li>
            </ol>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Telegram 설정 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300 font-medium">
              Telegram Bot Token
            </label>
            <span className="text-xs text-blue-400 font-medium">권장</span>
          </div>
          <input
            type="text"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full px-4 py-2.5 bg-[#131722] border border-[#2a2e39] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          <label className="text-sm text-gray-300 font-medium block">Chat ID</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="123456789"
            className="w-full px-4 py-2.5 bg-[#131722] border border-[#2a2e39] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Discord 설정 */}
        <div className="space-y-3">
          <label className="text-sm text-gray-300 font-medium block">Discord Webhook URL</label>
          <input
            type="text"
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full px-4 py-2.5 bg-[#131722] border border-[#2a2e39] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 브라우저 알림 */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="browser-notification"
            checked={browserNotification}
            onChange={(e) => setBrowserNotification(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="browser-notification" className="text-sm text-gray-300">
            브라우저 알림 사용 (브라우저가 열려있을 때만)
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            저장
          </button>
          <button
            onClick={handleTest}
            className="px-6 py-2.5 bg-[#2a2e39] text-gray-300 rounded-lg hover:bg-[#363a45] transition-colors text-sm font-medium"
          >
            테스트
          </button>
        </div>

        {/* 알림 예시 */}
        <div className="mt-2 p-4 bg-[#131722] rounded-lg border border-[#2a2e39]">
          <div className="text-xs text-gray-500 font-medium mb-2">알림 예시</div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="font-semibold text-white">포지션 진입</div>
            <div className="ml-3 text-gray-400">ETHUSDT LONG</div>
            <div className="ml-3 text-gray-400">진입가: $2,450.00</div>
            <div className="ml-3 text-gray-400">수량: 0.5000</div>
          </div>
        </div>
      </div>
    </div>
  );
};
