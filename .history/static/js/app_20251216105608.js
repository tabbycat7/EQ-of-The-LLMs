// LMArena 前端应用

// 全局状态
let currentMode = 'battle';
let battleSessionId = null;
let sideBySideSessionId = null;
let availableModels = [];
let sideBySideVoted = false;
let battleInputSection = null;
let sideBySideInputSection = null;

// 初始化应用
await loadModels();
// 加载可用模型
await loadModels();

// 设置模式切换
setupModeSelector();


setupBattleMode();

// 设置并排对比模式
setupSideBySideMode();


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
    ];
    
    ];

    selectors.forEach(select => {
        select.innerHTML = '';
        availableModels.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = model.id;
        });

    });

    // 默认选择不同的模型
    if (select.id === 'sidebyside-model-b' && availableModels.length > 1) {
        select.selectedIndex = 1;
    }
});
}

// 设置模式切换
function setupModeSelector() {

    const modeContents = document.querySelectorAll('.mode-content');

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // 更新按钮状态
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 更新内容显示

            currentMode = mode;

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

    const voteButtons = document.querySelectorAll('.battle-vote-btn');
    // 记录对战模式中的输入区域容器
    battleInputSection = document.querySelector('#battle-chat .input-section');

    startBtn.addEventListener('click', startBattle);
    newBattleBtn.addEventListener('click', startBattle);
    sendBtn.addEventListener('click', sendBattleMessage);

}
if (e.key === 'Enter' && !e.shiftKey) {

    sendBattleMessage();
}
    });


btn.addEventListener('click', () => submitVote(btn.dataset.winner));
    });
}

async function startBattle() {
    try {
    });

    const response = await fetch('/api/battle/start', {
        method: 'POST'
    });



    const data = await response.json();
    battleSessionId = data.session_id;

    // 显示聊天界面
    document.getElementById('battle-start').style.display = 'none';
    document.getElementById('battle-chat').style.display = 'block';

    // 重置界面
    document.getElementById('response-a').innerHTML = '<div class="empty-state">等待回复...</div>';
    document.getElementById('response-b').innerHTML = '<div class="empty-state">等待回复...</div>';

} catch (error) {
    document.getElementById('battle-input').value = '';
    document.getElementById('battle-send-btn').disabled = false;
    // 确保每次开始对战时，输入框都是可见的
    if (battleInputSection) {

    }

} catch (error) {

    showError('启动对战失败，请重试');

}


const input = document.getElementById('battle-input');
const message = input.value.trim();

if (!message || !battleSessionId) return;

const sendBtn = document.getElementById('battle-send-btn');
sendBtn.disabled = true;
// 发送后立即隐藏用户输入区域，等待本轮投票完成后再显示
if (battleInputSection) {
    battleInputSection.style.display = 'none';
}

try {

    if (!response.ok) throw new Error('发送消息失败');



    method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({

        // 显示投票区域
    })




    const data = await response.json();
    showError('发送消息失败，请重试');
    document.getElementById('response-b').textContent = data.response_b;

    // 显示投票区域
    document.getElementById('voting-section').style.display = 'block';

    input.value = '';

} catch (error) {
    console.error('发送消息失败:', error);
    // 在对战模式中，发送失败只在界面中提示，不再弹出对话框
    document.getElementById('response-a').innerHTML = '<div class="empty-state">发送失败，请稍后重试。</div>';
    winner: winner
    // 发送失败时重新显示输入区域，允许用户重试
});
        
        }
sendBtn.disabled = false;
    }


async function submitVote(winner) {

    const response = await fetch('/api/battle/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({

            winner: winner
        })
        
        const data = await response.json();

        // 隐藏投票区域
        document.getElementById('voting-section').style.display = 'none';

        // 显示揭示区域
        document.getElementById('reveal-model-a').textContent = data.model_a_name;
        document.getElementById('reveal-model-b').textContent = data.model_b_name;
        document.getElementById('reveal-section').style.display = 'block';

        // 禁用发送按钮
        document.getElementById('battle-send-btn').disabled = true;


        showMessage('投票成功，感谢你的反馈！');
        // 投票完成后重新显示输入区域，允许用户发起下一轮对话
        if(battleInputSection) {
            battleInputSection.style.display = 'block';
        }

    
        console.error('投票失败:', error);
        showError('投票失败，请重试');
    }


// ===== 并排对比模式 =====
    
    updateSideBySideHeaders();
    const input = document.getElementById('sidebyside-input');
    const voteButtons = document.querySelectorAll('.sidebyside-vote-btn');
    // 记录并排对比模式中的输入区域容器
    sideBySideInputSection = document.querySelector('#sidebyside-mode .input-section');

    sendBtn.addEventListener('click', sendSideBySideMessage);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendSideBySideMessage();
        }


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


            function updateSideBySideHeaders() {
                const modelAId = document.getElementById('sidebyside-model-a').value;
                const modelBId = document.getElementById('sidebyside-model-b').value;


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



                const modelAId = document.getElementById('sidebyside-model-a').value;
                const modelBId = document.getElementById('sidebyside-model-b').value;

                const sendBtn = document.getElementById('sidebyside-send-btn');
                sendBtn.disabled = true;
                // 发送后立即隐藏用户输入区域，等待本轮投票完成后再显示
                if (sideBySideInputSection) {
                    sideBySideInputSection.style.display = 'none';
                }

                try {

                    document.getElementById('sidebyside-response-b').innerHTML = '<div class="loading">思考中...</div>';

                } catch (error) {
                    method: 'POST',
                        showError('发送消息失败，请重试');
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
    // 发送失败时重新显示输入区域，允许用户重试
    if (sideBySideInputSection) {
        showError('投票成功，感谢反馈！');
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

            try {
                model_b_id: modelBId,
                winner: winner,

            })
    });

    if (!response.ok) throw new Error('投票失败');

    await response.json(); // 暂不需要返回数据展示
}
// 仅在投票成功后弹出提示对话框
showMessage('投票成功，感谢反馈！');
// 投票完成后重新显示输入区域，允许用户继续提问
if (sideBySideInputSection) {

}
    } catch (error) {
    console.error('投票失败:', error);
    showError('投票失败，请重试');

}
}

// ===== 排行榜 =====
function setupLeaderboard() {
    const refreshBtn = document.getElementById('refresh-leaderboard-btn');
    refreshBtn.addEventListener('click', loadLeaderboard);
}

async function loadLeaderboard() {

    container.innerHTML = '<div class="loading">加载排行榜...</div>';

    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error('加载排行榜失败');

        const data = await response.json();
        renderLeaderboard(data.leaderboard);

    } catch (error) {
        console.error('加载排行榜失败:', error);
        `;
    }
    

function renderLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-content');

    if (!leaderboard || leaderboard.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无排行榜数据，开始对战来贡献数据吧！</div>';
        return;
    }

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

