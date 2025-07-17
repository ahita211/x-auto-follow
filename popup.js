// ポップアップのメイン機能
class XAutoFollowTool {
    constructor() {
        this.isRunning = false;
        this.currentAction = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.updateStatus();
    }

    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // アクションボタン
        document.getElementById('start-follow').addEventListener('click', () => {
            this.startAction('follow');
        });

        document.getElementById('start-unfollow').addEventListener('click', () => {
            this.startAction('unfollow');
        });

        document.getElementById('start-like').addEventListener('click', () => {
            this.startAction('like');
        });

        // 停止ボタン
        document.getElementById('stop-action').addEventListener('click', () => {
            this.stopAction();
        });

        // 設定リセット
        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetSettings();
        });

        // 設定の自動保存
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('change', () => {
                this.saveSettings();
            });
        });
    }

    switchTab(tabName) {
        // タブボタンのアクティブ状態を更新
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // タブコンテンツの表示を更新
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    async startAction(actionType) {
        if (this.isRunning) {
            this.addLog('既にアクションが実行中です', 'error');
            return;
        }

        const settings = this.getSettings(actionType);
        if (!this.validateSettings(settings)) {
            this.addLog('設定が無効です', 'error');
            return;
        }

        this.isRunning = true;
        this.currentAction = actionType;
        this.updateStatus();

        try {
            // コンテンツスクリプトにメッセージを送信
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
                this.addLog('Xのページで実行してください', 'error');
                this.stopAction();
                return;
            }

            await chrome.tabs.sendMessage(tab.id, {
                action: 'start',
                type: actionType,
                settings: settings
            });

            this.addLog(`${this.getActionName(actionType)}を開始しました`, 'success');
        } catch (error) {
            this.addLog(`エラー: ${error.message}`, 'error');
            this.stopAction();
        }
    }

    stopAction() {
        this.isRunning = false;
        this.currentAction = null;
        this.updateStatus();

        // コンテンツスクリプトに停止メッセージを送信
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'stop' });
            }
        });

        this.addLog('アクションを停止しました', 'info');
    }

    getSettings(actionType) {
        const settings = {};
        const prefix = actionType === 'follow' ? 'follow' : 
                     actionType === 'unfollow' ? 'unfollow' : 'like';

        settings.max = parseInt(document.getElementById(`${prefix}-max`).value);
        settings.min = parseInt(document.getElementById(`${prefix}-min`).value);
        settings.interval = parseInt(document.getElementById(`${prefix}-interval`).value);

        return settings;
    }

    validateSettings(settings) {
        if (settings.max < settings.min) {
            this.addLog('最大数は最小数以上にしてください', 'error');
            return false;
        }
        if (settings.max <= 0 || settings.min <= 0 || settings.interval <= 0) {
            this.addLog('すべての値は1以上にしてください', 'error');
            return false;
        }
        return true;
    }

    getActionName(actionType) {
        const names = {
            follow: 'フォロー',
            unfollow: 'アンフォロー',
            like: 'いいね'
        };
        return names[actionType] || actionType;
    }

    updateStatus() {
        const statusEl = document.getElementById('status');
        if (this.isRunning) {
            statusEl.textContent = `${this.getActionName(this.currentAction)}実行中`;
            statusEl.style.color = '#28a745';
        } else {
            statusEl.textContent = '待機中';
            statusEl.style.color = 'rgba(255, 255, 255, 0.9)';
        }
    }

    addLog(message, type = 'info') {
        const logContent = document.getElementById('log-content');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;

        // ログが多すぎる場合は古いものを削除
        while (logContent.children.length > 50) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('settings');
            if (result.settings) {
                const settings = result.settings;
                
                // フォロー設定
                if (settings.follow) {
                    document.getElementById('follow-max').value = settings.follow.max || 50;
                    document.getElementById('follow-min').value = settings.follow.min || 10;
                    document.getElementById('follow-interval').value = settings.follow.interval || 3;
                }

                // アンフォロー設定
                if (settings.unfollow) {
                    document.getElementById('unfollow-max').value = settings.unfollow.max || 30;
                    document.getElementById('unfollow-min').value = settings.unfollow.min || 5;
                    document.getElementById('unfollow-interval').value = settings.unfollow.interval || 5;
                }

                // いいね設定
                if (settings.like) {
                    document.getElementById('like-max').value = settings.like.max || 100;
                    document.getElementById('like-min').value = settings.like.min || 20;
                    document.getElementById('like-interval').value = settings.like.interval || 2;
                }
            }
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                follow: {
                    max: parseInt(document.getElementById('follow-max').value),
                    min: parseInt(document.getElementById('follow-min').value),
                    interval: parseInt(document.getElementById('follow-interval').value)
                },
                unfollow: {
                    max: parseInt(document.getElementById('unfollow-max').value),
                    min: parseInt(document.getElementById('unfollow-min').value),
                    interval: parseInt(document.getElementById('unfollow-interval').value)
                },
                like: {
                    max: parseInt(document.getElementById('like-max').value),
                    min: parseInt(document.getElementById('like-min').value),
                    interval: parseInt(document.getElementById('like-interval').value)
                }
            };

            await chrome.storage.sync.set({ settings });
        } catch (error) {
            console.error('設定の保存に失敗しました:', error);
        }
    }

    resetSettings() {
        // デフォルト値にリセット
        document.getElementById('follow-max').value = 50;
        document.getElementById('follow-min').value = 10;
        document.getElementById('follow-interval').value = 3;

        document.getElementById('unfollow-max').value = 30;
        document.getElementById('unfollow-min').value = 5;
        document.getElementById('unfollow-interval').value = 5;

        document.getElementById('like-max').value = 100;
        document.getElementById('like-min').value = 20;
        document.getElementById('like-interval').value = 2;

        this.saveSettings();
        this.addLog('設定をリセットしました', 'info');
    }
}

// ポップアップが開かれたときに初期化
document.addEventListener('DOMContentLoaded', () => {
    new XAutoFollowTool();
});

// コンテンツスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'log') {
        const tool = window.xAutoFollowTool;
        if (tool) {
            tool.addLog(message.message, message.logType);
        }
    }
}); 