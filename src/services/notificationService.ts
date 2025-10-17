/**
 * 알림 서비스
 * 주문 체결, 포지션 변경 등을 알림으로 전송
 *
 * 지원하는 알림 채널:
 * 1. Telegram Bot (추천) - 무료, 쉬움, 안정적
 * 2. Discord Webhook - 무료, 쉬움
 * 3. 브라우저 알림 - 브라우저가 열려있을 때만 작동
 */

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface DiscordConfig {
  webhookUrl: string;
}

interface NotificationConfig {
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  browser?: boolean;
}

interface OrderNotification {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  quantity: number;
  status: string;
  timestamp: number;
}

interface PositionNotification {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  timestamp: number;
}

class NotificationService {
  private config: NotificationConfig = {};
  private isInitialized = false;

  /**
   * 알림 서비스 초기화
   *
   * @example Telegram 설정 방법:
   * 1. @BotFather에서 봇 생성 → 토큰 받기
   * 2. 봇과 대화 시작 (아무 메시지나 전송)
   * 3. https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates 접속
   * 4. chat.id 확인
   *
   * @example Discord 설정 방법:
   * 1. 서버 설정 → 연동 → 웹후크 생성
   * 2. 웹후크 URL 복사
   */
  initialize(config: NotificationConfig) {
    this.config = config;
    this.isInitialized = true;

    // 브라우저 알림 권한 요청
    if (config.browser && 'Notification' in window) {
      Notification.requestPermission();
    }

    console.log('알림 서비스 초기화 완료:', {
      telegram: !!config.telegram,
      discord: !!config.discord,
      browser: !!config.browser,
    });
  }

  /**
   * 로컬 스토리지에서 설정 로드
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('notification-config');
      if (saved) {
        const config = JSON.parse(saved);
        this.initialize(config);
        return true;
      }
    } catch (error) {
      console.error('알림 설정 로드 실패:', error);
    }
    return false;
  }

  /**
   * 로컬 스토리지에 설정 저장
   */
  saveToStorage() {
    try {
      localStorage.setItem('notification-config', JSON.stringify(this.config));
      console.log('알림 설정 저장 완료');
    } catch (error) {
      console.error('알림 설정 저장 실패:', error);
    }
  }

  /**
   * 주문 체결 알림 전송
   */
  async notifyOrderFilled(order: OrderNotification) {
    if (!this.isInitialized) {
      console.warn('알림 서비스가 초기화되지 않았습니다.');
      return;
    }

    const sideEmoji = order.side === 'BUY' ? '🟢' : '🔴';
    const title = `${sideEmoji} 주문 체결`;
    const message = [
      `${order.symbol} ${order.side} ${order.type}`,
      `가격: $${order.price.toFixed(2)}`,
      `수량: ${order.quantity.toFixed(4)}`,
      `시간: ${new Date(order.timestamp).toLocaleString('ko-KR')}`,
    ].join('\n');

    await this.sendNotification(title, message);
  }

  /**
   * 포지션 진입 알림 전송
   */
  async notifyPositionOpened(position: PositionNotification) {
    if (!this.isInitialized) {
      console.warn('알림 서비스가 초기화되지 않았습니다.');
      return;
    }

    const sideEmoji = position.side === 'LONG' ? '📈' : '📉';
    const title = `${sideEmoji} 포지션 진입`;
    const message = [
      `${position.symbol} ${position.side}`,
      `진입가: $${position.entryPrice.toFixed(2)}`,
      `수량: ${position.quantity.toFixed(4)}`,
      `레버리지: ${position.leverage}x`,
      `시간: ${new Date(position.timestamp).toLocaleString('ko-KR')}`,
    ].join('\n');

    await this.sendNotification(title, message);
  }

  /**
   * 포지션 청산 알림 전송
   */
  async notifyPositionClosed(symbol: string, pnl: number, pnlPercent: number) {
    if (!this.isInitialized) {
      console.warn('알림 서비스가 초기화되지 않았습니다.');
      return;
    }

    const pnlEmoji = pnl >= 0 ? '✅' : '❌';
    const title = `${pnlEmoji} 포지션 청산`;
    const message = [
      `${symbol}`,
      `손익: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
      `시간: ${new Date().toLocaleString('ko-KR')}`,
    ].join('\n');

    await this.sendNotification(title, message);
  }

  /**
   * 범용 알림 전송
   */
  private async sendNotification(title: string, message: string) {
    const results = await Promise.allSettled([
      this.sendTelegramNotification(title, message),
      this.sendDiscordNotification(title, message),
      this.sendBrowserNotification(title, message),
    ]);

    // 로그 출력
    results.forEach((result, index) => {
      const channel = ['Telegram', 'Discord', 'Browser'][index];
      if (result.status === 'rejected') {
        console.error(`${channel} 알림 전송 실패:`, result.reason);
      }
    });
  }

  /**
   * Telegram 알림 전송
   */
  private async sendTelegramNotification(title: string, message: string) {
    if (!this.config.telegram) return;

    const { botToken, chatId } = this.config.telegram;
    const text = `<b>${title}</b>\n\n${message}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram API 오류: ${response.status}`);
      }

      console.log('✅ Telegram 알림 전송 완료');
    } catch (error) {
      console.error('❌ Telegram 알림 전송 실패:', error);
      throw error;
    }
  }

  /**
   * Discord 알림 전송
   */
  private async sendDiscordNotification(title: string, message: string) {
    if (!this.config.discord) return;

    const { webhookUrl } = this.config.discord;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description: message,
              color: 0x2962ff, // 파란색
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord Webhook 오류: ${response.status}`);
      }

      console.log('✅ Discord 알림 전송 완료');
    } catch (error) {
      console.error('❌ Discord 알림 전송 실패:', error);
      throw error;
    }
  }

  /**
   * 브라우저 알림 전송
   */
  private async sendBrowserNotification(title: string, message: string) {
    if (!this.config.browser || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
      console.log('✅ 브라우저 알림 전송 완료');
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
        console.log('✅ 브라우저 알림 전송 완료');
      }
    }
  }

  /**
   * 현재 설정 조회
   */
  getConfig() {
    return this.config;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...config };
    this.saveToStorage();
    console.log('알림 설정 업데이트:', this.config);
  }

  /**
   * 테스트 알림 전송
   */
  async sendTestNotification() {
    await this.sendNotification(
      '🔔 테스트 알림',
      '알림 서비스가 정상적으로 작동하고 있습니다.'
    );
  }
}

// 싱글톤 인스턴스
export const notificationService = new NotificationService();
