// X Auto Follow Tool - Content Script
class XAutoFollowContent {
    constructor() {
        this.isRunning = false;
        this.currentAction = null;
        this.settings = null;
        this.actionCount = 0;
        this.intervalId = null;
        this.init();
    }

    init() {
        this.setupMessageListener();
        this.injectStyles();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'start') {
                this.startAction(message.type, message.settings);
            } else if (message.action === 'stop') {
                this.stopAction();
            }
        });
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .x-auto-follow-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #1da1f2;
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: none;
            }
            .x-auto-follow-indicator.running {
                display: block;
            }
        `;
        document.head.appendChild(style);

        // インジケーター要素を作成
        this.indicator = document.createElement('div');
        this.indicator.className = 'x-auto-follow-indicator';
        this.indicator.textContent = 'X Auto Follow Tool - 待機中';
        document.body.appendChild(this.indicator);
    }

    async startAction(actionType, settings) {
        if (this.isRunning) {
            this.sendLog('既にアクションが実行中です', 'error');
            return;
        }

        this.isRunning = true;
        this.currentAction = actionType;
        this.settings = settings;
        this.actionCount = 0;

        this.updateIndicator();
        this.sendLog(`${this.getActionName(actionType)}を開始しました`, 'success');

        // ランダムな数を決定
        const targetCount = Math.floor(Math.random() * (settings.max - settings.min + 1)) + settings.min;
        this.sendLog(`目標: ${targetCount}件の${this.getActionName(actionType)}`, 'info');

        // アクションを開始
        this.executeAction(targetCount);
    }

    stopAction() {
        this.isRunning = false;
        this.currentAction = null;
        this.settings = null;
        this.actionCount = 0;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.updateIndicator();
        this.sendLog('アクションを停止しました', 'info');
    }

    async executeAction(targetCount) {
        let currentCount = 0;

        const execute = async () => {
            if (!this.isRunning || currentCount >= targetCount) {
                this.stopAction();
                this.sendLog(`${this.getActionName(this.currentAction)}が完了しました (${currentCount}件)`, 'success');
                return;
            }

            try {
                const success = await this.performAction();
                if (success) {
                    currentCount++;
                    this.actionCount = currentCount;
                    this.updateIndicator();
                    this.sendLog(`${this.getActionName(this.currentAction)}成功: ${currentCount}/${targetCount}`, 'success');
                } else {
                    this.sendLog(`${this.getActionName(this.currentAction)}失敗: 対象が見つかりません`, 'error');
                }
            } catch (error) {
                this.sendLog(`エラー: ${error.message}`, 'error');
            }

            // 次の実行をスケジュール
            if (this.isRunning && currentCount < targetCount) {
                const interval = (this.settings.interval + Math.random() * 2) * 1000; // ランダムな間隔
                setTimeout(execute, interval);
            }
        };

        // 最初の実行を開始
        execute();
    }

    async performAction() {
        switch (this.currentAction) {
            case 'follow':
                return await this.performFollow();
            case 'unfollow':
                return await this.performUnfollow();
            case 'like':
                return await this.performLike();
            default:
                return false;
        }
    }

    async performFollow() {
        // フォローボタンを探す
        const followButtons = this.findFollowButtons();
        
        for (const button of followButtons) {
            if (!this.isRunning) break;

            try {
                // ボタンがクリック可能かチェック
                if (button.offsetParent !== null && !button.disabled) {
                    // ボタンをクリック
                    button.click();
                    
                    // 少し待機
                    await this.sleep(1000);
                    
                    return true;
                }
            } catch (error) {
                console.error('フォローエラー:', error);
            }
        }
        
        return false;
    }

    async performUnfollow() {
        // アンフォローボタンを探す
        const unfollowButtons = this.findUnfollowButtons();
        
        for (const button of unfollowButtons) {
            if (!this.isRunning) break;

            try {
                if (button.offsetParent !== null && !button.disabled) {
                    button.click();
                    
                    // アンフォロー確認ダイアログを待機
                    await this.sleep(1000);
                    
                    // 確認ボタンを探してクリック
                    const confirmButton = this.findConfirmUnfollowButton();
                    if (confirmButton) {
                        confirmButton.click();
                        await this.sleep(1000);
                        return true;
                    }
                }
            } catch (error) {
                console.error('アンフォローエラー:', error);
            }
        }
        
        return false;
    }

    async performLike() {
        // いいねボタンを探す
        const likeButtons = this.findLikeButtons();
        
        for (const button of likeButtons) {
            if (!this.isRunning) break;

            try {
                if (button.offsetParent !== null && !button.disabled) {
                    button.click();
                    await this.sleep(500);
                    return true;
                }
            } catch (error) {
                console.error('いいねエラー:', error);
            }
        }
        
        return false;
    }

    findFollowButtons() {
        // フォローボタンのセレクター（Xの現在の構造に基づく）
        const selectors = [
            '[data-testid="follow"]',
            '[data-testid="followButton"]',
            'div[role="button"]:has-text("フォロー")',
            'div[role="button"]:has-text("Follow")',
            'div[data-testid="follow"]',
            'div[data-testid="followButton"]'
        ];

        let buttons = [];
        for (const selector of selectors) {
            try {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    buttons = Array.from(found);
                    break;
                }
            } catch (e) {
                // セレクターが無効な場合はスキップ
            }
        }

        return buttons;
    }

    findUnfollowButtons() {
        // アンフォローボタンのセレクター
        const selectors = [
            '[data-testid="unfollow"]',
            '[data-testid="unfollowButton"]',
            'div[role="button"]:has-text("フォロー中")',
            'div[role="button"]:has-text("Following")',
            'div[data-testid="unfollow"]',
            'div[data-testid="unfollowButton"]'
        ];

        let buttons = [];
        for (const selector of selectors) {
            try {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    buttons = Array.from(found);
                    break;
                }
            } catch (e) {
                // セレクターが無効な場合はスキップ
            }
        }

        return buttons;
    }

    findLikeButtons() {
        // いいねボタンのセレクター
        const selectors = [
            '[data-testid="like"]',
            '[data-testid="likeButton"]',
            'div[data-testid="like"]',
            'div[data-testid="likeButton"]',
            'div[role="button"]:has([data-testid="like"])'
        ];

        let buttons = [];
        for (const selector of selectors) {
            try {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    buttons = Array.from(found);
                    break;
                }
            } catch (e) {
                // セレクターが無効な場合はスキップ
            }
        }

        return buttons;
    }

    findConfirmUnfollowButton() {
        // アンフォロー確認ボタンのセレクター
        const selectors = [
            '[data-testid="confirmationSheetConfirm"]',
            'div[role="button"]:has-text("アンフォロー")',
            'div[role="button"]:has-text("Unfollow")'
        ];

        for (const selector of selectors) {
            try {
                const button = document.querySelector(selector);
                if (button) return button;
            } catch (e) {
                // セレクターが無効な場合はスキップ
            }
        }

        return null;
    }

    updateIndicator() {
        if (this.indicator) {
            if (this.isRunning) {
                this.indicator.textContent = `X Auto Follow Tool - ${this.getActionName(this.currentAction)}実行中 (${this.actionCount}件)`;
                this.indicator.classList.add('running');
            } else {
                this.indicator.textContent = 'X Auto Follow Tool - 待機中';
                this.indicator.classList.remove('running');
            }
        }
    }

    getActionName(actionType) {
        const names = {
            follow: 'フォロー',
            unfollow: 'アンフォロー',
            like: 'いいね'
        };
        return names[actionType] || actionType;
    }

    sendLog(message, type = 'info') {
        chrome.runtime.sendMessage({
            type: 'log',
            message: message,
            logType: type
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// コンテンツスクリプトを初期化
const xAutoFollowContent = new XAutoFollowContent(); 