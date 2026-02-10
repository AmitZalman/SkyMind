/**
 * SkyMind App v3.2.0
 * Main entry point - bootstraps application
 */

// ==================== SERVICE WORKER ====================
function resetServiceWorker() {
    showToast('מאפס Service Worker...', 'info');
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
        });
    }
    
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(n => caches.delete(n));
        });
    }
    
    setTimeout(() => {
        showToast('מרענן...', 'success');
        location.reload();
    }, 1000);
}

function clearCacheOnly() {
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(n => caches.delete(n));
        });
    }
    showToast('Cache נוקה!', 'success');
}
// ======= AUTO UPDATE (VERSION CHECK) =======
const VERSION_URL = 'data/version.json';
const VERSION_KEY = 'skymind_app_version';

async function getRemoteVersion() {
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version fetch failed: ${res.status}`);
  const data = await res.json();
  return String(data.version || '').trim();
}

function clearQuestionLocalStorage() {
  // מוחק רק דאטה לימודי — שומר theme, settings, cms_unlocked, progress, gamification
  const dataKeys = [
    'skymind_questions_',
    'skymind_topics_',
    'skymind_subtopics_',
    'skymind_questionsByTopic',
    'skymind_question',
    'skymind_bank',
    'skymind_cms_',
  ];

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (dataKeys.some(p => k.startsWith(p))) {
      localStorage.removeItem(k);
    }
  }
}


async function applyUpdateIfNeeded() {
  try {
    const remote = await getRemoteVersion();
    if (!remote) return;

    const local = localStorage.getItem(VERSION_KEY);

    if (!local) {
      localStorage.setItem(VERSION_KEY, remote);
      return;
    }

    if (local !== remote) {
      console.log(`[SkyMind] New version detected: ${local} -> ${remote}`);

      const guardKey = `skymind_reload_guard_${remote}`;
      if (sessionStorage.getItem(guardKey)) {
        console.warn('[SkyMind] Reload guard active, skipping reload');
        return;
      }

      // 1) Clear stale question data from localStorage
      clearQuestionLocalStorage();

      // 2) Set new version AFTER clearing (so it persists through reload)
      localStorage.setItem(VERSION_KEY, remote);

      // 3) Reload to fetch fresh data — SW is network-first for JSON, no nuke needed
      sessionStorage.setItem(guardKey, '1');
      location.reload();
    }
  } catch (e) {
    console.warn('[SkyMind] version check failed, continuing...', e);
  }
}

// ==================== DIAGNOSTICS ====================
let diagClickCount = 0;
let diagClickTimer = null;

function handleDiagnosticsClick() {
    diagClickCount++;
    
    if (diagClickTimer) clearTimeout(diagClickTimer);
    diagClickTimer = setTimeout(() => { diagClickCount = 0; }, 2000);
    
    if (diagClickCount >= 5) {
        state.devToolsEnabled = !state.devToolsEnabled;
        updateSettingsView();
        showToast(state.devToolsEnabled ? 'מצב מפתחים פעיל' : 'מצב מפתחים כבוי', 'info');
        diagClickCount = 0;
    }
}

function validateQuestionBank() {
    const issues = [];
    
    state.questions.forEach((q, i) => {
        if (!q.id) issues.push(`שאלה ${i}: חסר ID`);
        if (!q.questionText) issues.push(`${q.id}: חסר טקסט שאלה`);
        if (q.choices.length < 2) issues.push(`${q.id}: פחות מ-2 תשובות`);
        if (q.correctIndex === null) issues.push(`${q.id}: חסרה תשובה נכונה`);
        if (q.correctIndex !== null && q.correctIndex >= q.choices.length) {
            issues.push(`${q.id}: אינדקס תשובה נכונה לא תקין`);
        }
    });
    
    if (issues.length === 0) {
        showToast('המאגר תקין! ' + state.questions.length + ' שאלות', 'success');
    } else {
        console.log('Validation issues:', issues);
        showToast('נמצאו ' + issues.length + ' בעיות. ראה קונסול.', 'warning');
    }
}

function rebuildIndexes() {
    buildIndexes();
    showToast('האינדקסים נבנו מחדש', 'success');
}

function generateTestData() {
    state.gamification.totalXP = 1500;
    state.gamification.totalCorrect = 75;
    state.gamification.totalAnswered = 100;
    state.gamification.dailyStreak = 5;
    state.gamification.bestSessionStreak = 8;
    state.gamification.totalStudyMinutes = 120;
    saveGamification();
    updateHomeStats();
    showToast('נתוני בדיקה נוצרו', 'success');
}

function showLogs() {
    console.log('=== SkyMind Logs ===');
    state.bootLogs.forEach(l => {
        console.log(new Date(l.time).toISOString(), l.msg);
    });
    showToast('הלוגים הודפסו לקונסול', 'info');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Helper function
    const addClick = (id, fn) => {
        const el = $(id);
        if (el) el.addEventListener('click', fn);
    };
    
    // Header
    addClick('backBtn', goBack);
    addClick('themeToggle', toggleTheme);
    
    // Home actions
    addClick('smartTutorBtn', showSmartTutorScreen);
    addClick('practiceBtn', () => showScreen('topicsScreen'));
    addClick('examBtn', startExam);
    addClick('searchBtn', () => showScreen('searchScreen'));
    
    // Topics list
    const topicsList = $('topicsList');
    if (topicsList) {
        topicsList.addEventListener('click', e => {
            const card = e.target.closest('.topic-card');
            if (card) {
                state.selectedMainTopic = card.dataset.topic;
                state.selectedSubTopic = null;
                showScreen('subtopicsScreen');
            }
        });
    }
    
    // Subtopics list
    const subtopicsList = $('subtopicsList');
    if (subtopicsList) {
        subtopicsList.addEventListener('click', e => {
            const card = e.target.closest('.topic-card');
            if (card) {
                const topic = card.dataset.topic;
                const sub = card.dataset.subtopic;
                state.selectedMainTopic = topic;
                state.selectedSubTopic = sub;
                showTopicModeSelection(topic, sub);
            }
        });
    }
    
    // Topic mode modal
    const topicModeModal = $('topicModeModal');
    if (topicModeModal) {
        topicModeModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('topicModeModal'));
        topicModeModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('topicModeModal'));
    }
    
    // Smart Tutor
    addClick('startTutorBtn', startSmartTutor);
    
    // QSE Profile selector
    const qseProfileSelector = $('qseProfileSelector');
    if (qseProfileSelector) {
        qseProfileSelector.addEventListener('change', e => changeQSEProfile(e.target.value));
    }
    
    // Quiz
    const choicesList = $('choicesList');
    if (choicesList) {
        choicesList.addEventListener('click', e => {
            const btn = e.target.closest('.choice-btn');
            if (btn && !btn.classList.contains('disabled')) {
                handleAnswer(parseInt(btn.dataset.index));
            }
        });
    }
    
    addClick('nextBtn', nextQuestion);
    addClick('finishBtn', finishQuiz);
    
    // Results
    addClick('reviewMistakesBtn', startReviewMistakes);
    addClick('retryBtn', retryQuiz);
    addClick('homeFromResultsBtn', goHome);
    
    // Search
    const searchInput = $('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => performSearch(e.target.value));
    }
    
    addClick('clearSearch', () => {
        const input = $('searchInput');
        if (input) input.value = '';
        const results = $('searchResults');
        if (results) results.innerHTML = '';
        const clearBtn = $('clearSearch');
        if (clearBtn) clearBtn.classList.add('hidden');
    });
    
    const searchResults = $('searchResults');
    if (searchResults) {
        searchResults.addEventListener('click', e => {
            const item = e.target.closest('.search-result-item');
            if (item && state.cmsUnlocked) {
                const q = state.questionsById[item.dataset.id];
                if (q) showEditor(q);
            }
        });
    }
    
    // Insights
    const weakTopics = $('weakTopics');
    if (weakTopics) {
        weakTopics.addEventListener('click', e => {
            const btn = e.target.closest('.weak-topic-btn');
            if (btn) startTopicPractice(btn.dataset.topic);
        });
    }
    
    // CMS Tabs
    const cmsTabs = document.querySelectorAll('.cms-tab');
    cmsTabs.forEach(tab => {
        tab.addEventListener('click', () => switchCMSTab(tab.dataset.tab));
    });
    
    // CMS Actions
    addClick('addQuestionBtn', () => showEditor());
    addClick('exportQuestionsBtn', exportQuestions);
    addClick('commitToGithubBtn', showGithubCommitModal);
    
    // CMS Filters
    const cmsTopicFilter = $('cmsTopicFilter');
    if (cmsTopicFilter) cmsTopicFilter.addEventListener('change', updateCMSQuestionsList);
    
    const cmsSearch = $('cmsSearch');
    if (cmsSearch) cmsSearch.addEventListener('input', updateCMSQuestionsList);
    
    const cmsMissingCorrect = $('cmsMissingCorrect');
    if (cmsMissingCorrect) cmsMissingCorrect.addEventListener('change', updateCMSQuestionsList);
    
    // CMS List clicks + checkbox
    const cmsQuestionsList = $('cmsQuestionsList');
    if (cmsQuestionsList) {
        cmsQuestionsList.addEventListener('click', e => {
            const editBtn = e.target.closest('.cms-btn.edit');
            const deleteBtn = e.target.closest('.cms-btn.delete');

            if (editBtn) {
                const q = state.questionsById[editBtn.dataset.id];
                if (q) showEditor(q);
            } else if (deleteBtn) {
                deleteQuestion(deleteBtn.dataset.id);
            }
        });
        cmsQuestionsList.addEventListener('change', e => {
            if (e.target.classList.contains('cms-q-check')) {
                toggleCmsSelect(e.target.dataset.id, e.target.checked);
            }
        });
    }

    // CMS Bulk actions
    addClick('cmsDeleteSelected', cmsDeleteSelected);
    addClick('cmsClearSelection', cmsClearSelection);
    const cmsSelectAll = $('cmsSelectAll');
    if (cmsSelectAll) {
        cmsSelectAll.addEventListener('change', e => window.cmsSelectAll(e.target.checked));
    }
    
    // CMS Pagination
    const cmsPagination = $('cmsPagination');
    if (cmsPagination) {
        cmsPagination.addEventListener('click', e => {
            const btn = e.target.closest('button[data-page]');
            if (btn) {
                state.cms.page = parseInt(btn.dataset.page);
                updateCMSQuestionsList();
            }
        });
    }
    
    // CMS Topics
    const cmsTopicsList = $('cmsTopicsList');
    if (cmsTopicsList) {
        cmsTopicsList.addEventListener('click', e => {
            const btn = e.target.closest('.topic-edit-btn');
            if (btn) showTopicEditor(btn.dataset.topic);
        });
    }
    
    // CMS Review
    const cmsReviewList = $('cmsReviewList');
    if (cmsReviewList) {
        cmsReviewList.addEventListener('click', e => {
            const editBtn = e.target.closest('.cms-btn.edit');
            const deleteBtn = e.target.closest('.cms-btn.delete');
            
            if (editBtn) {
                const q = state.questionsById[editBtn.dataset.id];
                if (q) showEditor(q);
            } else if (deleteBtn) {
                deleteQuestion(deleteBtn.dataset.id);
            }
        });
    }
    
    // Import buttons
    addClick('importJsonBtn', () => $('importJsonFile')?.click());
    addClick('importTextBtn', () => $('importTextFile')?.click());
    addClick('importBackupBtn', () => $('importBackupFile')?.click());
    
    const importJsonFile = $('importJsonFile');
    if (importJsonFile) {
        importJsonFile.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = evt => importQuestions(evt.target.result);
                reader.readAsText(file);
                e.target.value = '';
            }
        });
    }
    
    const importTextFile = $('importTextFile');
    if (importTextFile) {
        importTextFile.addEventListener('change', e => {
            if (e.target.files?.length) {
                importTextFiles(e.target.files);
                e.target.value = '';
            }
        });
    }
    
    const importBackupFile = $('importBackupFile');
    if (importBackupFile) {
        importBackupFile.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = evt => importBackup(evt.target.result);
                reader.readAsText(file);
                e.target.value = '';
            }
        });
    }
    
    addClick('exportAllBtn', exportFullBackup);
    addClick('exportQuestionsOnlyBtn', exportQuestions);
    addClick('resetBankBtn', resetQuestionBank);
    
    // Editor modal
    const editorModal = $('editorModal');
    if (editorModal) {
        editorModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('editorModal'));
        editorModal.querySelector('.cancel-btn')?.addEventListener('click', () => hideModal('editorModal'));
        editorModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('editorModal'));
    }
    
    const questionForm = $('questionForm');
    if (questionForm) {
        questionForm.addEventListener('submit', e => {
            e.preventDefault();
            saveQuestion();
        });
    }
    
    addClick('addChoiceBtn', addChoice);
    addClick('duplicateQuestionBtn', duplicateQuestion);
    addClick('deleteQuestionBtn', () => {
        if (state.cms.editingQuestion) deleteQuestion(state.cms.editingQuestion);
    });
    
    const choicesEditor = $('choicesEditor');
    if (choicesEditor) {
        choicesEditor.addEventListener('click', e => {
            if (e.target.classList.contains('remove-choice')) {
                const row = e.target.closest('.choice-edit-row');
                const rows = choicesEditor.querySelectorAll('.choice-edit-row');
                const index = Array.from(rows).indexOf(row);
                if (index >= 0) removeChoice(index);
            }
        });
    }
    
    // Topic editor modal
    const topicEditorModal = $('topicEditorModal');
    if (topicEditorModal) {
        topicEditorModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('topicEditorModal'));
        topicEditorModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('topicEditorModal'));
    }
    
    addClick('renameTopicBtn', renameTopic);
    addClick('mergeTopicBtn', showMergeTopicModal);
    addClick('deleteTopicBtn', deleteTopic);
    
    // Merge topic modal
    const mergeTopicModal = $('mergeTopicModal');
    if (mergeTopicModal) {
        mergeTopicModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('mergeTopicModal'));
        mergeTopicModal.querySelector('.cancel-btn')?.addEventListener('click', () => hideModal('mergeTopicModal'));
        mergeTopicModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('mergeTopicModal'));
    }
    
    addClick('confirmMergeBtn', mergeTopic);
    
    // Confirm modal
    const confirmModal = $('confirmModal');
    if (confirmModal) {
        confirmModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('confirmModal'));
        confirmModal.querySelector('.cancel-btn')?.addEventListener('click', () => hideModal('confirmModal'));
        confirmModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('confirmModal'));
    }
    
    addClick('confirmActionBtn', handleConfirmAction);
    
    // GitHub commit modal
    const githubCommitModal = $('githubCommitModal');
    if (githubCommitModal) {
        githubCommitModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('githubCommitModal'));
        githubCommitModal.querySelector('.cancel-btn')?.addEventListener('click', () => hideModal('githubCommitModal'));
        githubCommitModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('githubCommitModal'));
    }
    addClick('ghCommitBtn', commitToGitHub);

    // About modal
    const aboutModal = $('aboutModal');
    if (aboutModal) {
        aboutModal.querySelector('.close-modal-btn')?.addEventListener('click', () => hideModal('aboutModal'));
        aboutModal.querySelector('.modal-overlay')?.addEventListener('click', () => hideModal('aboutModal'));
    }
    
    // Settings
    const questionsPerSession = $('questionsPerSession');
    if (questionsPerSession) {
        questionsPerSession.addEventListener('change', e => {
            state.settings.questionsPerSession = parseInt(e.target.value) || 20;
            saveSettings();
        });
    }
    
    const showExplanation = $('showExplanation');
    if (showExplanation) {
        showExplanation.addEventListener('change', e => {
            state.settings.showExplanation = e.target.checked;
            saveSettings();
        });
    }
    
    const examQuestions = $('examQuestions');
    if (examQuestions) {
        examQuestions.addEventListener('change', e => {
            state.settings.examQuestions = parseInt(e.target.value) || 50;
            saveSettings();
        });
    }
    
    const examTime = $('examTime');
    if (examTime) {
        examTime.addEventListener('change', e => {
            state.settings.examTime = parseInt(e.target.value) || 45;
            saveSettings();
        });
    }
    
    addClick('themeToggleSettings', toggleTheme);
    addClick('unlockCms', unlockCMS);
    addClick('lockCms', lockCMS);
    addClick('exportProgress', exportProgress);
    
    addClick('importProgressBtn', () => $('importProgressFile')?.click());
    
    const importProgressFile = $('importProgressFile');
    if (importProgressFile) {
        importProgressFile.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = evt => importProgress(evt.target.result);
                reader.readAsText(file);
                e.target.value = '';
            }
        });
    }
    
    addClick('resetProgress', resetProgress);
    addClick('resetGamification', resetGamification);
    addClick('resetAll', resetAll);
    addClick('clearCacheBtn', clearCacheOnly);
    addClick('resetSWBtn', resetServiceWorker);
    
    // Diagnostics
    const diagnosticsTitle = $('diagnosticsTitle');
    if (diagnosticsTitle) {
        diagnosticsTitle.addEventListener('click', handleDiagnosticsClick);
    }
    
    addClick('validateBankBtn', validateQuestionBank);
    addClick('rebuildIndexBtn', rebuildIndexes);
    addClick('genTestDataBtn', generateTestData);
    addClick('showLogsBtn', showLogs);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal:not(.hidden)');
            if (modal) {
                modal.classList.add('hidden');
            } else if (state.currentScreen !== 'homeScreen' && state.currentScreen !== 'splashScreen') {
                goBack();
            }
        }
    });
    
    // Visibility change for study timer
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// ==================== INIT ====================

async function init() {
    await applyUpdateIfNeeded();
    log('v' + APP_VERSION + ' initializing...');
    
    // Theme
    initTheme();
    
    updateBootStatus('init', 'מאתחל...');
    
    // Check required elements
    const missing = checkRequiredElements();
    if (missing.length > 0) {
        showBootError('שגיאת DOM', 'חסרים אלמנטים נדרשים', null, missing);
        return;
    }
    
    // Load data
    loadSettings();
    loadProgress();
    loadGamification();
    
    updateBootStatus('loading', 'טוען שאלות...');
    
    // Load questions and achievements
    Promise.all([
        loadQuestions(),
        loadAchievementsDefinitions(),
        loadTopicLabels()
    ])
    .then(([questionsLoaded]) => {
        if (!questionsLoaded) return;
        
        updateBootStatus('setup', 'מגדיר ממשק...');
        
        applySettings();
        setupEventListeners();
        setupRouter();
        updateHomeStats();
        
        const count = state.questions.length;
        const topicCount = Object.keys(state.questionsByTopic).length;
        
        updateBootStatus('ready', 'מוכן!');
        log('Boot complete: ' + count + ' questions, ' + topicCount + ' topics');
        
        setTimeout(() => {
            showScreen('homeScreen');
            showToast('נטענו ' + count + ' שאלות', 'success');
        }, 1000);
        
        // Register service worker
        if ('serviceWorker' in navigator && !location.search.includes('nocache')) {
            navigator.serviceWorker.register('sw.js')
                .then(() => log('SW registered'))
                .catch(e => log('SW failed: ' + e.message));
        }
    })
    .catch(error => {
        log('Init error: ' + error.message);
        showBootError('שגיאה בטעינה', 'לא ניתן לאתחל את האפליקציה', error.message);
    });
}

// Single entry point
document.addEventListener('DOMContentLoaded', init);

// Global exports for debugging
window.skymindDiagnostics = {
    state: () => state,
    logs: () => state.bootLogs,
    version: APP_VERSION,
    resetSW: resetServiceWorker,
    validateBank: validateQuestionBank
};
