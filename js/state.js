/**
 * SkyMind State Management v3.2.0
 * Centralized application state with QSE profiles
 */

const APP_VERSION = '3.2.0';
const SCHEMA_VERSION = { QUESTIONS: 3, PROGRESS: 2, GAMIFICATION: 3, SETTINGS: 2 };

// Question Selection Engine (QSE) Profiles - Data-driven tutor behavior
const QSE_PROFILES = {
    balanced: {
        name: 'מאוזן',
        description: 'שילוב של שאלות לחזרה, חלשות וחדשות',
        weights: { due: 0.4, weak: 0.3, new: 0.2, random: 0.1 }
    },
    due_focus: {
        name: 'מיקוד בחזרות',
        description: 'עדיפות לשאלות שהגיע זמנן',
        weights: { due: 0.7, weak: 0.2, new: 0.1, random: 0 }
    },
    weak_focus: {
        name: 'חיזוק חולשות',
        description: 'התמקדות בשאלות שטעית בהן',
        weights: { due: 0.2, weak: 0.6, new: 0.1, random: 0.1 }
    },
    new_focus: {
        name: 'לימוד חדש',
        description: 'עדיפות לשאלות שלא ראית',
        weights: { due: 0.1, weak: 0.1, new: 0.7, random: 0.1 }
    },
    exam_prep: {
        name: 'הכנה למבחן',
        description: 'מיקס אקראי כמו במבחן אמיתי',
        weights: { due: 0.25, weak: 0.25, new: 0.25, random: 0.25 }
    }
};

// Infinite mode mastery criteria
const MASTERY_CRITERIA = {
    minCorrectStreak: 2,      // Correct 2 times in a row to master
    minAccuracy: 0.8,         // Or 80% accuracy with...
    minAttempts: 3,           // ...at least 3 attempts
    alertnessCheckInterval: 8, // Check mastered questions every N questions
    alertnessCheckProbability: 0.15, // Or 15% chance each question
    wrongReinjectDelay: 3     // Re-show wrong questions after N questions
};

// Rank levels (drone themed)
const RANKS = [
    { level: 1, name: 'טירון', minXP: 0, icon: '🔰' },
    { level: 2, name: 'מתלמד', minXP: 500, icon: '📚' },
    { level: 3, name: 'חובבן', minXP: 1500, icon: '🎮' },
    { level: 4, name: 'מטיס מתחיל', minXP: 3000, icon: '✈️' },
    { level: 5, name: 'מטיס מתקדם', minXP: 5000, icon: '🚁' },
    { level: 6, name: 'טייס מנוסה', minXP: 8000, icon: '🛩️' },
    { level: 7, name: 'קפטן', minXP: 12000, icon: '👨‍✈️' },
    { level: 8, name: 'אס', minXP: 18000, icon: '🦅' },
    { level: 9, name: 'מאסטר', minXP: 25000, icon: '🏆' },
    { level: 10, name: 'אגדה', minXP: 35000, icon: '👑' }
];

const CONFIG = {
    CMS_PASSWORD: 'skymind',
    DEFAULT_SESSION_SIZE: 20,
    DEFAULT_EXAM_QUESTIONS: 50,
    DEFAULT_EXAM_TIME: 45,
    STORAGE_KEYS: {
        QUESTIONS: 'skymind_questions_v3_2_1_hebrew_subtopics',
        PROGRESS: 'skymind_progress',
        SETTINGS: 'skymind_settings',
        CMS_UNLOCKED: 'skymind_cms_unlocked',
        THEME: 'skymind_theme',
        GAMIFICATION: 'skymind_gamification'
    },
    SR: {
        INITIAL_INTERVAL: 1,
        INITIAL_EASE: 2.5,
        MIN_EASE: 1.3,
        MAX_EASE: 3.0,
        AGAIN_PENALTY: 0.2
    },
    XP: {
        CORRECT: 10,
        WRONG: 2,
        STREAK_BONUS: 5,
        DAILY_BONUS: 50,
        STREAK_CAP: 25,
        TOPIC_COMPLETE: 100
    },
    LEVEL_XP: 500,
    CMS_PAGE_SIZE: 50,
    REQUIRED_ELEMENTS: [
        'splashScreen', 'homeScreen', 'topicsScreen', 'subtopicsScreen', 'quizScreen', 
        'resultsScreen', 'insightsScreen', 'achievementsScreen',
        'searchScreen', 'cmsScreen', 'settingsScreen', 
        'appHeader', 'bottomNav', 'toastContainer',
        'topicsList', 'subtopicsList'
    ]
    };


// ==================== TOPICS META (HEBREW ONLY UI) ====================
// Will be populated dynamically from topic_labels_he.json
let TOPICS_META = {
    mainOrder: ['drone_operating', 'drone_tecnical', 'meteorology', 'pilot_law'],
    mainLabels: {
        drone_operating: 'הפעלת כלי טיס',
        drone_tecnical: 'ידע טכני רחפנים',
        meteorology: 'מטאורולוגיה',
        pilot_law: 'חוק טיס'
    },
    subOrder: {},
    subLabels: {}
};

// Load Hebrew labels from file
function loadTopicLabels() {
    return fetch('data/topic_labels_he.json')
        .then(response => response.json())
        .then(data => {
            // Update mainLabels
            if (data.mainTopics) {
                TOPICS_META.mainLabels = data.mainTopics;
                TOPICS_META.mainOrder = Object.keys(data.mainTopics);
            }
            // Update subLabels
            if (data.subTopics) {
                TOPICS_META.subLabels = data.subTopics;
                // Build subOrder from labels
                TOPICS_META.subOrder = {};
                for (const main in data.subTopics) {
                    TOPICS_META.subOrder[main] = Object.keys(data.subTopics[main]);
                }
            }
            state.topicsMeta = TOPICS_META;
            log('Loaded Hebrew topic labels');
        })
        .catch(err => {
            log('Failed to load topic labels: ' + err.message + ' - using defaults');
        });
}

window.loadTopicLabels = loadTopicLabels;

// Centralized application state
const state = {
    // Data
    questions: [],
    questionsById: {},
    questionsByTopic: {},
    topicsMeta: TOPICS_META,
    selectedMainTopic: null,
    selectedSubTopic: null,
    progress: {},
    achievements: [],
    
    // Settings
    settings: {
        questionsPerSession: CONFIG.DEFAULT_SESSION_SIZE,
        showExplanation: true,
        examQuestions: CONFIG.DEFAULT_EXAM_QUESTIONS,
        examTime: CONFIG.DEFAULT_EXAM_TIME,
        qseProfile: 'balanced',
        masteryCriteria: { ...MASTERY_CRITERIA }
    },
    
    // Gamification
    gamification: null,
    
    // UI State
    cmsUnlocked: false,
    currentScreen: 'splashScreen',
    screenHistory: [],
    theme: 'dark',
    
    // Quiz State
    quiz: {
        mode: null,           // 'smart', 'topic', 'topic_failed', 'topic_mastered', 'topic_infinite', 'exam', 'review'
        focusMode: 'balanced',
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: null,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        // Infinite mode state
        infiniteState: null
    },
    
    // Study Timer
    studyTimer: {
        active: false,
        startTime: null,
        pausedTime: 0
    },
    
    // CMS State
    cms: {
        currentTab: 'questions',
        page: 1,
        filters: {
            topic: '',
            search: '',
            missingCorrect: false,
            needsReview: false
        },
        editingQuestion: null,
        importPreview: null,
        selected: {}
    },
    
    // Developer logs
    bootLogs: [],
    devToolsEnabled: false
};

// Default gamification state factory
function getDefaultGamification() {
    return {
        totalXP: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        dailyStreak: 0,
        lastStudyDate: null,
        sessionStreak: 0,
        bestSessionStreak: 0,
        totalStudyMinutes: 0,
        todayStudyMinutes: 0,
        todayDate: null,
        achievements: {},
        weeklyActivity: {},
        nightOwlCount: 0,
        earlyBirdUnlocked: false,
        examScores: [],
        topicMastery: {},
        completedTopics: [],
        schemaVersion: SCHEMA_VERSION.GAMIFICATION
    };
}

// Initialize gamification state
state.gamification = getDefaultGamification();

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function shuffleArray(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateId() {
    return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
}

function hashContent(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function getDateDiffDays(d1, d2) {
    const a = new Date(d1);
    const b = new Date(d2);
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
}

function log(msg) {
    console.log('[SkyMind] ' + msg);
    state.bootLogs.push({ time: Date.now(), msg: msg });
    if (state.bootLogs.length > 100) state.bootLogs.shift();
}

// Safe element query
function $(id) {
    const el = document.getElementById(id);
    return el;
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

// Get rank info for XP
function getRankInfo(xp) {
    let rank = RANKS[0];
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (xp >= RANKS[i].minXP) {
            rank = RANKS[i];
            break;
        }
    }
    const nextRank = RANKS.find(r => r.minXP > xp);
    const xpToNext = nextRank ? nextRank.minXP - xp : 0;
    const prevMinXP = rank.minXP;
    const nextMinXP = nextRank ? nextRank.minXP : rank.minXP + 10000;
    const progress = ((xp - prevMinXP) / (nextMinXP - prevMinXP)) * 100;
    
    return { rank, nextRank, xpToNext, progress: Math.min(progress, 100) };
}

// Export to global scope
window.APP_VERSION = APP_VERSION;
window.SCHEMA_VERSION = SCHEMA_VERSION;
window.CONFIG = CONFIG;
window.QSE_PROFILES = QSE_PROFILES;
window.MASTERY_CRITERIA = MASTERY_CRITERIA;
window.RANKS = RANKS;
window.state = state;
window.getDefaultGamification = getDefaultGamification;
window.escapeHtml = escapeHtml;
window.shuffleArray = shuffleArray;
window.formatTime = formatTime;
window.generateId = generateId;
window.hashContent = hashContent;
window.getTodayKey = getTodayKey;
window.getDateDiffDays = getDateDiffDays;
window.log = log;
window.$ = $;
window.$$ = $$;
window.getRankInfo = getRankInfo;
