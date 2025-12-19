// LMArena 前端应用

// 全局状态
let currentMode = 'battle';
let currentUserId = null; // 当前登录用户ID
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;

// 输入区域引用，便于统一显示/隐藏
let battleInputSection = null;
let sideBySideInputSection = null;

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 检查登录状态
    await checkLoginStatus();
});

// 检查登录状态
async function checkLoginStatus() {
    // 默认显示登录界面（防止闪烁）
    showLoginModal();

    try {
        const response = await fetch('/api/auth/check', {
            credentials: 'include'  // 重要：包含cookies
        });
        const data = await response.json();

        if (data.success && data.user_id) {
            // 记录当前登录用户ID
            currentUserId = data.user_id;
            // 已登录，显示主界面
            showMainApp();
            // 初始化应用
            await initApp();
        } else {
            // 未登录，清空当前用户ID
            currentUserId = null;
            // 未登录，保持显示登录界面（已经在上面设置了）
            // 确保登录界面可见
            showLoginModal();
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
        // 出错时保持显示登录界面（已经在上面设置了）
        showLoginModal();
    }
}

// 显示登录界面
function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const appShell = document.getElementById('app-shell');
    if (loginModal) loginModal.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';

    // 重置登录表单：清空输入框和错误信息，重置按钮状态
    const userIdInput = document.getElementById('login-user-id');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    const errorDiv = document.getElementById('login-error');

    if (userIdInput) userIdInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    // 设置登录表单提交事件
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = handleLogin;
    }

    // 聚焦到用户ID输入框，方便用户输入
    if (userIdInput) {
        setTimeout(() => userIdInput.focus(), 100);
    }
}

// 显示主应用界面
function showMainApp() {
    const loginModal = document.getElementById('login-modal');
    const appShell = document.getElementById('app-shell');
    if (loginModal) loginModal.style.display = 'none';
    if (appShell) appShell.style.display = 'flex';
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();

    const userIdInput = document.getElementById('login-user-id');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    const errorDiv = document.getElementById('login-error');

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    if (!userId || !password) {
        showLoginError('请输入用户ID和密码');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    if (errorDiv) {
        errorDiv.style.display = 'none';
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',  // 重要：包含cookies
            body: JSON.stringify({
                user_id: userId,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 记录当前登录用户ID
            currentUserId = data.user_id || null;
            // 登录成功，显示主界面
            showMainApp();
            // 初始化应用
            await initApp();
        } else {
            // 登录失败
            showLoginError(data.message || '登录失败，请检查用户名和密码');
            submitBtn.disabled = false;
            submitBtn.textContent = '登录';
        }
    } catch (error) {
        console.error('登录失败:', error);
        showLoginError('登录失败，请稍后重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
}

// 显示登录错误
function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// 初始化应用（在登录成功后调用）
async function initApp() {
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

    // 设置历史对话
    setupHistoryMode();

    // 设置退出登录
    setupLogout();

    // 设置管理员面板（仅 admin 可见）
    setupAdminPanel();

    // 初始加载排行榜
    loadLeaderboard();
}

// 设置退出登录功能
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// 设置管理员面板（仅 admin 可见）
function setupAdminPanel() {
    const adminPanel = document.getElementById('admin-panel');
    const addBtn = document.getElementById('admin-add-user-btn');
    const cancelBtn = document.getElementById('admin-cancel-btn');
    const toggleBtn = document.getElementById('admin-toggle-panel-btn');
    const msgDiv = document.getElementById('admin-add-user-msg');

    if (!adminPanel || !addBtn || !toggleBtn) return;

    // 每次初始化时先重置面板内容并隐藏
    adminPanel.style.display = 'none';
    if (msgDiv) {
        msgDiv.textContent = '';
    }

    // 隐藏面板的函数
    const hideAdminPanel = () => {
        adminPanel.style.display = 'none';
        const userIdInput = document.getElementById('admin-new-user-id');
        const passwordInput = document.getElementById('admin-new-user-password');
        if (userIdInput) userIdInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (msgDiv) {
            msgDiv.textContent = '';
            msgDiv.style.color = '#6b7280';
        }
    };

    // 仅 admin 显示"添加用户"按钮
    if (currentUserId === 'admin') {
        toggleBtn.style.display = 'inline-flex';
        toggleBtn.onclick = () => {
            // 点击时展开面板，并清空输入
            const userIdInput = document.getElementById('admin-new-user-id');
            const passwordInput = document.getElementById('admin-new-user-password');
            if (userIdInput) userIdInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (msgDiv) {
                msgDiv.textContent = '';
                msgDiv.style.color = '#6b7280';
            }
            adminPanel.style.display = 'block';
            if (userIdInput) {
                setTimeout(() => userIdInput.focus(), 50);
            }
        };
        addBtn.onclick = handleAdminAddUser;
        if (cancelBtn) {
            cancelBtn.onclick = hideAdminPanel;
        }
    } else {
        toggleBtn.style.display = 'none';
        adminPanel.style.display = 'none';
    }
}

// 处理退出登录
async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'  // 重要：包含cookies
        });

        const data = await response.json();

        if (data.success) {
            // 清空当前用户ID
            currentUserId = null;
            // 退出成功，显示登录界面
            showLoginModal();
            // 清空前端状态
            battleSessionId = null;
            sideBySideSessionId = null;
            showMessage('已退出登录');
        } else {
            showError('退出登录失败');
        }
    } catch (error) {
        console.error('退出登录失败:', error);
        // 即使API调用失败，也尝试显示登录界面
        showLoginModal();
        showError('退出登录失败，请重试');
    }
}

// 管理员添加用户
async function handleAdminAddUser() {
    const userIdInput = document.getElementById('admin-new-user-id');
    const passwordInput = document.getElementById('admin-new-user-password');
    const msgDiv = document.getElementById('admin-add-user-msg');
    const addBtn = document.getElementById('admin-add-user-btn');

    if (!userIdInput || !passwordInput || !addBtn) return;

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    if (!userId || !password) {
        if (msgDiv) {
            msgDiv.textContent = '请输入新用户ID和密码';
            msgDiv.style.color = '#b91c1c';
        }
        return;
    }

    addBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                user_id: userId,
                password: password,
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // 清空输入框并提示成功
            userIdInput.value = '';
            passwordInput.value = '';
            if (msgDiv) {
                msgDiv.textContent = '用户添加成功';
                msgDiv.style.color = '#166534';
            }
            // 添加成功后自动隐藏面板
            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) {
                setTimeout(() => {
                    adminPanel.style.display = 'none';
                }, 500);
            }
        } else {
            if (msgDiv) {
                msgDiv.textContent = data.detail || data.message || '添加用户失败';
                msgDiv.style.color = '#b91c1c';
            }
        }
    } catch (error) {
        console.error('添加用户失败:', error);
        if (msgDiv) {
            msgDiv.textContent = '添加用户失败，请稍后重试';
            msgDiv.style.color = '#b91c1c';
        }
    } finally {
        addBtn.disabled = false;
    }
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
        btn.addEventListener('click', () => {
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

            // 如果切换到排行榜，刷新数据
            if (mode === 'leaderboard') {
                loadLeaderboard();
            }
            // 如果切换到历史对话，加载历史记录
            if (mode === 'history') {
                loadHistory();
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
            method: 'POST',
            credentials: 'include'  // 确保包含 cookies（用于 session 认证）
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
                <div class="response-box">
                    <div class="response-header">模型 A</div>
                    <div class="response-content" data-role="response-a">
                        <div class="loading">思考中...</div>
                    </div>
                    <div class="evaluation-section" data-model="model_a" style="display: none;">
                        <div class="evaluation-title">测评维度</div>
                        <div class="evaluation-dimensions">
                            <div class="evaluation-item">
                                <label>感知</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="perception" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="perception" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>校准</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="calibration" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="calibration" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>分化</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="differentiation" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="differentiation" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>调节</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="regulation" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="regulation" data-value="0">不符合要求</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="response-box">
                    <div class="response-header">模型 B</div>
                    <div class="response-content" data-role="response-b">
                        <div class="loading">思考中...</div>
                    </div>
                    <div class="evaluation-section" data-model="model_b" style="display: none;">
                        <div class="evaluation-title">测评维度</div>
                        <div class="evaluation-dimensions">
                            <div class="evaluation-item">
                                <label>感知</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="perception" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="perception" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>校准</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="calibration" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="calibration" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>分化</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="differentiation" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="differentiation" data-value="0">不符合要求</button>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>调节</label>
                                <div class="evaluation-options">
                                    <button class="eval-btn" data-dimension="regulation" data-value="1">符合要求</button>
                                    <button class="eval-btn" data-dimension="regulation" data-value="0">不符合要求</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="evaluation-submit-section" style="display: none;">
                <button class="submit-evaluation-btn primary-btn">提交测评</button>
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
            credentials: 'include',  // 确保包含 cookies（用于 session 认证）
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
            responseA.innerHTML = finalA || '';
        }
        if (responseB) {
            responseB.innerHTML = finalB || '';
        }

        // 显示测评维度选择界面
        const evalSections = roundEl.querySelectorAll('.evaluation-section');
        evalSections.forEach(section => section.style.display = 'block');
        const submitSection = roundEl.querySelector('.evaluation-submit-section');
        if (submitSection) submitSection.style.display = 'block';

        // 设置测评维度选择事件
        setupEvaluationButtons(roundEl);

        // 隐藏投票区域（等测评提交后才显示）
        document.getElementById('voting-section').style.display = 'none';

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

// 设置测评维度选择按钮
function setupEvaluationButtons(roundEl) {
    const evalButtons = roundEl.querySelectorAll('.eval-btn');
    const submitBtn = roundEl.querySelector('.submit-evaluation-btn');

    // 存储当前轮的测评数据
    const evaluationData = {
        model_a: { perception: null, calibration: null, differentiation: null, regulation: null },
        model_b: { perception: null, calibration: null, differentiation: null, regulation: null }
    };

    evalButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const model = this.closest('.evaluation-section').dataset.model;
            const dimension = this.dataset.dimension;
            const value = parseInt(this.dataset.value);

            // 更新数据
            evaluationData[model][dimension] = value;

            // 更新按钮样式：同维度其他按钮取消选中，当前按钮选中
            const dimensionGroup = this.closest('.evaluation-item');
            const allButtonsInGroup = dimensionGroup.querySelectorAll('.eval-btn');
            allButtonsInGroup.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            // 检查是否所有维度都已选择
            const allSelected = checkAllDimensionsSelected(roundEl, evaluationData);
            if (submitBtn) {
                submitBtn.disabled = !allSelected;
            }
        });
    });

    // 提交测评按钮
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.addEventListener('click', async () => {
            await submitEvaluation(roundEl, evaluationData);
        });
    }
}

// 检查是否所有维度都已选择
function checkAllDimensionsSelected(roundEl, evaluationData) {
    const dimensions = ['perception', 'calibration', 'differentiation', 'regulation'];
    for (const model of ['model_a', 'model_b']) {
        for (const dim of dimensions) {
            if (evaluationData[model][dim] === null) {
                return false;
            }
        }
    }
    return true;
}

// 提交测评维度
async function submitEvaluation(roundEl, evaluationData) {
    try {
        const submitBtn = roundEl.querySelector('.submit-evaluation-btn');
        if (submitBtn) submitBtn.disabled = true;

        const response = await fetch('/api/battle/evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // 确保包含 cookies（用于 session 认证）
            body: JSON.stringify({
                session_id: battleSessionId,
                evaluation: evaluationData
            })
        });

        if (!response.ok) throw new Error('提交测评失败');

        // 隐藏测评区域
        const evalSections = roundEl.querySelectorAll('.evaluation-section');
        evalSections.forEach(section => section.style.display = 'none');
        const submitSection = roundEl.querySelector('.evaluation-submit-section');
        if (submitSection) submitSection.style.display = 'none';

        // 显示投票区域
        document.getElementById('voting-section').style.display = 'block';

    } catch (error) {
        console.error('提交测评失败:', error);
        showError('提交测评失败，请重试');
        const submitBtn = roundEl.querySelector('.submit-evaluation-btn');
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function submitVote(winner) {
    try {
        const response = await fetch('/api/battle/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // 确保包含 cookies（用于 session 认证）
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
                // 如果已经投过票，可能是重复点击，提示用户
                if (response.status === 400 && errorData.detail && errorData.detail.includes('已经投过票')) {
                    errorMessage += '（请刷新页面后重新开始对战）';
                }
            } catch (e) {
                // 如果响应不是 JSON，使用默认错误信息
                errorMessage = `投票失败 (HTTP ${response.status})`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        // 隐藏投票区域
        document.getElementById('voting-section').style.display = 'none';

        // 显示"开始新对战 / 继续当前模型对战"按钮区域
        document.getElementById('reveal-section').style.display = 'block';

        // 本轮投票完成后：保持输入区域隐藏，发送按钮禁用
        // 只有点击"开始新对战"按钮（startBattle/newBattle）才重新出现输入框
        const sendBtn = document.getElementById('battle-send-btn');
        sendBtn.disabled = true;
        if (battleInputSection) battleInputSection.style.display = 'none';

    } catch (error) {
        console.error('投票失败:', error);
        const errorMessage = error.message || '投票失败，请重试';
        showError(errorMessage);
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
            credentials: 'include',  // 确保包含 cookies（用于 session 认证）
            body: JSON.stringify({ session_id: battleSessionId }),
        });

        if (!resp.ok) {
            throw new Error('继续对战失败');
        }

        const data = await resp.json();
        // 使用新的 session_id，避免投票时命中“该对战已经投过票了”的限制
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

        document.getElementById('sidebyside-response-a').textContent = data.response_a;
        document.getElementById('sidebyside-response-b').textContent = data.response_b;

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

// ===== 历史对话模式 =====
function setupHistoryMode() {
    const refreshBtn = document.getElementById('refresh-history-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadHistory);
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
        const response = await fetch('/api/battle/history', {
            credentials: 'include'  // 确保包含 cookies（用于 session 认证）
        });

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
                    ${battle.conversation && battle.conversation.length > 0 ? `
                    <div class="history-conversation-preview">
                        ${renderConversationPreview(battle.conversation, isRevealed)}
                    </div>
                    ` : '<div class="history-empty-conversation">暂无对话内容</div>'}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderConversationPreview(conversation, isRevealed) {
    if (!conversation || conversation.length === 0) return '';

    // 只显示最近几轮对话作为预览
    const previewRounds = Math.min(2, Math.floor(conversation.length / 3));
    let html = '';

    const startIndex = Math.max(0, conversation.length - previewRounds * 3);
    for (let i = startIndex; i < conversation.length; i++) {
        const msg = conversation[i];
        const role = msg.role || 'assistant';
        let content = msg.content || '';

        if (role === 'user') {
            html += `<div class="history-msg user-msg">👤 用户：${escapeHtml(content.substring(0, 100))}${content.length > 100 ? '...' : ''}</div>`;
        } else if (role === 'assistant') {
            // 解析 "[Model A]: ..." 或 "[Model B]: ..." 格式
            const modelAMatch = content.match(/^\[Model A\]:\s*(.+)/s);
            const modelBMatch = content.match(/^\[Model B\]:\s*(.+)/s);

            if (modelAMatch) {
                const modelContent = modelAMatch[1].trim();
                html += `<div class="history-msg model-a-msg">模型 A：${escapeHtml(modelContent.substring(0, 100))}${modelContent.length > 100 ? '...' : ''}</div>`;
            } else if (modelBMatch) {
                const modelContent = modelBMatch[1].trim();
                html += `<div class="history-msg model-b-msg">模型 B：${escapeHtml(modelContent.substring(0, 100))}${modelContent.length > 100 ? '...' : ''}</div>`;
            }
        }
    }

    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
