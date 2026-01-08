// LMArena 前端应用

// Markdown 渲染函数
function renderMarkdown(text) {
    if (!text) return '';
    try {
        // 检查 marked 是否可用
        if (typeof marked !== 'undefined') {
            // 配置 marked 选项
            marked.setOptions({
                breaks: true,  // 支持换行
                gfm: true,    // 启用 GitHub Flavored Markdown
            });
            return marked.parse(text);
        } else {
            // 如果 marked 不可用，返回转义后的文本
            return escapeHtml(text);
        }
    } catch (error) {
        console.error('Markdown 渲染失败:', error);
        return escapeHtml(text);
    }
}

// HTML 转义函数（如果还没有的话，检查是否已存在）
if (typeof escapeHtml === 'undefined') {
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 全局状态
let currentMode = 'battle';
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;
let hasUserInfo = false;  // 用户是否已填写信息

// 输入区域引用，便于统一显示/隐藏
let battleInputSection = null;
let sideBySideInputSection = null;
let philosophyInputSection = null;

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 检查用户是否已填写信息
    await checkUserInfo();
});

// 检查用户信息
async function checkUserInfo() {
    try {
        const response = await fetch('/api/user/check');
        const data = await response.json();

        if (data.has_info) {
            // 用户已填写信息，直接进入应用
            hasUserInfo = true;
            await initApp();
        } else {
            // 显示用户信息收集表单
            showUserInfoForm();
        }
    } catch (error) {
        console.error('检查用户信息失败:', error);
        // 出错时也显示表单
        showUserInfoForm();
    }
}

// 显示用户信息收集表单
function showUserInfoForm() {
    const appShell = document.getElementById('app-shell');
    appShell.innerHTML = `
        <div class="user-info-modal">
            <div class="user-info-container">
                <div class="user-info-header">
                    <h2>前沿AI体验平台</h2>
                    <p>请先填写您的基本信息，以便更好地为您服务</p>
                </div>
                
                <form id="user-info-form" class="user-info-form">
                    <div class="form-group">
                        <label for="region">地区 *</label>
                        <input type="text" id="region" name="region" placeholder="例如：河南省郑州市" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="school">学校 *</label>
                        <input type="text" id="school" name="school" placeholder="例如：XX小学" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="subject">学科 *</label>
                        <select id="subject" name="subject" required>
                            <option value="">请选择</option>
                            <option value="语文">语文</option>
                            <option value="数学">数学</option>
                            <option value="英语">英语</option>
                            <option value="物理">物理</option>
                            <option value="化学">化学</option>
                            <option value="生物">生物</option>
                            <option value="历史">历史</option>
                            <option value="地理">地理</option>
                            <option value="政治">政治</option>
                            <option value="信息科技">信息科技</option>
                            <option value="音体美/综合实践">音体美/综合实践</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="grade">授课年级 *</label>
                        <select id="grade" name="grade" required>
                            <option value="">请选择</option>
                            <option value="一年级">一年级</option>
                            <option value="二年级">二年级</option>
                            <option value="三年级">三年级</option>
                            <option value="四年级">四年级</option>
                            <option value="五年级">五年级</option>
                            <option value="六年级">六年级</option>
                            <option value="七年级">七年级</option>
                            <option value="八年级">八年级</option>
                            <option value="九年级">九年级</option>
                            <option value="高一">高一</option>
                            <option value="高二">高二</option>
                            <option value="高三">高三</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="primary-btn">开始使用</button>
                    </div>
                    
                    <div id="form-error" class="form-error" style="display: none;"></div>
                </form>
            </div>
        </div>
    `;

    // 设置表单提交事件
    const form = document.getElementById('user-info-form');
    form.addEventListener('submit', handleUserInfoSubmit);
}

// 处理用户信息提交
async function handleUserInfoSubmit(e) {
    e.preventDefault();

    const formData = {
        region: document.getElementById('region').value.trim(),
        school: document.getElementById('school').value.trim(),
        subject: document.getElementById('subject').value,
        grade: document.getElementById('grade').value
    };

    // 验证
    if (!formData.region || !formData.school || !formData.subject || !formData.grade) {
        showFormError('请填写所有必填项');
        return;
    }

    try {
        const response = await fetch('/api/user/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            hasUserInfo = true;
            // 重新加载页面，显示主应用
            location.reload();
        } else {
            const error = await response.json();
            showFormError(error.detail || '提交失败，请重试');
        }
    } catch (error) {
        console.error('提交用户信息失败:', error);
        showFormError('网络错误，请重试');
    }
}

// 显示表单错误
function showFormError(message) {
    const errorDiv = document.getElementById('form-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// 初始化应用（在登录成功后调用）
async function initApp() {
    // 设置模式切换
    setupModeSelector();

    // 设置对战模式
    setupBattleMode();

    // 设置教学理念竞技场
    setupPhilosophyMode();

    // 设置并排对比模式（但不加载模型，延迟到需要时）
    setupSideBySideMode();

    // 设置排行榜（但不加载数据，延迟到需要时）
    setupLeaderboard();

    // 设置历史对话
    setupHistoryMode();

    // 设置测评问题
    setupQuestionsMode();

    // 设置提示词解释交互
    setupPromptExplanation();

    // 不在初始化时加载数据，只在用户切换到对应模式时才加载
}

// 管理员功能已移除

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
    const sendBtn = document.getElementById('battle-send-btn');
    const input = document.getElementById('battle-input');
    const voteButtons = document.querySelectorAll('.battle-vote-btn');
    // 统一控制"输入区域（含提示）"的显示/隐藏
    battleInputSection = document.querySelector('#battle-mode .composer');

    startBtn.addEventListener('click', startBattle);

    // 动态绑定新对战按钮和继续对话按钮（因为按钮在投票后动态生成）
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'new-battle-btn') {
            startBattle();
        }
        if (e.target && e.target.id === 'continue-battle-btn') {
            continueBattle();
        }
    });

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
                <div class="response-box">
                    <div class="response-header">模型 A</div>
                    <div class="response-content" data-role="response-a">
                        <div class="loading">思考中...</div>
                    </div>
                    <div class="evaluation-section" data-model="model_a" style="display: none;">
                        <div class="evaluation-title">教案评价维度（请根据教案质量打分）</div>
                        <div class="evaluation-dimensions">
                            <div class="evaluation-item">
                                <label>可执行性</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="1">1</button>
                                        <span class="likert-desc">非常不可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="2">2</button>
                                        <span class="likert-desc">不太可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="4">4</button>
                                        <span class="likert-desc">较可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="5">5</button>
                                        <span class="likert-desc">非常可行</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>符合学情</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="1">1</button>
                                        <span class="likert-desc">非常不符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="2">2</button>
                                        <span class="likert-desc">不太符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="4">4</button>
                                        <span class="likert-desc">较符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="5">5</button>
                                        <span class="likert-desc">非常符合</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>扎实有用</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="1">1</button>
                                        <span class="likert-desc">非常不实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="2">2</button>
                                        <span class="likert-desc">不太实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="4">4</button>
                                        <span class="likert-desc">较实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="5">5</button>
                                        <span class="likert-desc">非常实用</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>融合本土</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="1">1</button>
                                        <span class="likert-desc">完全未融合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="2">2</button>
                                        <span class="likert-desc">融合较少</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="4">4</button>
                                        <span class="likert-desc">融合较好</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="5">5</button>
                                        <span class="likert-desc">融合很好</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>善用技术</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="1">1</button>
                                        <span class="likert-desc">完全未使用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="2">2</button>
                                        <span class="likert-desc">使用较少</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="4">4</button>
                                        <span class="likert-desc">使用较好</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="5">5</button>
                                        <span class="likert-desc">使用很好</span>
                                    </div>
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
                        <div class="evaluation-title">教案评价维度（请根据教案质量打分）</div>
                        <div class="evaluation-dimensions">
                            <div class="evaluation-item">
                                <label>可执行性</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="1">1</button>
                                        <span class="likert-desc">非常不可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="2">2</button>
                                        <span class="likert-desc">不太可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="4">4</button>
                                        <span class="likert-desc">较可行</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="executable" data-value="5">5</button>
                                        <span class="likert-desc">非常可行</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>符合学情</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="1">1</button>
                                        <span class="likert-desc">非常不符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="2">2</button>
                                        <span class="likert-desc">不太符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="4">4</button>
                                        <span class="likert-desc">较符合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="student_fit" data-value="5">5</button>
                                        <span class="likert-desc">非常符合</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>扎实有用</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="1">1</button>
                                        <span class="likert-desc">非常不实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="2">2</button>
                                        <span class="likert-desc">不太实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="4">4</button>
                                        <span class="likert-desc">较实用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="practical" data-value="5">5</button>
                                        <span class="likert-desc">非常实用</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>融合本土</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="1">1</button>
                                        <span class="likert-desc">完全未融合</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="2">2</button>
                                        <span class="likert-desc">融合较少</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="4">4</button>
                                        <span class="likert-desc">融合较好</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="local_integration" data-value="5">5</button>
                                        <span class="likert-desc">融合很好</span>
                                    </div>
                                </div>
                            </div>
                            <div class="evaluation-item">
                                <label>善用技术</label>
                                <div class="evaluation-options likert-scale">
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="1">1</button>
                                        <span class="likert-desc">完全未使用</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="2">2</button>
                                        <span class="likert-desc">使用较少</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="3">3</button>
                                        <span class="likert-desc">一般</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="4">4</button>
                                        <span class="likert-desc">使用较好</span>
                                    </div>
                                    <div class="likert-option">
                                        <button class="eval-btn likert-btn" data-dimension="tech_use" data-value="5">5</button>
                                        <span class="likert-desc">使用很好</span>
                                    </div>
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
            responseA.innerHTML = renderMarkdown(finalA) || '';
        }
        if (responseB) {
            responseB.innerHTML = renderMarkdown(finalB) || '';
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
        model_a: { executable: null, student_fit: null, practical: null, local_integration: null, tech_use: null },
        model_b: { executable: null, student_fit: null, practical: null, local_integration: null, tech_use: null }
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
    const dimensions = ['executable', 'student_fit', 'practical', 'local_integration', 'tech_use'];
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

    } catch (error) {
        console.error('提交测评失败:', error);
        showError('提交测评失败，请重试');
        const submitBtn = roundEl.querySelector('.submit-evaluation-btn');
        if (submitBtn) submitBtn.disabled = false;
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

        // 隐藏投票区域
        document.getElementById('voting-section').style.display = 'none';

        // 显示模型身份到reveal-section
        const revealSection = document.getElementById('reveal-section');
        if (revealSection) {
            const revealInfo = revealSection.querySelector('.reveal-info');
            if (revealInfo) {
                revealInfo.innerHTML = `
                    <div class="reveal-content">
                        <h3>🎉 模型身份揭晓</h3>
                        <div class="reveal-models">
                            <div class="model-reveal">
                                <span class="model-label">模型 A:</span>
                                <span class="model-name">${data.model_a_name}</span>
                            </div>
                            <div class="model-reveal">
                                <span class="model-label">模型 B:</span>
                                <span class="model-name">${data.model_b_name}</span>
                            </div>
                        </div>
                        <div class="reveal-actions">
                            <button id="new-battle-btn" class="primary-btn ghost">开始新对战</button>
                            <button id="continue-battle-btn" class="secondary-btn ghost">开启新一轮对话</button>
                        </div>
                    </div>
                `;
            }
            revealSection.style.display = 'block';
        }

        // 投票完成后：禁用输入和发送，等待开始新对战或继续对话
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

// 继续使用当前模型进行对战
async function continueBattle() {
    try {
        if (!battleSessionId) {
            showError('没有可继续的对战会话');
            return;
        }

        showLoading('battle');

        const response = await fetch('/api/battle/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                session_id: battleSessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '继续对战失败');
        }

        const data = await response.json();
        battleSessionId = data.session_id;

        // 隐藏揭示区域
        const revealSection = document.getElementById('reveal-section');
        if (revealSection) {
            revealSection.style.display = 'none';
        }

        // 显示输入区域
        if (battleInputSection) {
            battleInputSection.style.display = 'block';
        }
        const sendBtn = document.getElementById('battle-send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }

        showMessage('可以继续对话，请在下方输入框中发送消息。');

    } catch (error) {
        console.error('继续对战失败:', error);
        showError(error.message || '继续对战失败，请重试');
    } finally {
        hideLoading('battle');
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

        document.getElementById('sidebyside-response-a').innerHTML = renderMarkdown(data.response_a || '');
        document.getElementById('sidebyside-response-b').innerHTML = renderMarkdown(data.response_b || '');

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
    refreshBtn.addEventListener('click', () => {
        // 根据当前标签页加载对应的排行榜
        const activeTab = document.querySelector('.leaderboard-tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'philosophy') {
            loadPhilosophyLeaderboard();
        } else {
            loadLeaderboard();
        }
    });
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
        const response = await fetch('/api/battle/questions', {
            credentials: 'include'  // 确保包含 cookies（用于 session 认证）
        });

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
            credentials: 'include',
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
                    <div class="history-msg-content">${renderMarkdown(modelContent)}</div>
                </div>`;
            } else if (modelBMatch) {
                const modelContent = modelBMatch[1].trim();
                html += `<div class="history-msg model-b-msg">
                    <div class="history-msg-label">模型 B</div>
                    <div class="history-msg-content">${renderMarkdown(modelContent)}</div>
                </div>`;
            } else {
                // 如果没有匹配到格式，直接显示内容
                html += `<div class="history-msg assistant-msg">
                    <div class="history-msg-label">助手</div>
                    <div class="history-msg-content">${renderMarkdown(content)}</div>
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

// ===== 工具函数 =====
function showLoading(mode) {
    // 可以添加全局加载指示器
}

function hideLoading(mode) {
    // 可以添加全局加载指示器关闭逻辑
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

// 设置提示词解释交互
function setupPromptExplanation() {
    const toggleBtn = document.getElementById('toggle-explanation');
    const content = document.getElementById('explanation-content');

    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';

            if (isVisible) {
                content.style.display = 'none';
                content.classList.remove('show');
                toggleBtn.textContent = '展开';
            } else {
                content.style.display = 'block';
                content.classList.add('show');
                toggleBtn.textContent = '收起';
            }
        });
    }
}


// ===== 教学理念竞技场模式 =====
let philosophySessionId = null;

function setupPhilosophyMode() {
    const startBtn = document.getElementById('start-philosophy-btn');
    const newPhilosophyBtn = document.getElementById('philosophy-new-round-btn');
    const sendBtn = document.getElementById('send-philosophy-btn');
    const input = document.getElementById('philosophy-user-input');
    const voteButtons = document.querySelectorAll('.philosophy-vote-btn');
    // 统一控制"输入区域（含提示）"的显示/隐藏
    philosophyInputSection = document.querySelector('#philosophy-mode .composer');

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            await startPhilosophy();
        });
    }

    if (newPhilosophyBtn) {
        newPhilosophyBtn.addEventListener('click', async () => {
            try {
                await startPhilosophy();
            } catch (error) {
                console.error('启动教学理念竞技场失败:', error);
                showError('启动失败，请重试');
            }
        });
    }

    // 绑定继续对话按钮
    const continuePhilosophyBtn = document.getElementById('continue-philosophy-btn');
    if (continuePhilosophyBtn) {
        continuePhilosophyBtn.addEventListener('click', async () => {
            try {
                await continuePhilosophy();
            } catch (error) {
                console.error('继续教学理念竞技场失败:', error);
                showError('继续失败，请重试');
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
            try {
                await sendPhilosophyMessage();
            } catch (error) {
                console.error('发送消息失败:', error);
                showError('发送失败，请重试');
            }
        });
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // 检查按钮是否已禁用，避免重复提交
                const sendBtn = document.getElementById('send-philosophy-btn');
                if (sendBtn && !sendBtn.disabled) {
                    // 异步调用包装在try-catch中
                    sendPhilosophyMessage().catch(error => {
                        console.error('发送消息失败:', error);
                        showError('发送失败，请重试');
                    });
                }
            }
        });
    }

    voteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            try {
                submitPhilosophyVote(btn.dataset.winner).catch(error => {
                    console.error('投票失败:', error);
                    showError('投票失败，请重试');
                });
            } catch (error) {
                console.error('投票失败:', error);
                showError('投票失败，请重试');
            }
        });
    });

    // 设置排行榜标签切换
    const tabButtons = document.querySelectorAll('.leaderboard-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // 更新按钮状态
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新内容显示
            const tabContents = document.querySelectorAll('.leaderboard-tab-content');
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });

            if (tab === 'lesson') {
                document.getElementById('lesson-leaderboard').classList.add('active');
                document.getElementById('lesson-leaderboard').style.display = 'block';
                loadLeaderboard();  // 加载教案质量评价排行榜
            } else if (tab === 'philosophy') {
                document.getElementById('philosophy-leaderboard').classList.add('active');
                document.getElementById('philosophy-leaderboard').style.display = 'block';
                loadPhilosophyLeaderboard();  // 加载教学理念竞技场排行榜
            }
        });
    });
}

async function startPhilosophy() {
    try {
        showLoading('philosophy');

        const response = await fetch('/api/philosophy/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) throw new Error('启动对战失败');

        const data = await response.json();
        philosophySessionId = data.session_id;

        // 显示对话区域，隐藏开始按钮
        document.getElementById('philosophy-start').style.display = 'none';
        document.getElementById('philosophy-chat-area').style.display = 'block';
        document.getElementById('philosophy-new-round').style.display = 'none';

        // 清空对话区域
        document.getElementById('philosophy-rounds').innerHTML = '';

        // 重置界面：隐藏投票和揭示区域
        document.getElementById('philosophy-voting-section').style.display = 'none';
        document.getElementById('philosophy-reveal-section').style.display = 'none';
        document.getElementById('philosophy-user-input').value = '';
        document.getElementById('send-philosophy-btn').disabled = false;
        // 确保投票按钮是启用状态（防止之前的状态影响）
        const voteButtons = document.querySelectorAll('.philosophy-vote-btn');
        voteButtons.forEach(btn => {
            btn.disabled = false;
        });
        // 新一轮开始时显示输入区域
        if (philosophyInputSection) philosophyInputSection.style.display = 'block';

        showMessage('对战已开始！');
    } catch (error) {
        console.error('启动对战失败:', error);
        showError('启动对战失败');
    }
}

async function sendPhilosophyMessage() {
    const input = document.getElementById('philosophy-user-input');
    const message = input.value.trim();

    if (!message) {
        // 如果消息为空，给用户一个视觉反馈
        input.focus();
        return;
    }

    const sendBtn = document.getElementById('send-philosophy-btn');
    // 如果按钮已经被禁用，说明正在发送中，避免重复提交
    if (sendBtn && sendBtn.disabled) {
        return;
    }
    sendBtn.disabled = true;
    // 发送后隐藏输入区域，直到本轮投票完成
    if (philosophyInputSection) philosophyInputSection.style.display = 'none';

    // 调试信息：记录当前 session_id
    console.log('发送消息，当前 philosophySessionId:', philosophySessionId);

    try {
        // 在多轮对话容器中，为本轮新增一个「用户问题 + 模型 A / 模型 B」区域
        const philosophyRounds = document.getElementById('philosophy-rounds');
        if (!philosophyRounds) {
            throw new Error('未找到 philosophy-rounds 容器');
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
                        <div class="evaluation-title">评价维度（请根据回答质量打分）</div>
                        <div class="evaluation-dimensions">
                            ${generatePhilosophyEvaluationHTML('model_a')}
                        </div>
                    </div>
                </div>
                <div class="response-box">
                    <div class="response-header">模型 B</div>
                    <div class="response-content" data-role="response-b">
                        <div class="loading">思考中...</div>
                    </div>
                    <div class="evaluation-section" data-model="model_b" style="display: none;">
                        <div class="evaluation-title">评价维度（请根据回答质量打分）</div>
                        <div class="evaluation-dimensions">
                            ${generatePhilosophyEvaluationHTML('model_b')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="evaluation-submit-section" style="display: none;">
                <button class="submit-evaluation-btn primary-btn">提交评价</button>
            </div>
        `;

        philosophyRounds.appendChild(roundEl);

        // 填充本轮用户问题到这一轮顶部
        const userMsgEl = roundEl.querySelector('.message.user');
        if (userMsgEl) {
            userMsgEl.textContent = message;
        }

        // 发送请求到后端
        const response = await fetch('/api/philosophy/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: philosophySessionId,
                message: message
            })
        });

        if (!response.ok) {
            throw new Error('网络请求失败');
        }

        const data = await response.json();

        // 填充模型回复
        const responseA = roundEl.querySelector('[data-role="response-a"]');
        const responseB = roundEl.querySelector('[data-role="response-b"]');

        if (responseA) {
            const finalA = data.model_a_response || '模型 A 暂时无法回复';
            responseA.innerHTML = renderMarkdown(finalA);
        }

        if (responseB) {
            const finalB = data.model_b_response || '模型 B 暂时无法回复';
            responseB.innerHTML = renderMarkdown(finalB);
        }

        // 显示测评维度选择界面
        const evalSections = roundEl.querySelectorAll('.evaluation-section');
        evalSections.forEach(section => section.style.display = 'block');
        const submitSection = roundEl.querySelector('.evaluation-submit-section');
        if (submitSection) submitSection.style.display = 'block';

        // 设置测评维度选择事件
        setupPhilosophyEvaluationButtons(roundEl);

        // 隐藏投票区域（等测评提交后才显示）
        document.getElementById('philosophy-voting-section').style.display = 'none';

        input.value = '';

    } catch (error) {
        console.error('发送消息失败:', error);
        const errorMessage = error.message || '发送消息失败，请重试';
        showError(errorMessage);
        sendBtn.disabled = false;
        if (philosophyInputSection) philosophyInputSection.style.display = 'block';
        // 如果错误是由于网络问题（如无法连接到服务器），提示用户检查后端服务
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.error('网络错误：可能后端服务未启动或无法访问');
        }
    }
}

function generatePhilosophyEvaluationHTML(model) {
    const dimensions = [
        { key: 'logic', label: '逻辑的自洽性', labels: ['非常不自洽', '不太自洽', '一般', '较自洽', '非常自洽'] },
        { key: 'perspective', label: '视角的独特性', labels: ['完全不独特', '不太独特', '一般', '较独特', '非常独特'] },
        { key: 'care', label: '人文的关怀度', labels: ['完全无关怀', '关怀较少', '一般', '关怀较多', '关怀很多'] },
        { key: 'inspiration', label: '启发性的引导', labels: ['完全无启发', '启发较少', '一般', '启发较多', '启发很多'] }
    ];

    return dimensions.map(dim => `
        <div class="evaluation-item">
            <label>${dim.label}</label>
            <div class="evaluation-options likert-scale">
                ${[1, 2, 3, 4, 5].map(score => `
                    <div class="likert-option">
                        <button class="eval-btn likert-btn" data-dimension="${dim.key}" data-value="${score}">${score}</button>
                        <span class="likert-desc">${dim.labels[score - 1]}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function setupPhilosophyEvaluationButtons(roundEl) {
    const evalButtons = roundEl.querySelectorAll('.eval-btn');
    const submitBtn = roundEl.querySelector('.submit-evaluation-btn');

    // 存储当前轮的测评数据
    const evaluationData = {
        model_a: { logic: null, perspective: null, care: null, inspiration: null },
        model_b: { logic: null, perspective: null, care: null, inspiration: null }
    };

    evalButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const dimension = this.dataset.dimension;
            const value = parseInt(this.dataset.value);
            const section = this.closest('.evaluation-section');
            const model = section.dataset.model;

            // 更新数据
            evaluationData[model][dimension] = value;

            // 更新按钮样式：同维度其他按钮取消选中，当前按钮选中
            const dimensionGroup = this.closest('.evaluation-item');
            const allButtonsInGroup = dimensionGroup.querySelectorAll('.eval-btn');
            allButtonsInGroup.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            // 检查是否所有维度都已选择
            const allSelected = checkAllPhilosophyDimensionsSelected(roundEl, evaluationData);
            if (submitBtn) {
                submitBtn.disabled = !allSelected;
            }
        });
    });

    // 提交测评按钮
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.addEventListener('click', async () => {
            await submitPhilosophyEvaluation(roundEl, evaluationData);
        });
    }
}

// 检查是否所有维度都已选择
function checkAllPhilosophyDimensionsSelected(roundEl, evaluationData) {
    const dimensions = ['logic', 'perspective', 'care', 'inspiration'];
    for (const model of ['model_a', 'model_b']) {
        for (const dim of dimensions) {
            if (evaluationData[model][dim] === null) {
                return false;
            }
        }
    }
    return true;
}

async function submitPhilosophyEvaluation(roundEl, evaluationData) {
    try {
        const submitBtn = roundEl.querySelector('.submit-evaluation-btn');
        if (submitBtn) submitBtn.disabled = true;

        const response = await fetch('/api/philosophy/evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: philosophySessionId,
                evaluation: evaluationData
            })
        });

        if (!response.ok) throw new Error('提交测评失败');

        // 隐藏测评区域
        const evalSections = roundEl.querySelectorAll('.evaluation-section');
        evalSections.forEach(section => section.style.display = 'none');
        const submitSection = roundEl.querySelector('.evaluation-submit-section');
        if (submitSection) submitSection.style.display = 'none';

        // 显示投票区域，并确保投票按钮是启用状态
        const votingSection = document.getElementById('philosophy-voting-section');
        if (votingSection) {
            votingSection.style.display = 'block';
            // 重新启用所有投票按钮（防止之前的禁用状态影响新的投票）
            const voteButtons = document.querySelectorAll('.philosophy-vote-btn');
            voteButtons.forEach(btn => {
                btn.disabled = false;
            });
        }

        showMessage('测评维度提交成功！请投票选择更好的模型');
    } catch (error) {
        console.error('提交测评失败:', error);
        showError('提交测评失败，请重试');
        const submitBtn = roundEl.querySelector('.submit-evaluation-btn');
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function submitPhilosophyVote(winner) {
    // 防止重复点击：立即禁用所有投票按钮
    const voteButtons = document.querySelectorAll('.philosophy-vote-btn');
    voteButtons.forEach(btn => {
        btn.disabled = true;
    });

    try {
        // 调试信息：记录当前 session_id
        console.log('提交投票，当前 philosophySessionId:', philosophySessionId);

        const response = await fetch('/api/philosophy/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: philosophySessionId,
                winner: winner
            })
        });

        if (!response.ok) {
            let errorMessage = '投票失败';
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage = `投票失败: ${errorData.detail}`;
                    // 如果是权限错误，提示用户可能需要重新登录
                    if (response.status === 403) {
                        errorMessage += '（可能是权限问题，请尝试刷新页面）';
                    }
                    // 如果是对战会话不存在，清空 session_id 以便重新创建
                    if (response.status === 404 && errorData.detail.includes('不存在')) {
                        console.warn('对战会话不存在，清空 session_id');
                        philosophySessionId = null;
                    }
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

        // 隐藏投票区域
        document.getElementById('philosophy-voting-section').style.display = 'none';

        // 显示结果到全局揭示区域
        const revealSection = document.getElementById('philosophy-reveal-section');
        const revealContent = document.getElementById('philosophy-reveal-content');
        if (revealSection && revealContent) {
            revealContent.innerHTML = `
                <h3>🎉 模型身份揭晓</h3>
                <div class="reveal-models">
                    <div class="model-reveal">
                        <span class="model-label">模型 A:</span>
                        <span class="model-name">${data.model_a_name}</span>
                    </div>
                    <div class="model-reveal">
                        <span class="model-label">模型 B:</span>
                        <span class="model-name">${data.model_b_name}</span>
                    </div>
                </div>
            `;
            revealSection.style.display = 'block';
        }

        // 显示新一轮按钮
        document.getElementById('philosophy-new-round').style.display = 'block';
        // 投票完成后：禁用输入和发送，等待开始新对战或继续对话
        const sendBtn = document.getElementById('send-philosophy-btn');
        sendBtn.disabled = true;
        if (philosophyInputSection) philosophyInputSection.style.display = 'none';

    } catch (error) {
        console.error('投票失败:', error);
        const errorMessage = error.message || '投票失败，请重试';
        showError(errorMessage);
        // 如果出错，重新启用投票按钮（以防万一）
        const voteButtons = document.querySelectorAll('.philosophy-vote-btn');
        voteButtons.forEach(btn => {
            btn.disabled = false;
        });
    }
}

// 继续使用当前模型进行教学理念竞技场对战
async function continuePhilosophy() {
    try {
        if (!philosophySessionId) {
            showError('没有可继续的对战会话');
            return;
        }

        showLoading('philosophy');

        const response = await fetch('/api/philosophy/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                session_id: philosophySessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '继续对战失败');
        }

        const data = await response.json();
        philosophySessionId = data.session_id;

        // 隐藏揭示区域和新一轮按钮
        const revealSection = document.getElementById('philosophy-reveal-section');
        if (revealSection) {
            revealSection.style.display = 'none';
        }
        const newRound = document.getElementById('philosophy-new-round');
        if (newRound) {
            newRound.style.display = 'none';
        }

        // 显示输入区域
        if (philosophyInputSection) {
            philosophyInputSection.style.display = 'block';
        }
        const sendBtn = document.getElementById('send-philosophy-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }

        showMessage('可以继续对话，请在下方输入框中发送消息。');

    } catch (error) {
        console.error('继续对战失败:', error);
        showError(error.message || '继续对战失败，请重试');
    } finally {
        hideLoading('philosophy');
    }
}

async function loadPhilosophyLeaderboard() {
    try {
        const response = await fetch('/api/philosophy/leaderboard');
        const data = await response.json();

        const content = document.getElementById('philosophy-leaderboard-content');
        if (!content) return;

        if (!data.leaderboard || data.leaderboard.length === 0) {
            content.innerHTML = '<div class="empty-state">暂无排行榜数据，开始对战来贡献数据吧！</div>';
            return;
        }

        let html = `
            <div class="leaderboard-row header">
                <div class="rank">排名</div>
                <div class="model-name">模型</div>
                <div class="stat rating">评分</div>
            </div>
        `;

        data.leaderboard.forEach((item, index) => {
            const rank = index + 1;
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            html += `
                <div class="leaderboard-row">
                    <div class="rank">${rankEmoji} ${rank}</div>
                    <div class="model-name">${item.model_name}</div>
                    <div class="stat rating">${item.rating}</div>
                </div>
            `;
        });

        content.innerHTML = html;
    } catch (error) {
        console.error('加载教学理念排行榜失败:', error);
        const content = document.getElementById('philosophy-leaderboard-content');
        if (content) {
            content.innerHTML = '<div class="error-state">加载失败</div>';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

