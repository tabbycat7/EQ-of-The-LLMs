// LMArena 前端应用

// 全局状态
let currentMode = 'battle';
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 加载可用模型
    await loadModels();

    // 设置模式切换
    setupModeSelector();

    // 设置对战模式
    setupBattleMode();

    // 设置并排对比模式
    setupSideBySideMode();

    // 设置排行榜
    setupLeaderboard();

    // 初始加载排行榜
    loadLeaderboard();
});

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
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // 更新按钮状态
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新内容显示
            modeContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${mode}-mode`).classList.add('active');

            currentMode = mode;

            // 如果切换到排行榜，刷新数据
            if (mode === 'leaderboard') {
                loadLeaderboard();
            }
        });
    });
}

// ===== 对战模式 =====
function setupBattleMode() {
    const startBtn = document.getElementById('start-battle-btn');
    const newBattleBtn = document.getElementById('new-battle-btn');
    const sendBtn = document.getElementById('battle-send-btn');
    const input = document.getElementById('battle-input');
    const voteButtons = document.querySelectorAll('.battle-vote-btn');

    startBtn.addEventListener('click', startBattle);
    newBattleBtn.addEventListener('click', startBattle);
    sendBtn.addEventListener('click', sendBattleMessage);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBattleMessage();
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
        battleSessionId = data.session_id;

        // 显示聊天界面
        document.getElementById('battle-start').style.display = 'none';
        document.getElementById('battle-chat').style.display = 'block';

        // 重置界面
        document.getElementById('response-a').innerHTML = '<div class="empty-state">等待回复...</div>';
        document.getElementById('response-b').innerHTML = '<div class="empty-state">等待回复...</div>';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('reveal-section').style.display = 'none';
        document.getElementById('battle-input').value = '';
        document.getElementById('battle-send-btn').disabled = false;

    } catch (error) {
        console.error('启动对战失败:', error);
        showError('启动对战失败，请重试');
    }
}

async function sendBattleMessage() {
    const input = document.getElementById('battle-input');
    const message = input.value.trim();

    if (!message || !battleSessionId) return;

    const sendBtn = document.getElementById('battle-send-btn');
    sendBtn.disabled = true;

    try {
        // 显示加载状态
        document.getElementById('response-a').innerHTML = '<div class="loading">思考中...</div>';
        document.getElementById('response-b').innerHTML = '<div class="loading">思考中...</div>';

        const response = await fetch('/api/battle/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: battleSessionId,
                message: message
            })
        });

        if (!response.ok) throw new Error('发送消息失败');

        const data = await response.json();

        // 显示回复
        document.getElementById('response-a').textContent = data.response_a;
        document.getElementById('response-b').textContent = data.response_b;

        // 显示投票区域
        document.getElementById('voting-section').style.display = 'block';

        input.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        // 在对战模式中，发送失败只在界面中提示，不再弹出对话框
        document.getElementById('response-a').innerHTML = '<div class="empty-state">发送失败，请稍后重试。</div>';
        document.getElementById('response-b').innerHTML = '<div class="empty-state">发送失败，请稍后重试。</div>';
        sendBtn.disabled = false;
    }
}

async function submitVote(winner) {
    try {
        const response = await fetch('/api/battle/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: battleSessionId,
                winner: winner
            })
        });

        if (!response.ok) throw new Error('投票失败');

        const data = await response.json();

        // 隐藏投票区域
        document.getElementById('voting-section').style.display = 'none';

        // 显示揭示区域
        document.getElementById('reveal-model-a').textContent = data.model_a_name;
        document.getElementById('reveal-model-b').textContent = data.model_b_name;
        document.getElementById('reveal-section').style.display = 'block';

        // 禁用发送按钮
        document.getElementById('battle-send-btn').disabled = true;

        // 仅在投票成功后弹出提示对话框
        showMessage('投票成功，感谢你的反馈！');

    } catch (error) {
        console.error('投票失败:', error);
        showError('投票失败，请重试');
    }
}

// ===== 并排对比模式 =====
function setupSideBySideMode() {
    const sendBtn = document.getElementById('sidebyside-send-btn');
    const input = document.getElementById('sidebyside-input');
    const voteButtons = document.querySelectorAll('.sidebyside-vote-btn');

    sendBtn.addEventListener('click', sendSideBySideMessage);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendSideBySideMessage();
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

    if (!message) return;

    const modelAId = document.getElementById('sidebyside-model-a').value;
    const modelBId = document.getElementById('sidebyside-model-b').value;

    const sendBtn = document.getElementById('sidebyside-send-btn');
    sendBtn.disabled = true;

    try {
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

        document.getElementById('sidebyside-response-a').textContent = data.response_a;
        document.getElementById('sidebyside-response-b').textContent = data.response_b;

        // 显示投票区并重置状态
        sideBySideVoted = false;
        document.getElementById('sidebyside-voting').style.display = 'block';
        document.querySelectorAll('#sidebyside-voting .vote-btn').forEach(btn => btn.disabled = false);

        input.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        // 在并排对比模式中，发送失败只在界面中提示，不再弹出对话框
        document.getElementById('sidebyside-response-a').innerHTML = '<div class="empty-state">发送失败，请稍后重试。</div>';
        document.getElementById('sidebyside-response-b').innerHTML = '<div class="empty-state">发送失败，请稍后重试。</div>';
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
        // 仅在投票成功后弹出提示对话框
        showMessage('投票成功，感谢反馈！');
    } catch (error) {
        console.error('投票失败:', error);
        showError('投票失败，请重试');
        buttons.forEach(btn => btn.disabled = false);
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
            <div>排名</div>
            <div>模型</div>
            <div>评分</div>
            <div>对战数</div>
            <div>胜率</div>
            <div>胜/负/平</div>
        </div>
    `;

    leaderboard.forEach(item => {
        const rankEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '';
        html += `
            <div class="leaderboard-row">
                <div class="rank">${rankEmoji} ${item.rank}</div>
                <div class="model-name">${item.model_name}</div>
                <div class="stat rating">${item.rating}</div>
                <div class="stat">${item.total_battles}</div>
                <div class="stat">${item.win_rate}%</div>
                <div class="stat">${item.wins}/${item.losses}/${item.ties}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ===== 工具函数 =====
function showLoading(mode) {
    // 可以添加全局加载指示器
}

function showError(message) {
    // 错误信息：可以考虑后续改为页面内的 toast，而不是 alert
    alert(message);
}

// 一般提示信息，仅在投票之后弹出
function showMessage(message) {
    alert(message);
}

