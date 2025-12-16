// LMArena 前端应用
console.log('=== app.js 开始加载 ===');

// 全局错误监听
window.addEventListener('error', (event) => {
    console.error('=== 全局错误捕获 ===');
    console.error('错误消息:', event.message);
    console.error('错误文件:', event.filename);
    console.error('错误行号:', event.lineno);
    console.error('错误列号:', event.colno);
    console.error('错误对象:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('=== 未处理的 Promise 拒绝 ===');
    console.error('原因:', event.reason);
    console.error('Promise:', event.promise);
});

// 全局状态
let currentMode = 'battle';
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;

console.log('=== 全局变量已初始化 ===');

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== DOMContentLoaded 事件触发 ===');
    
    try {
        // 加载可用模型
        console.log('1. 加载模型列表...');
        await loadModels();
        console.log('✓ 模型列表加载完成');
        
        // 设置模式切换
        console.log('2. 设置模式切换...');
        setupModeSelector();
        console.log('✓ 模式切换设置完成');
        
        // 设置对战模式
        console.log('3. 设置对战模式...');
        setupBattleMode();
        console.log('✓ 对战模式设置完成');
        
        // 设置并排对比模式
        console.log('4. 设置并排对比模式...');
        setupSideBySideMode();
        console.log('✓ 并排对比模式设置完成');
        
        // 设置排行榜
        console.log('5. 设置排行榜...');
        setupLeaderboard();
        console.log('✓ 排行榜设置完成');
        
        // 初始加载排行榜
        console.log('6. 加载排行榜数据...');
        loadLeaderboard();
        console.log('✓ 初始化完成！');
        
    } catch (error) {
        console.error('初始化过程中发生错误:', error);
    }
});

// 加载可用模型
async function loadModels() {
    try {
        console.log('  → 开始请求 /api/chat/models');
        const response = await fetch('/api/chat/models');
        console.log('  → 响应状态:', response.status);
        
        const data = await response.json();
        console.log('  → 收到模型数据:', data);
        
        availableModels = data.models;
        console.log('  → 可用模型数量:', availableModels.length);
        
        // 填充模型选择器
        console.log('  → 填充模型选择器...');
        populateModelSelectors();
        console.log('  → 模型选择器填充完成');
    } catch (error) {
        console.error('加载模型失败:', error);
        showError('加载模型列表失败');
        throw error; // 重新抛出错误，以便在初始化中捕获
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
        showError('发送消息失败，请重试');
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
    
    console.log('设置 Side-by-Side 模式');
    console.log('发送按钮:', sendBtn);
    console.log('输入框:', input);
    
    if (!sendBtn) {
        console.error('找不到 sidebyside-send-btn 元素！');
        return;
    }
    
    if (!input) {
        console.error('找不到 sidebyside-input 元素！');
        return;
    }
    
    sendBtn.addEventListener('click', () => {
        console.log('Side-by-Side 发送按钮被点击');
        sendSideBySideMessage();
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('Side-by-Side Enter 键按下');
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
    console.log('===== sendSideBySideMessage 函数被调用 =====');
    
    const sendBtn = document.getElementById('sidebyside-send-btn');
    console.log('发送按钮元素:', sendBtn);
    console.log('按钮是否已禁用:', sendBtn?.disabled);
    
    // 如果按钮已经禁用，说明正在处理中，直接返回
    if (sendBtn && sendBtn.disabled) {
        console.warn('按钮已禁用，可能正在处理中，忽略本次点击');
        return;
    }
    
    const input = document.getElementById('sidebyside-input');
    const message = input.value.trim();
    
    console.log('消息内容:', message);
    
    if (!message) {
        console.log('消息为空，返回');
        return;
    }
    
    const modelAId = document.getElementById('sidebyside-model-a').value;
    const modelBId = document.getElementById('sidebyside-model-b').value;
    
    console.log('模型 A ID:', modelAId);
    console.log('模型 B ID:', modelBId);
    
    if (!sendBtn) {
        console.error('找不到发送按钮！');
        return;
    }
    
    console.log('禁用发送按钮...');
    sendBtn.disabled = true;
    
    try {
        console.log('更新响应区域为"思考中"...');
        const responseA = document.getElementById('sidebyside-response-a');
        const responseB = document.getElementById('sidebyside-response-b');
        console.log('响应区域 A:', responseA);
        console.log('响应区域 B:', responseB);
        
        responseA.innerHTML = '<div class="loading">思考中...</div>';
        responseB.innerHTML = '<div class="loading">思考中...</div>';
        
        console.log('准备发送 fetch 请求...');
        console.log('  - model_a_id:', modelAId);
        console.log('  - model_b_id:', modelBId);
        console.log('  - message:', message);
        console.log('  - session_id:', sideBySideSessionId);
        
        // 准备请求体
        const requestBody = {
            model_a_id: modelAId,
            model_b_id: modelBId,
            message: message,
            session_id: sideBySideSessionId
        };
        
        console.log('准备 JSON.stringify...');
        let requestBodyString;
        try {
            requestBodyString = JSON.stringify(requestBody);
            console.log('✓ JSON.stringify 成功，长度:', requestBodyString.length);
        } catch (jsonError) {
            console.error('!!! JSON.stringify 失败 !!!', jsonError);
            throw jsonError;
        }
        
        console.log('开始执行 fetch...');
        console.log('  - URL: /api/chat/sidebyside');
        console.log('  - Method: POST');
        
        let response;
        try {
            const fetchPromise = fetch('/api/chat/sidebyside', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBodyString
            });
            
            console.log('fetch Promise 已创建，等待响应...');
            
            // 添加超时处理（30秒）
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Fetch 超时（30秒）')), 30000);
            });
            
            response = await Promise.race([fetchPromise, timeoutPromise]);
            console.log('✓ fetch 调用成功，收到响应');
        } catch (fetchError) {
            console.error('!!! fetch 调用失败 !!!');
            console.error('错误类型:', fetchError.name);
            console.error('错误消息:', fetchError.message);
            console.error('完整错误:', fetchError);
            throw fetchError;
        }
        
        console.log('fetch 请求完成，响应状态:', response.status);
        
        if (!response.ok) {
            console.error('响应状态不是 OK:', response.status, response.statusText);
            throw new Error('发送消息失败');
        }
        
        console.log('开始解析 JSON 响应...');
        const data = await response.json();
        console.log('收到响应数据:', data);
        sideBySideSessionId = data.session_id;
        
        document.getElementById('sidebyside-response-a').textContent = data.response_a;
        document.getElementById('sidebyside-response-b').textContent = data.response_b;

        // 显示投票区并重置状态
        sideBySideVoted = false;
        document.getElementById('sidebyside-voting').style.display = 'block';
        document.querySelectorAll('#sidebyside-voting .vote-btn').forEach(btn => btn.disabled = false);
        
        input.value = '';
        
    } catch (error) {
        console.error('!!! 捕获到错误 !!!');
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        showError('发送消息失败，请重试');
    } finally {
        console.log('执行 finally 块，重新启用按钮');
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
        showError('投票成功，感谢反馈！');
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
    alert(message);
}

