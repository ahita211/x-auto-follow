// X Auto Follow Tool - Background Script (Service Worker)
class XAutoFollowBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 拡張機能がインストールされたとき
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.onInstall();
            }
        });

        // メッセージを受信したとき
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 非同期レスポンスのため
        });

        // タブが更新されたとき
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && 
                (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                this.onTabUpdated(tabId, tab);
            }
        });
    }

    onInstall() {
        console.log('X Auto Follow Tool がインストールされました');
        
        // デフォルト設定を保存
        const defaultSettings = {
            follow: {
                max: 50,
                min: 10,
                interval: 3
            },
            unfollow: {
                max: 30,
                min: 5,
                interval: 5
            },
            like: {
                max: 100,
                min: 20,
                interval: 2
            }
        };

        chrome.storage.sync.set({ settings: defaultSettings }, () => {
            console.log('デフォルト設定を保存しました');
        });
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'log':
                this.handleLogMessage(message, sender);
                break;
            case 'status':
                this.handleStatusMessage(message, sender);
                break;
            default:
                console.log('不明なメッセージタイプ:', message.type);
        }
    }

    handleLogMessage(message, sender) {
        // ログメッセージをポップアップに転送
        chrome.runtime.sendMessage({
            type: 'log',
            message: message.message,
            logType: message.logType,
            source: 'content'
        }).catch(() => {
            // ポップアップが開いていない場合は無視
        });
    }

    handleStatusMessage(message, sender) {
        // ステータスメッセージを処理
        console.log('ステータス更新:', message);
    }

    onTabUpdated(tabId, tab) {
        // Xのページが読み込まれたときの処理
        console.log('Xページが更新されました:', tab.url);
        
        // コンテンツスクリプトが正しく動作しているかチェック
        chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => {
            console.log('コンテンツスクリプトが応答しません');
        });
    }

    // エラーハンドリング
    handleError(error, context) {
        console.error(`X Auto Follow Tool エラー (${context}):`, error);
        
        // エラーログを保存
        chrome.storage.local.get(['errorLogs'], (result) => {
            const logs = result.errorLogs || [];
            logs.push({
                timestamp: new Date().toISOString(),
                error: error.message,
                context: context,
                stack: error.stack
            });
            
            // 最新の100件のみ保持
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            chrome.storage.local.set({ errorLogs: logs });
        });
    }
}

// バックグラウンドスクリプトを初期化
const xAutoFollowBackground = new XAutoFollowBackground();

// エラーハンドリング
self.addEventListener('error', (event) => {
    xAutoFollowBackground.handleError(event.error, 'service-worker');
});

self.addEventListener('unhandledrejection', (event) => {
    xAutoFollowBackground.handleError(new Error(event.reason), 'service-worker-promise');
}); 