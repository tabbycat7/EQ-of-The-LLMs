// LMArena 前端应用

// 全局状态
let currentMode = 'battle';
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;

// 输入区域引用，便于统一显示/隐藏
let battleInputSection = null;
let sideBySideInputSection = null;

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 直接显示主应用（已移除登录功能）
    showMainApp();
    await initApp();
});

// 显示主应用界面
function showMainApp() {
    const loginModal = document.getElementById('login-modal');
    const appShell = document.getElementById('app-shell');
    if (loginModal) loginModal.style.display = 'none';
    if (appShell) appShell.style.display = 'flex';
}

// 初始化应用
async function initApp() {
    // 设置模式切换
    setupModeSelector();

    // 设置对战模式
    setupBattleMode();

    // 设置并排对比模式（但不加载模型，延迟到需要时）
    setupSideBySideMode();

    // 设置排行榜（但不加载数据，延迟到需要时）
    setupLeaderboard();

    // 设置历史对话
    setupHistoryMode();

    // 设置测评问题
    setupQuestionsMode();

    // 不在初始化时加载数据，只在用户切换到对应模式时才加载
}


// 加载可用模型
async function loadModels() {
    try {
        const response = await fetch('/api/chat/models');
        const data = await response.json();
        availableModels = data.models;

        // 填充模型选择器
        populateModelSelectors();
    } catch (error) {
        console.error('加载模型失败:', error);
        showError('加载模型列表失败');
    }
}

// 填充模型选择器
function populateModelSelectors() {
    const selectors = [
        document.getElementById('sidebyside-model-a'),
        document.getElementById('sidebyside-model-b')
    ];

    selectors.forEach(select => {
        select.innerHTML = '';
        availableModels.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            select.appendChild(option);
        });

        // 默认选择不同的模型
        if (select.id === 'sidebyside-model-b' && availableModels.length > 1) {
            select.selectedIndex = 1;
        }
    });
}

// 设置模式切换
function setupModeSelector() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    const modeContents = document.querySelectorAll('.mode-content');

    modeButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = btn.dataset.mode;
            if (!mode) return;

            // 更新按钮状态
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新内容显示
            modeContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });
            const targetContent = document.getElementById(`${mode}-mode`);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            } else {
                console.error(`找不到模式内容区域: ${mode}-mode`);
                return;
            }

            currentMode = mode;

            // 如果切换到排行榜，加载数据（延迟加载）
            if (mode === 'leaderboard') {
                loadLeaderboard();
            }
            // 如果切换到并排对比模式，确保模型已加载（延迟加载）
            if (mode === 'sidebyside' && availableModels.length === 0) {
                await loadModels();
            }
            // 如果切换到历史对话，加载历史记录
            if (mode === 'history') {
                loadHistory();
            }
            // 如果切换到测评问题，加载问题列表
            if (mode === 'questions') {
                loadQuestions();
            }
        });
    });
}

// ===== 对战模式 =====
function setupBattleMode() {
    const startBtn = document.getElementById('start-battle-btn');
    const newBattleBtn = document.getElementById('new-battle-btn');
    const continueBattleBtn = document.getElementById('continue-battle-btn');
    const sendBtn = document.getElementById('battle-send-btn');
    const input = document.getElementById('battle-input');
    const voteButtons = document.querySelectorAll('.battle-vote-btn');
    // 统一控制“输入区域（含提示）”的显示/隐藏
    battleInputSection = document.querySelector('#battle-mode .composer');

    startBtn.addEventListener('click', startBattle);
    newBattleBtn.addEventListener('click', startBattle);
    if (continueBattleBtn) {
        continueBattleBtn.addEventListener('click', continueCurrentBattle);
    }
    sendBtn.addEventListener('click', sendBattleMessage);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // 检查按钮是否已禁用，避免重复提交
            const sendBtn = document.getElementById('battle-send-btn');
            if (sendBtn && !sendBtn.disabled) {
                sendBattleMessage();
            }
        }
    });

    voteButtons.forEach(btn => {
        btn.addEventListener('click', () => submitVote(btn.dataset.winner));
    });
}

async function startBattle() {
    try {
        showLoading('battle');

        const response = await fetch('/api/battle/start', {
            method: 'POST'
        });

        if (!response.ok) throw new Error('启动对战失败');

        const data = await response.json();
        // 初始不再依赖后端返回的 session_id，由首次发送消息时后端生成
        battleSessionId = data.session_id || null;

        // 显示聊天界面
        document.getElementById('battle-start').style.display = 'none';
        document.getElementById('battle-chat').style.display = 'block';

        // 重置界面：清空多轮对话容器，等待新一轮对话
        const battleResponses = document.getElementById('battle-responses');
        if (battleResponses) {
            battleResponses.innerHTML = '';
        }
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('reveal-section').style.display = 'none';
        document.getElementById('battle-input').value = '';
        document.getElementById('battle-send-btn').disabled = false;
        // 确保投票按钮是启用状态（防止之前的状态影响）
        const voteButtons = document.querySelectorAll('.battle-vote-btn');
        voteButtons.forEach(btn => {
            btn.disabled = false;
        });
        // 新一轮开始时显示输入区域
        if (battleInputSection) battleInputSection.style.display = 'block';

    } catch (error) {
        console.error('启动对战失败:', error);
        showError('启动对战失败，请重试');
    }
}

async function sendBattleMessage() {
    const input = document.getElementById('battle-input');
    const message = input.value.trim();

    if (!message) {
        // 如果消息为空，给用户一个视觉反馈
        input.focus();
        return;
    }

    const sendBtn = document.getElementById('battle-send-btn');
    // 如果按钮已经被禁用，说明正在发送中，避免重复提交
    if (sendBtn && sendBtn.disabled) {
        return;
    }
    sendBtn.disabled = true;
    // 发送后隐藏输入区域，直到本轮投票完成
    if (battleInputSection) battleInputSection.style.display = 'none';

    // 调试信息：记录当前 session_id
    console.log('发送消息，当前 battleSessionId:', battleSessionId);

    try {
        // 在多轮对话容器中，为本轮新增一个「用户问题 + 模型 A / 模型 B」区域
        const battleResponses = document.getElementById('battle-responses');
        if (!battleResponses) {
            throw new Error('未找到 battle-responses 容器');
        }

        const roundEl = document.createElement('div');
        // 每一轮独立容器：顶部是用户消息，底部是 A/B 模型回复
        roundEl.className = 'battle-round';
        roundEl.innerHTML = `
            <div class="messages">
                <div class="message user"></div>
            </div>
            <div class="responses-grid-inner">
                <div class="response-box response-box-a">
                    <div class="response-header">🦊 小狐狸</div>
                    <div class="response-content" data-role="response-a">
                        <div class="loading">🦊 小狐狸正在思考...</div>
                    </div>
                </div>
                <div class="response-box response-box-b">
                    <div class="response-header">🐰 小兔子</div>
                    <div class="response-content" data-role="response-b">
                        <div class="loading">🐰 小兔子正在思考...</div>
                    </div>
                </div>
            </div>
        `;
        battleResponses.appendChild(roundEl);

        // 填充本轮用户问题到这一轮顶部
        const userMsgEl = roundEl.querySelector('.message.user');
        if (userMsgEl) {
            userMsgEl.textContent = message;
        }

        const responseA = roundEl.querySelector('.response-content[data-role="response-a"]');
        const responseB = roundEl.querySelector('.response-content[data-role="response-b"]');

        const response = await fetch('/api/battle/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: battleSessionId,
                message: message
            })
        });

        if (!response.ok) {
            let errorMessage = '发送消息失败';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = `发送消息失败: ${errorData.detail}`;
                    // 如果是权限错误，提示用户可能需要重新登录
                    if (response.status === 403) {
                        errorMessage += '（可能是权限问题，请尝试刷新页面）';
                    }
                    // 如果是对战会话不存在，清空 session_id 以便重新创建
                    if (response.status === 404 && errorData.detail.includes('不存在')) {
                        console.warn('对战会话不存在，清空 session_id');
                        battleSessionId = null;
                    }
                }
            } catch (e) {
                // 如果响应不是 JSON，使用默认错误信息
                errorMessage = `发送消息失败 (HTTP ${response.status})`;
                // 如果是网络错误，提示检查后端服务
                if (response.status === 0 || response.status >= 500) {
                    errorMessage += '（可能是服务器错误，请稍后重试）';
                }
            }
            throw new Error(errorMessage);
        }

        // 非流式：一次性获取完整 JSON
        const data = await response.json();

        // 更新对战会话 ID（以防后端有调整）
        if (data.session_id) {
            battleSessionId = data.session_id;
        }

        // 将本轮新回复写入刚刚创建的这一轮卡片中，旧轮次卡片保持不变
        const finalA = (data.response_a || '').trim();
        const finalB = (data.response_b || '').trim();
        if (responseA) {
            responseA.classList.add('markdown-content');
            responseA.innerHTML = renderMarkdown(finalA);
        }
        if (responseB) {
            responseB.classList.add('markdown-content');
            responseB.innerHTML = renderMarkdown(finalB);
        }

        // 显示投票区域，并确保投票按钮是启用状态
        const votingSection = document.getElementById('voting-section');
        if (votingSection) {
            votingSection.style.display = 'block';
            // 重新启用所有投票按钮（防止之前的禁用状态影响新的投票）
            const voteButtons = document.querySelectorAll('.battle-vote-btn');
            voteButtons.forEach(btn => {
                btn.disabled = false;
            });
        }

        input.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        const errorMessage = error.message || '发送消息失败，请重试';
        showError(errorMessage);
        sendBtn.disabled = false;
        if (battleInputSection) battleInputSection.style.display = 'block';
        // 如果错误是由于网络问题（如无法连接到服务器），提示用户检查后端服务
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.error('网络错误：可能后端服务未启动或无法访问');
        }
    }
}

async function submitVote(winner) {
    // 防止重复点击：立即禁用所有投票按钮
    const voteButtons = document.querySelectorAll('.battle-vote-btn');
    voteButtons.forEach(btn => {
        btn.disabled = true;
    });

    try {
        // 调试信息：记录当前 session_id
        console.log('提交投票，当前 battleSessionId:', battleSessionId);

        const response = await fetch('/api/battle/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: battleSessionId,
                winner: winner
            })
        });

        if (!response.ok) {
            let errorMessage = '投票失败';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else {
                    errorMessage = `投票失败 (HTTP ${response.status})`;
                }
                // 如果是对战会话不存在，清空 session_id 以便重新创建
                if (response.status === 404 && errorData.detail && errorData.detail.includes('不存在')) {
                    console.warn('对战会话不存在，清空 session_id');
                    battleSessionId = null;
                }
                // 如果已经投过票，可能是使用了旧的 session_id
                // 这可能发生在"继续对话"后还没有发送新消息就尝试投票的情况
                if (response.status === 400 && errorData.detail && errorData.detail.includes('已经投过票')) {
                    console.error('投票失败：使用了已投过票的 session_id。当前 battleSessionId:', battleSessionId);
                    errorMessage = '投票失败：当前会话已投过票。如果您点击了"继续对话"，请先发送一条消息后再投票。';
                }
            } catch (e) {
                // 如果响应不是 JSON，使用默认错误信息
                errorMessage = `投票失败 (HTTP ${response.status})`;
            }
            // 如果失败，重新启用投票按钮
            voteButtons.forEach(btn => {
                btn.disabled = false;
            });
            throw new Error(errorMessage);
        }

        const data = await response.json();

        // 触发庆祝效果
        showVoteCelebration(winner);

        // 延迟隐藏投票区域，让庆祝效果显示
        setTimeout(() => {
            // 隐藏投票区域
            document.getElementById('voting-section').style.display = 'none';

            // 显示"开始新对战 / 继续当前模型对战"按钮区域
            document.getElementById('reveal-section').style.display = 'block';
        }, 800);

        // 本轮投票完成后：保持输入区域隐藏，发送按钮禁用
        // 只有点击"开始新对战"按钮（startBattle/newBattle）才重新出现输入框
        const sendBtn = document.getElementById('battle-send-btn');
        sendBtn.disabled = true;
        if (battleInputSection) battleInputSection.style.display = 'none';

    } catch (error) {
        console.error('投票失败:', error);
        const errorMessage = error.message || '投票失败，请重试';
        showError(errorMessage);
        // 如果出错，重新启用投票按钮（以防万一）
        const voteButtons = document.querySelectorAll('.battle-vote-btn');
        voteButtons.forEach(btn => {
            btn.disabled = false;
        });
    }
}

// 继续使用当前模型进行对战（保留界面聊天内容 + 历史对话）
async function continueCurrentBattle() {
    // 需要已有的对战 session，才能基于它继续
    if (!battleSessionId) {
        showError('当前没有正在进行的对战，请先点击“开始对战”。');
        return;
    }

    const sendBtn = document.getElementById('battle-send-btn');

    try {
        // 调用后端 /api/battle/continue，基于当前对战创建一个新的 session
        const resp = await fetch('/api/battle/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: battleSessionId }),
        });

        if (!resp.ok) {
            throw new Error('继续对战失败');
        }

        const data = await resp.json();
        // 设置 session_id 为原会话ID（作为标记）
        // 当用户真正发送消息时，后端会检测到原会话已完成投票，自动创建新记录
        battleSessionId = data.session_id;

        // 隐藏“结果/按钮”区域，回到提问状态，但保留上一轮对话内容
        const revealSection = document.getElementById('reveal-section');
        if (revealSection) revealSection.style.display = 'none';

        // 确保聊天区域处于显示状态
        const battleStart = document.getElementById('battle-start');
        const battleChat = document.getElementById('battle-chat');
        if (battleStart) battleStart.style.display = 'none';
        if (battleChat) battleChat.style.display = 'block';

        // 不清空界面上的聊天内容，只是重新启用输入与发送
        if (sendBtn) sendBtn.disabled = false;
        if (battleInputSection) battleInputSection.style.display = 'block';
        // 确保投票按钮是启用状态（防止之前的状态影响）
        const voteButtons = document.querySelectorAll('.battle-vote-btn');
        voteButtons.forEach(btn => {
            btn.disabled = false;
        });
    } catch (e) {
        console.error('继续对战失败:', e);
        showError('继续对战失败，请稍后重试');
    }
}

// ===== 并排对比模式 =====
function setupSideBySideMode() {
    const sendBtn = document.getElementById('sidebyside-send-btn');
    const input = document.getElementById('sidebyside-input');
    const voteButtons = document.querySelectorAll('.sidebyside-vote-btn');
    // 统一控制“输入区域（含提示）”的显示/隐藏
    sideBySideInputSection = document.querySelector('#sidebyside-mode .composer');
    const newRoundBtn = document.getElementById('sidebyside-new-round-btn');

    sendBtn.addEventListener('click', sendSideBySideMessage);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // 检查按钮是否已禁用，避免重复提交
            const sendBtn = document.getElementById('sidebyside-send-btn');
            if (sendBtn && !sendBtn.disabled) {
                sendSideBySideMessage();
            }
        }
    });

    // 监听模型选择变化
    const modelASelect = document.getElementById('sidebyside-model-a');
    const modelBSelect = document.getElementById('sidebyside-model-b');

    modelASelect.addEventListener('change', updateSideBySideHeaders);
    modelBSelect.addEventListener('change', updateSideBySideHeaders);

    updateSideBySideHeaders();

    voteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (sideBySideVoted) return;
            submitSideBySideVote(btn.dataset.winner);
        });
    });

    if (newRoundBtn) {
        newRoundBtn.addEventListener('click', resetSideBySideRound);
    }
}

function updateSideBySideHeaders() {
    const modelAId = document.getElementById('sidebyside-model-a').value;
    const modelBId = document.getElementById('sidebyside-model-b').value;

    const modelA = availableModels.find(m => m.id === modelAId);
    const modelB = availableModels.find(m => m.id === modelBId);

    if (modelA) {
        document.getElementById('sidebyside-header-a').textContent = modelA.name;
    }
    if (modelB) {
        document.getElementById('sidebyside-header-b').textContent = modelB.name;
    }
}

async function sendSideBySideMessage() {
    const input = document.getElementById('sidebyside-input');
    const message = input.value.trim();

    if (!message) {
        // 如果消息为空，给用户一个视觉反馈
        input.focus();
        return;
    }

    const sendBtn = document.getElementById('sidebyside-send-btn');
    // 如果按钮已经被禁用，说明正在发送中，避免重复提交
    if (sendBtn && sendBtn.disabled) {
        return;
    }
    sendBtn.disabled = true;

    const modelAId = document.getElementById('sidebyside-model-a').value;
    const modelBId = document.getElementById('sidebyside-model-b').value;
    // 发送后隐藏输入区域，直到新一轮开启
    if (sideBySideInputSection) sideBySideInputSection.style.display = 'none';
    const newRound = document.getElementById('sidebyside-new-round');
    if (newRound) newRound.style.display = 'none';

    try {
        // 显示用户提问气泡（ChatGPT 风格）
        const userMsg = document.getElementById('sidebyside-user-msg');
        if (userMsg) {
            userMsg.textContent = message;
            userMsg.style.display = 'block';
        }

        document.getElementById('sidebyside-response-a').innerHTML = '<div class="loading">思考中...</div>';
        document.getElementById('sidebyside-response-b').innerHTML = '<div class="loading">思考中...</div>';

        const response = await fetch('/api/chat/sidebyside', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_a_id: modelAId,
                model_b_id: modelBId,
                message: message,
                session_id: sideBySideSessionId
            })
        });

        if (!response.ok) throw new Error('发送消息失败');

        const data = await response.json();
        sideBySideSessionId = data.session_id;

        const responseAEl = document.getElementById('sidebyside-response-a');
        const responseBEl = document.getElementById('sidebyside-response-b');
        if (responseAEl) {
            responseAEl.classList.add('markdown-content');
            responseAEl.innerHTML = renderMarkdown(data.response_a || '');
        }
        if (responseBEl) {
            responseBEl.classList.add('markdown-content');
            responseBEl.innerHTML = renderMarkdown(data.response_b || '');
        }

        // 显示投票区并重置状态
        sideBySideVoted = false;
        document.getElementById('sidebyside-voting').style.display = 'block';
        document.querySelectorAll('#sidebyside-voting .vote-btn').forEach(btn => btn.disabled = false);

        input.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        showError('发送消息失败，请重试');
        if (sideBySideInputSection) sideBySideInputSection.style.display = 'block';
    } finally {
        sendBtn.disabled = false;
    }
}

async function submitSideBySideVote(winner) {
    const modelAId = document.getElementById('sidebyside-model-a').value;
    const modelBId = document.getElementById('sidebyside-model-b').value;
    const buttons = document.querySelectorAll('#sidebyside-voting .vote-btn');

    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch('/api/chat/sidebyside/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_a_id: modelAId,
                model_b_id: modelBId,
                winner: winner,
                session_id: sideBySideSessionId
            })
        });

        if (!response.ok) throw new Error('投票失败');

        await response.json(); // 暂不需要返回数据展示
        sideBySideVoted = true;
        // 投票成功后隐藏投票区，展示“新一轮”按钮（不再弹出浏览器对话框）
        const voting = document.getElementById('sidebyside-voting');
        if (voting) voting.style.display = 'none';
        const newRound = document.getElementById('sidebyside-new-round');
        if (newRound) newRound.style.display = 'block';
    } catch (error) {
        console.error('投票失败:', error);
        showError('投票失败，请重试');
        buttons.forEach(btn => btn.disabled = false);
    }
}

function resetSideBySideRound() {
    sideBySideSessionId = null;
    sideBySideVoted = false;
    document.getElementById('sidebyside-response-a').innerHTML = '<div class="empty-state">等待回复...</div>';
    document.getElementById('sidebyside-response-b').innerHTML = '<div class="empty-state">等待回复...</div>';
    const voting = document.getElementById('sidebyside-voting');
    if (voting) voting.style.display = 'none';
    const newRound = document.getElementById('sidebyside-new-round');
    if (newRound) newRound.style.display = 'none';
    if (sideBySideInputSection) sideBySideInputSection.style.display = 'block';
    const sendBtn = document.getElementById('sidebyside-send-btn');
    if (sendBtn) sendBtn.disabled = false;
    document.getElementById('sidebyside-input').value = '';

    const userMsg = document.getElementById('sidebyside-user-msg');
    if (userMsg) {
        userMsg.textContent = '';
        userMsg.style.display = 'none';
    }
}

// ===== 排行榜 =====
function setupLeaderboard() {
    const refreshBtn = document.getElementById('refresh-leaderboard-btn');
    refreshBtn.addEventListener('click', loadLeaderboard);
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-content');
    container.innerHTML = '<div class="loading">加载排行榜...</div>';

    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error('加载排行榜失败');

        const data = await response.json();
        renderLeaderboard(data.leaderboard);

    } catch (error) {
        console.error('加载排行榜失败:', error);
        container.innerHTML = '<div class="empty-state">加载失败，请重试</div>';
    }
}

function renderLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-content');

    if (!leaderboard || leaderboard.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无排行榜数据，开始对战来贡献数据吧！</div>';
        return;
    }

    let html = `
        <div class="leaderboard-row header">
            <div class="rank">排名</div>
            <div class="model-name">模型</div>
            <div class="stat rating">评分</div>
        </div>
    `;

    leaderboard.forEach(item => {
        const rankEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '';
        html += `
            <div class="leaderboard-row">
                <div class="rank">${rankEmoji} ${item.rank}</div>
                <div class="model-name">${item.model_name}</div>
                <div class="stat rating">${item.rating}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ===== 历史对话模式 =====
function setupHistoryMode() {
    const refreshBtn = document.getElementById('refresh-history-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadHistory);
    }
}

// ===== 测评问题模式 =====
function setupQuestionsMode() {
    const refreshBtn = document.getElementById('refresh-questions-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadQuestions);
    }
}

async function loadQuestions() {
    const container = document.getElementById('questions-content');
    if (!container) {
        console.error('找不到 questions-content 容器');
        return;
    }

    container.innerHTML = '<div class="loading">加载问题列表...</div>';

    try {
        const response = await fetch('/api/battle/questions');

        if (!response.ok) {
            let errorMessage = '加载问题列表失败';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
                // 如果响应不是 JSON，尝试获取文本
                try {
                    const text = await response.text();
                    if (text) errorMessage = text;
                } catch (e2) {
                    // 忽略错误
                }
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('问题列表数据:', data);

        if (data && data.success !== undefined) {
            renderQuestions(data.questions || []);
        } else {
            // 兼容旧格式
            renderQuestions(data || []);
        }

    } catch (error) {
        console.error('加载问题列表失败:', error);
        const errorMsg = error.message || '加载失败，请稍后重试';
        container.innerHTML = `<div class="empty-state">加载失败：${errorMsg}</div>`;
    }
}

function renderQuestions(questions) {
    const container = document.getElementById('questions-content');
    if (!container) return;

    if (!questions || questions.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无问题记录，开始对战来提出问题吧！</div>';
        return;
    }

    let html = '<div class="questions-list-container">';

    questions.forEach((item, index) => {
        const createdDate = new Date(item.created_at).toLocaleString('zh-CN');
        const isValid = item.is_question_valid;
        const validClass = isValid === 1 ? 'selected' : '';
        const invalidClass = isValid === 0 ? 'selected' : '';

        html += `
            <div class="question-item" data-battle-id="${item.battle_id}">
                <div class="question-item-header">
                    <div class="question-number">问题 ${index + 1}</div>
                    <div class="question-date">${createdDate}</div>
                </div>
                <div class="question-content">
                    ${escapeHtml(item.question)}
                </div>
                <div class="question-valid-buttons">
                    <button class="question-valid-btn valid-btn ${validClass}" 
                            data-battle-id="${item.battle_id}" 
                            data-value="1"
                            onclick="updateQuestionValid('${item.battle_id}', 1)">
                        ✓ 符合要求
                    </button>
                    <button class="question-valid-btn invalid-btn ${invalidClass}" 
                            data-battle-id="${item.battle_id}" 
                            data-value="0"
                            onclick="updateQuestionValid('${item.battle_id}', 0)">
                        ✗ 不符合要求
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// 更新问题有效性标记
async function updateQuestionValid(battleId, isValid) {
    try {
        const response = await fetch('/api/battle/questions/update-valid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                battle_id: battleId,
                is_question_valid: isValid
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: '更新失败' }));
            throw new Error(errorData.detail || '更新失败');
        }

        const data = await response.json();

        // 更新UI：使用 battle_id 定位对应的按钮（每个问题都有唯一的 battle_id）
        const questionItem = document.querySelector(`.question-item[data-battle-id="${battleId}"]`);
        if (questionItem) {
            const validBtn = questionItem.querySelector('.valid-btn');
            const invalidBtn = questionItem.querySelector('.invalid-btn');

            // 移除所有选中状态
            if (validBtn) validBtn.classList.remove('selected');
            if (invalidBtn) invalidBtn.classList.remove('selected');

            // 添加新的选中状态
            if (isValid === 1 && validBtn) {
                validBtn.classList.add('selected');
            } else if (isValid === 0 && invalidBtn) {
                invalidBtn.classList.add('selected');
            }
        } else {
            console.warn('未找到对应的问题项:', battleId);
        }

        showMessage('问题有效性标记已更新');
    } catch (error) {
        console.error('更新问题有效性失败:', error);
        showError(error.message || '更新失败，请重试');
    }
}

async function loadHistory() {
    const container = document.getElementById('history-content');
    if (!container) {
        console.error('找不到 history-content 容器');
        return;
    }

    container.innerHTML = '<div class="loading">加载历史对话...</div>';

    try {
        const response = await fetch('/api/battle/history');

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: '加载历史对话失败' }));
            throw new Error(errorData.detail || '加载历史对话失败');
        }

        const data = await response.json();
        console.log('历史对话数据:', data);
        renderHistory(data.battles || []);

    } catch (error) {
        console.error('加载历史对话失败:', error);
        container.innerHTML = `<div class="empty-state">加载失败：${error.message}</div>`;
    }
}

function renderHistory(battles) {
    const container = document.getElementById('history-content');
    if (!container) return;

    if (!battles || battles.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无历史对话记录，开始对战来创建记录吧！</div>';
        return;
    }

    let html = '<div class="history-list-container">';

    battles.forEach(battle => {
        const conversationRounds = battle.conversation ? Math.floor(battle.conversation.length / 3) : 0; // 每轮：user + model_a + model_b
        const winnerText = battle.winner === 'model_a' ? '模型 A 获胜' :
            battle.winner === 'model_b' ? '模型 B 获胜' :
                battle.winner === 'tie' ? '两个都好' :
                    battle.winner === 'both_bad' ? '两个都不好' : '未投票';

        const createdDate = new Date(battle.created_at).toLocaleString('zh-CN');
        const isRevealed = battle.is_revealed === 1;

        html += `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">
                        <span class="history-models">模型 A vs 模型 B</span>
                        ${!isRevealed ? '<span class="history-status-badge">未揭示</span>' : ''}
                    </div>
                    <div class="history-item-meta">
                        <span class="history-date">${createdDate}</span>
                        <span class="history-winner">${winnerText}</span>
                    </div>
                </div>
                <div class="history-item-content">
                    <div class="history-stats">
                        <span>对话轮数：${conversationRounds}</span>
                    </div>
                    ${battle.conversation && battle.conversation.length > 0 ?
                renderConversationPreview(battle.conversation, isRevealed) :
                '<div class="history-empty-conversation">暂无对话内容</div>'}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderConversationPreview(conversation, isRevealed) {
    if (!conversation || conversation.length === 0) return '';

    // 显示完整的对话记录
    let html = '<div class="history-conversation-full">';

    for (let i = 0; i < conversation.length; i++) {
        const msg = conversation[i];
        const role = msg.role || 'assistant';
        let content = msg.content || '';

        if (role === 'user') {
            html += `<div class="history-msg user-msg">
                <div class="history-msg-label">👤 用户</div>
                <div class="history-msg-content">${escapeHtml(content)}</div>
            </div>`;
        } else if (role === 'assistant') {
            // 解析 "[Model A]: ..." 或 "[Model B]: ..." 格式
            const modelAMatch = content.match(/^\[Model A\]:\s*(.+)/s);
            const modelBMatch = content.match(/^\[Model B\]:\s*(.+)/s);

            if (modelAMatch) {
                const modelContent = modelAMatch[1].trim();
                html += `<div class="history-msg model-a-msg">
                    <div class="history-msg-label">模型 A</div>
                    <div class="history-msg-content markdown-content">${renderMarkdown(modelContent)}</div>
                </div>`;
            } else if (modelBMatch) {
                const modelContent = modelBMatch[1].trim();
                html += `<div class="history-msg model-b-msg">
                    <div class="history-msg-label">模型 B</div>
                    <div class="history-msg-content markdown-content">${renderMarkdown(modelContent)}</div>
                </div>`;
            } else {
                // 如果没有匹配到格式，直接显示内容
                html += `<div class="history-msg assistant-msg">
                    <div class="history-msg-label">助手</div>
                    <div class="history-msg-content markdown-content">${renderMarkdown(content)}</div>
                </div>`;
            }
        }
    }

    html += '</div>';
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Markdown 渲染函数
function renderMarkdown(text) {
    if (!text) return '';
    try {
        // 配置 marked 选项
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,  // 支持 GitHub 风格的换行
                gfm: true,     // 启用 GitHub Flavored Markdown
                headerIds: false,
                mangle: false
            });
            return marked.parse(text);
        } else {
            // 如果 marked 未加载，返回转义的 HTML
            return escapeHtml(text);
        }
    } catch (error) {
        console.error('Markdown 渲染失败:', error);
        return escapeHtml(text);
    }
}

// ===== 工具函数 =====
function showLoading(mode) {
    // 可以添加全局加载指示器
}

let __toastTimer = null;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        // 兜底
        alert(message);
        return;
    }
    toast.textContent = message;
    toast.classList.remove('error', 'success');
    if (type === 'error') toast.classList.add('error');
    if (type === 'success') toast.classList.add('success');
    toast.classList.add('show');

    if (__toastTimer) clearTimeout(__toastTimer);
    __toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}

function showError(message) {
    showToast(message, 'error');
}

// 一般提示信息
function showMessage(message) {
    showToast(message, 'success');
}

// ===== 小学生友好的庆祝效果 =====
function showVoteCelebration(winner) {
    // 获取对应的投票按钮并添加选中效果
    const clickedBtn = document.querySelector(`.battle-vote-btn[data-winner="${winner}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('selected');
    }

    // 创建庆祝消息 - 小动物主题
    const messages = {
        'model_a': ['🦊 小狐狸赢啦！', '🎉 小狐狸好聪明！', '✨ 你支持小狐狸！', '🌟 小狐狸真棒！'],
        'model_b': ['🐰 小兔子赢啦！', '🎉 小兔子好厉害！', '✨ 你支持小兔子！', '🌟 小兔子真棒！'],
        'tie': ['🎊 它们都超棒！', '🌈 小狐狸和小兔子都很厉害！', '👏 两个都是好朋友！'],
        'both_bad': ['💪 它们会加油的！', '🌱 下次会更好！', '😊 继续努力吧！']
    };

    const msgList = messages[winner] || ['🎉 投票成功！'];
    const randomMsg = msgList[Math.floor(Math.random() * msgList.length)];

    // 显示庆祝 toast
    showCelebrationToast(randomMsg);

    // 发射彩色粒子效果
    createConfetti();
}

// 庆祝提示（带动画）
function showCelebrationToast(message) {
    // 创建临时的庆祝提示元素
    const celebration = document.createElement('div');
    celebration.className = 'celebration-toast';
    celebration.innerHTML = `<span class="celebration-text">${message}</span>`;
    document.body.appendChild(celebration);

    // 触发动画
    setTimeout(() => celebration.classList.add('show'), 10);

    // 移除元素
    setTimeout(() => {
        celebration.classList.remove('show');
        setTimeout(() => celebration.remove(), 300);
    }, 2000);
}

// 创建彩色粒子/confetti 效果
function createConfetti() {
    const colors = ['#ff6b9d', '#4facfe', '#22c55e', '#fbbf24', '#a855f7', '#ec4899', '#00f2fe'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    // 创建多个彩色粒子
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.setProperty('--x', `${Math.random() * 100}vw`);
        confetti.style.setProperty('--delay', `${Math.random() * 0.5}s`);
        confetti.style.setProperty('--rotation', `${Math.random() * 360}deg`);
        confetti.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
        container.appendChild(confetti);
    }

    // 清理粒子
    setTimeout(() => container.remove(), 3000);
}
