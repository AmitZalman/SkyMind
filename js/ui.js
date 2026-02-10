/**
 * SkyMind UI Module v3.0.0
 * UI components, theme management, toasts, modals
 */

// ==================== THEME ====================
function initTheme() {
    const saved = loadFromStorage(CONFIG.STORAGE_KEYS.THEME);
    if (saved) {
        state.theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.theme = 'light';
    }
    applyTheme(state.theme);
}

function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = theme === 'dark' ? '#0a0a1f' : '#f5f7ff';
    }
    
    const themeBtn = $('themeToggle');
    const themeBtnSettings = $('themeToggleSettings');
    
    if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (themeBtnSettings) themeBtnSettings.textContent = theme === 'dark' ? 'מצב בהיר ☀️' : 'מצב כהה 🌙';
    
    saveToStorage(CONFIG.STORAGE_KEYS.THEME, theme);
}

function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    showToast(state.theme === 'dark' ? 'מצב כהה' : 'מצב בהיר', 'info');
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = $('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== CONFETTI ====================
function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(confetti);
    }
    
    setTimeout(() => container.remove(), 4000);
}

// ==================== MODALS ====================
function showModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.classList.add('hidden'));
}

// Confirm dialog
let confirmCallback = null;

function showConfirm(title, message, callback) {
    const modal = $('confirmModal');
    const titleEl = $('confirmTitle');
    const messageEl = $('confirmMessage');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    confirmCallback = callback;
    showModal('confirmModal');
}

function handleConfirmAction() {
    hideModal('confirmModal');
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
}

// ==================== BOOT UI ====================
function updateBootStatus(step, msg) {
    const el = $('splashStatus');
    if (el) el.textContent = msg;
    log(step + ': ' + msg);
}

function checkRequiredElements() {
    return CONFIG.REQUIRED_ELEMENTS.filter(id => !document.getElementById(id));
}

function showBootError(title, msg, err, missing) {
    missing = missing || [];
    const splash = $('splashScreen');
    if (!splash) return;
    
    const missingHtml = missing.length 
        ? '<div class="error-missing" style="color: var(--warning); margin: 10px 0;">חסרים: ' + missing.join(', ') + '</div>' 
        : '';
    const errHtml = err 
        ? '<p style="color: var(--text-muted); font-size: 0.9rem;">' + escapeHtml(String(err)) + '</p>' 
        : '';
    
    splash.innerHTML = `
        <div class="splash-content">
            <div class="splash-error">
                <div class="error-icon">⚠️</div>
                <h2 style="margin-bottom: 10px;">${escapeHtml(title)}</h2>
                <p>${escapeHtml(msg)}</p>
                ${errHtml}
                ${missingHtml}
                <div class="error-actions">
                    <label class="btn-primary" style="cursor: pointer;">
                        <input type="file" id="errorLoadFile" accept=".json" style="display: none;">
                        📁 טען קובץ שאלות
                    </label>
                    <button class="btn-secondary" onclick="location.reload()">🔄 נסה שוב</button>
                    <button class="btn-ghost danger" onclick="clearAllDataAndReload()">🗑️ נקה ורענן</button>
                </div>
            </div>
        </div>
    `;
    
    const fileInput = document.getElementById('errorLoadFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleErrorFileLoad);
    }
}

function handleErrorFileLoad(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (Array.isArray(data)) {
                state.questions = normalizeQuestions(data);
                buildIndexes();
                saveToStorage(CONFIG.STORAGE_KEYS.QUESTIONS, state.questions);
                log('Loaded ' + state.questions.length + ' questions from manual import');
            }
            location.reload();
        } catch (err) {
            alert('שגיאה: ' + err.message);
        }
    };
    reader.readAsText(files[0]);
}

function clearAllDataAndReload() {
    if (!confirm('למחוק את כל הנתונים?')) return;
    clearAllData();
    location.reload();
}

// ==================== HOME STATS ====================
function updateHomeStats() {
    const g = state.gamification;
    const total = state.questions.length;
    
    // Rank and XP
    const rankInfo = getRankInfo(g.totalXP);
    
    const levelNumber = $('levelNumber');
    const levelText = $('levelText');
    const xpText = $('xpText');
    const xpProgress$ = $('xpProgress');
    const rankName = $('rankName');
    const rankIcon = $('rankIcon');
    
    if (levelNumber) levelNumber.textContent = rankInfo.rank.icon;
    if (levelText) levelText.textContent = rankInfo.rank.name;
    if (rankName) rankName.textContent = rankInfo.rank.name;
    if (rankIcon) rankIcon.textContent = rankInfo.rank.icon;
    if (xpText) {
        const nextXP = rankInfo.nextRank ? rankInfo.nextRank.minXP : g.totalXP;
        xpText.textContent = g.totalXP + ' / ' + nextXP + ' XP';
    }
    if (xpProgress$) xpProgress$.style.width = rankInfo.progress + '%';
    
    // Stats
    const answered = Object.keys(state.progress).filter(id => state.progress[id] && state.progress[id].attempts > 0).length;
    const accuracy = g.totalAnswered > 0 ? Math.round(g.totalCorrect / g.totalAnswered * 100) : 0;
    
    const statTotal = $('statTotal');
    const statMastered = $('statMastered');
    const statAccuracy = $('statAccuracy');
    const statStreak = $('statStreak');
    const statStudyToday = $('statStudyToday');
    const statDue = $('statDue');
    
    if (statTotal) statTotal.textContent = total;
    if (statMastered) statMastered.textContent = answered;
    if (statAccuracy) statAccuracy.textContent = accuracy + '%';
    if (statStreak) statStreak.textContent = g.dailyStreak;
    if (statStudyToday) statStudyToday.textContent = g.todayStudyMinutes;
    
    // Due questions
    const dueCount = getDueQuestions().length;
    if (statDue) statDue.textContent = dueCount;
    
    const dueBadge = $('dueBadge');
    if (dueBadge) {
        dueBadge.textContent = dueCount;
        dueBadge.classList.toggle('hidden', dueCount === 0);
    }
}

// ==================== TOPICS LIST ====================
function renderTopicsList() {
    const container = $('topicsList');
    if (!container) return;

    const meta = state.topicsMeta || {};
    const metaOrder = (meta.mainOrder && meta.mainOrder.length) ? meta.mainOrder : [];
    const extraTopics = Object.keys(state.questionsByTopic).sort().filter(t => metaOrder.indexOf(t) < 0);
    const order = metaOrder.concat(extraTopics);

    container.innerHTML = order
        .filter(topic => state.questionsByTopic[topic] && state.questionsByTopic[topic].length)
        .map(topic => {
            const questions = state.questionsByTopic[topic];
            const total = questions.length;
            const answered = questions.filter(q => state.progress[q.id] && state.progress[q.id].attempts > 0).length;
            const correct = questions.reduce((sum, q) => {
                const p = state.progress[q.id];
                return sum + (p ? p.correctCount : 0);
            }, 0);
            const attempts = questions.reduce((sum, q) => {
                const p = state.progress[q.id];
                return sum + (p ? p.attempts : 0);
            }, 0);
            const accuracy = attempts > 0 ? Math.round(correct / attempts * 100) : 0;
            const coverage = Math.round(answered / total * 100);

            const circumference = 2 * Math.PI * 25;
            const strokeDashoffset = circumference - (coverage / 100) * circumference;

            const label = (meta.mainLabels && meta.mainLabels[topic]) ? meta.mainLabels[topic] : topic;

            return `
                <div class="topic-card" data-topic="${escapeHtml(topic)}">
                    <div class="topic-icon">📚</div>
                    <div class="topic-info">
                        <div class="topic-name">${escapeHtml(label)}</div>
                        <div class="topic-stats">${total} שאלות • ${accuracy}% דיוק</div>
                    </div>
                    <div class="topic-progress">
                        <svg class="topic-progress-ring" viewBox="0 0 60 60">
                            <circle class="bg" cx="30" cy="30" r="25"/>
                            <circle class="fill" cx="30" cy="30" r="25" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${strokeDashoffset}"/>
                        </svg>
                        <span class="topic-progress-text">${coverage}%</span>
                    </div>
                </div>
            `;
        }).join('');
}

// ==================== SUBTOPICS LIST ====================
function renderSubtopicsList(mainTopic) {
    const container = $('subtopicsList');
    if (!container) return;

    mainTopic = mainTopic || state.selectedMainTopic;
    if (!mainTopic) {
        container.innerHTML = '<div class="empty-state">לא נבחר נושא</div>';
        return;
    }

    const meta = state.topicsMeta || {};
    const mainLabel = (meta.mainLabels && meta.mainLabels[mainTopic]) ? meta.mainLabels[mainTopic] : mainTopic;
    const intro = $('subtopicsIntro');
    if (intro) intro.textContent = `בחר תת־נושא לתרגול ממוקד — ${mainLabel}`;

    const questions = state.questionsByTopic[mainTopic] || [];
    const bySub = {};

    questions.forEach(q => {
        const sub = q.subTopic || 'other';
        if (!bySub[sub]) bySub[sub] = [];
        bySub[sub].push(q);
    });

    const order = (meta.subOrder && meta.subOrder[mainTopic] && meta.subOrder[mainTopic].length)
        ? meta.subOrder[mainTopic]
        : Object.keys(bySub).sort();

    container.innerHTML = order
        .filter(sub => bySub[sub] && bySub[sub].length)
        .map(sub => {
            const qs = bySub[sub];
            const total = qs.length;
            const answered = qs.filter(q => state.progress[q.id] && state.progress[q.id].attempts > 0).length;
            const correct = qs.reduce((sum, q) => {
                const p = state.progress[q.id];
                return sum + (p ? p.correctCount : 0);
            }, 0);
            const attempts = qs.reduce((sum, q) => {
                const p = state.progress[q.id];
                return sum + (p ? p.attempts : 0);
            }, 0);
            const accuracy = attempts > 0 ? Math.round(correct / attempts * 100) : 0;
            const coverage = Math.round(answered / total * 100);

            const circumference = 2 * Math.PI * 25;
            const strokeDashoffset = circumference - (coverage / 100) * circumference;

            const label = (meta.subLabels && meta.subLabels[mainTopic] && meta.subLabels[mainTopic][sub])
                ? meta.subLabels[mainTopic][sub]
                : sub;

            return `
                <div class="topic-card" data-topic="${escapeHtml(mainTopic)}" data-subtopic="${escapeHtml(sub)}">
                    <div class="topic-icon">📘</div>
                    <div class="topic-info">
                        <div class="topic-name">${escapeHtml(label)}</div>
                        <div class="topic-stats">${total} שאלות • ${accuracy}% דיוק</div>
                    </div>
                    <div class="topic-progress">
                        <svg class="topic-progress-ring" viewBox="0 0 60 60">
                            <circle class="bg" cx="30" cy="30" r="25"/>
                            <circle class="fill" cx="30" cy="30" r="25" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${strokeDashoffset}"/>
                        </svg>
                        <span class="topic-progress-text">${coverage}%</span>
                    </div>
                </div>
            `;
        }).join('');
}


// ==================== INSIGHTS ====================
function updateInsights() {
    const total = state.questions.length;
    const answered = Object.keys(state.progress).filter(id => state.progress[id] && state.progress[id].attempts > 0).length;
    const dueCount = getDueQuestions().length;
    
    const insightTotal = $('insightTotal');
    const insightAnswered = $('insightAnswered');
    const insightDue = $('insightDue');
    
    if (insightTotal) insightTotal.textContent = total;
    if (insightAnswered) insightAnswered.textContent = answered;
    if (insightDue) insightDue.textContent = dueCount;
    
    // Recommendation
    const recommendation = $('recommendation');
    if (recommendation) {
        if (dueCount > 10) {
            recommendation.innerHTML = `<p>יש לך <strong>${dueCount}</strong> שאלות לחזרה. מומלץ להתחיל עם Smart Tutor.</p>`;
        } else if (answered < total * 0.3) {
            recommendation.innerHTML = `<p>למדת רק ${Math.round(answered/total*100)}% מהמאגר. המשך ללמוד שאלות חדשות!</p>`;
        } else {
            recommendation.innerHTML = `<p>מצוין! אתה בכיוון הנכון. המשך לתרגל באופן קבוע.</p>`;
        }
    }
    
    // Weak topics
    const weakTopics = $('weakTopics');
    if (weakTopics) {
        const stats = getTopicsStats().filter(t => t.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
        
        if (stats.length === 0) {
            weakTopics.innerHTML = '<p style="color: var(--text-muted);">אין מספיק נתונים עדיין</p>';
        } else {
            weakTopics.innerHTML = stats.map(t => `
                <div class="weak-topic-item">
                    <span class="weak-topic-name">${escapeHtml(t.name)}</span>
                    <span class="weak-topic-accuracy">${t.accuracy}%</span>
                    <button class="btn-ghost btn-sm weak-topic-btn" data-topic="${escapeHtml(t.name)}">תרגל</button>
                </div>
            `).join('');
        }
    }
    
    // Topics progress
    const topicsProgress = $('topicsProgress');
    if (topicsProgress) {
        const stats = getTopicsStats().slice(0, 8);
        topicsProgress.innerHTML = stats.map(t => `
            <div class="progress-topic-item">
                <div class="progress-topic-header">
                    <span>${escapeHtml(t.name)}</span>
                    <span>${t.coverage}%</span>
                </div>
                <div class="progress-topic-bar">
                    <div class="progress-topic-fill" style="width: ${t.coverage}%"></div>
                </div>
            </div>
        `).join('');
    }
}

// ==================== ACHIEVEMENTS ====================
function renderAchievements() {
    const container = $('achievementsList');
    const countEl = $('achievementsCount');
    
    if (!container) return;
    
    const unlocked = Object.keys(state.gamification.achievements || {}).length;
    const total = state.achievements.length;
    
    if (countEl) {
        countEl.textContent = unlocked + ' / ' + total;
    }
    
    container.innerHTML = state.achievements.map(ach => {
        const isUnlocked = state.gamification.achievements && state.gamification.achievements[ach.id];
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-name">${escapeHtml(ach.name)}</div>
                <div class="achievement-desc">${escapeHtml(ach.description)}</div>
            </div>
        `;
    }).join('');
}

// ==================== SETTINGS ====================
function updateSettingsView() {
    // Theme button
    const themeBtnSettings = $('themeToggleSettings');
    if (themeBtnSettings) {
        themeBtnSettings.textContent = state.theme === 'dark' ? 'מצב בהיר ☀️' : 'מצב כהה 🌙';
    }
    
    // Settings values
    const questionsPerSession = $('questionsPerSession');
    const showExplanation = $('showExplanation');
    const examQuestions = $('examQuestions');
    const examTime = $('examTime');
    
    if (questionsPerSession) questionsPerSession.value = state.settings.questionsPerSession;
    if (showExplanation) showExplanation.checked = state.settings.showExplanation;
    if (examQuestions) examQuestions.value = state.settings.examQuestions;
    if (examTime) examTime.value = state.settings.examTime;
    
    // CMS lock status
    const lockSection = $('cmsLockSection');
    const unlockedSection = $('cmsUnlockedSection');
    
    if (lockSection) lockSection.classList.toggle('hidden', state.cmsUnlocked);
    if (unlockedSection) unlockedSection.classList.toggle('hidden', !state.cmsUnlocked);
    
    // Diagnostics
    const diagVersion = $('diagVersion');
    const diagQuestionCount = $('diagQuestionCount');
    const diagTopicCount = $('diagTopicCount');
    const diagProgressCount = $('diagProgressCount');
    
    if (diagVersion) diagVersion.textContent = APP_VERSION;
    if (diagQuestionCount) diagQuestionCount.textContent = state.questions.length;
    if (diagTopicCount) diagTopicCount.textContent = Object.keys(state.questionsByTopic).length;
    if (diagProgressCount) diagProgressCount.textContent = Object.keys(state.progress).length;
    
    // Dev tools visibility
    const devTools = $('devTools');
    if (devTools) {
        devTools.classList.toggle('hidden', !state.devToolsEnabled);
    }
}

function applySettings() {
    const questionsPerSession = $('questionsPerSession');
    const showExplanation = $('showExplanation');
    const examQuestions = $('examQuestions');
    const examTime = $('examTime');
    
    if (questionsPerSession) questionsPerSession.value = state.settings.questionsPerSession;
    if (showExplanation) showExplanation.checked = state.settings.showExplanation;
    if (examQuestions) examQuestions.value = state.settings.examQuestions;
    if (examTime) examTime.value = state.settings.examTime;
}

// ==================== SEARCH ====================
function performSearch(query) {
    const container = $('searchResults');
    const clearBtn = $('clearSearch');
    
    if (!container) return;
    
    if (!query || query.length < 2) {
        container.innerHTML = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }
    
    if (clearBtn) clearBtn.classList.remove('hidden');
    
    const normalizedQuery = query.toLowerCase();
    const results = state.questions.filter(q => 
        q.questionText.toLowerCase().includes(normalizedQuery) ||
        q.mainTopic.toLowerCase().includes(normalizedQuery)
    ).slice(0, 50);
    
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">לא נמצאו תוצאות</p>';
        return;
    }
    
    container.innerHTML = results.map(q => {
        const highlighted = q.questionText.replace(
            new RegExp('(' + escapeRegExp(query) + ')', 'gi'),
            '<mark>$1</mark>'
        );
        return `
            <div class="search-result-item" data-id="${q.id}">
                <div class="search-result-topic">${escapeHtml(q.mainTopic)}</div>
                <div class="search-result-text">${highlighted}</div>
            </div>
        `;
    }).join('');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export
window.initTheme = initTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.showToast = showToast;
window.showConfetti = showConfetti;
window.showModal = showModal;
window.hideModal = hideModal;
window.hideAllModals = hideAllModals;
window.showConfirm = showConfirm;
window.handleConfirmAction = handleConfirmAction;
window.updateBootStatus = updateBootStatus;
window.checkRequiredElements = checkRequiredElements;
window.showBootError = showBootError;
window.clearAllDataAndReload = clearAllDataAndReload;
window.updateHomeStats = updateHomeStats;
window.renderTopicsList = renderTopicsList;
window.updateInsights = updateInsights;
window.renderAchievements = renderAchievements;
window.updateSettingsView = updateSettingsView;
window.applySettings = applySettings;
window.performSearch = performSearch;
