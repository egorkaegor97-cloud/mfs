// Обёртка над Яндекс Игр SDK.
window.YaSDK = {
  ready: false,
  ysdk: null,
  lang: 'ru',
  isAvailable: false,

  isLocal() {
    const h = location.hostname;
    return (
      location.protocol === 'file:' ||
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '' ||
      /^192\.168\./.test(h) ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  },

  loadPlatformSdk() {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '/sdk.js';
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
      setTimeout(() => resolve(typeof YaGames !== 'undefined'), 3000);
    });
  },

  async init() {
    if (this.isLocal()) {
      console.log('[sdk] Локальный режим. Игра работает без Яндекс SDK.');
      this.ready = true;
      return;
    }

    await this.loadPlatformSdk();

    if (typeof YaGames === 'undefined') {
      console.warn('[sdk] YaGames не найден. Игра запущена вне платформы.');
      this.ready = true;
      return;
    }

    try {
      this.ysdk = await YaGames.init();
      this.isAvailable = true;

      if (this.ysdk.environment?.i18n?.lang) {
        this.lang = this.ysdk.environment.i18n.lang;
        console.log('[sdk] Язык пользователя: ' + this.lang);
      }

      this.ysdk.features?.LoadingAPI?.ready();
      console.log('[sdk] LoadingAPI.ready()');

      this.ysdk.on('game_api_pause', () => {
        if (window.onGamePause) window.onGamePause();
      });
      this.ysdk.on('game_api_resume', () => {
        if (window.onGameResume) window.onGameResume();
      });

    } catch (e) {
      console.error('[sdk] Ошибка инициализации:', e);
    }

    this.ready = true;
  },

  gameplayStart() {
    if (this.ysdk?.features?.GameplayAPI) {
      this.ysdk.features.GameplayAPI.start();
    }
  },

  gameplayStop() {
    if (this.ysdk?.features?.GameplayAPI) {
      this.ysdk.features.GameplayAPI.stop();
    }
  }
};
