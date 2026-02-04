/**
 * SkyMind Storage Module v3.2.0
 * Handles localStorage with migrations and file:// support
 */

// Save to localStorage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        log('Storage save error: ' + key + ' - ' + e.message);
        return false;
    }
}

// Load from localStorage
function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        log('Storage load error: ' + key + ' - ' + e.message);
        return null;
    }
}

// Remove from localStorage
function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

// Normalize questions to ensure consistent structure
function normalizeQuestions(questions, sourceFile) {
    if (!Array.isArray(questions)) return [];
    
    const now = Date.now();
    const seen = new Set();
    const normalized = [];
    
    questions.forEach((q, i) => {
        // Generate ID if missing
        let id = q.id;
        if (!id) {
            const content = (q.questionText || '') + (q.choices ? q.choices.join('') : '');
            id = 'q_' + hashContent(content) + '_' + i;
        }
        
        // Handle ID collisions
        let finalId = id;
        let suffix = 1;
        while (seen.has(finalId)) {
            finalId = id + '_' + suffix++;
        }
        seen.add(finalId);
        
        // Normalize correctIndex
        let correctIndex = q.correctIndex;
        if (typeof correctIndex !== 'number' || correctIndex < 0) {
            correctIndex = null;
        }
        
        // Ensure choices is an array
        let choices = Array.isArray(q.choices) ? q.choices.map(c => String(c || '').trim()) : [];
        
        // Filter empty choices but preserve valid structure
        choices = choices.filter((c, idx) => c || idx === correctIndex);
        
        // If correctIndex is out of bounds, mark for review
        let needsReview = q.needsReview || false;
        if (correctIndex !== null && (correctIndex >= choices.length || correctIndex < 0)) {
            correctIndex = null;
            needsReview = true;
        }
        
        // Mark questions with issues
        if (choices.length < 2) {
            needsReview = true;
        }
        if (!q.questionText || q.questionText.trim().length < 5) {
            needsReview = true;
        }
        
        normalized.push({
            id: finalId,
            mainTopic: q.mainTopic || q.topic || 'כללי',
            subTopic: q.subTopic || '',
            questionText: q.questionText || '[שאלה ' + (i + 1) + ']',
            choices: choices,
            correctIndex: correctIndex,
            explanation: q.explanation || '',
            needsReview: needsReview,
            rawBlock: q.rawBlock || '',
            sourceFile: sourceFile || q.sourceFile || '',
            createdAt: q.createdAt || now,
            updatedAt: q.updatedAt || now
        });
    });
    
    return normalized;
}

// Build indexes for fast lookup
function buildIndexes() {
    state.questionsById = {};
    state.questions.forEach(q => {
        state.questionsById[q.id] = q;
    });
    
    state.questionsByTopic = {};
    state.questions.forEach(q => {
        const topic = q.mainTopic || 'כללי';
        if (!state.questionsByTopic[topic]) {
            state.questionsByTopic[topic] = [];
        }
        state.questionsByTopic[topic].push(q);
    });
}

// Load questions from storage or fetch from file
function loadQuestions() {
    return new Promise((resolve, reject) => {
        updateBootStatus('loading', 'בודק נתונים מקומיים...');
        
        // Check localStorage first
        const stored = loadFromStorage(CONFIG.STORAGE_KEYS.QUESTIONS);
        if (stored && stored.length) {
            state.questions = normalizeQuestions(stored);
            buildIndexes();
            const topicCount = Object.keys(state.questionsByTopic).length;
            log('Loaded ' + state.questions.length + ' questions, ' + topicCount + ' topics from localStorage');
            updateBootStatus('ready', 'נטענו ' + state.questions.length + ' שאלות מהזיכרון');
            resolve(true);
            return;
        }
        
        // Check if running in file:// mode
        const isFileProtocol = location.protocol === 'file:';
        
        if (isFileProtocol) {
            log('Running in file:// mode - showing upload option');
            updateBootStatus('file_mode', 'מצב מקומי - טען קובץ שאלות');
            showFileUploadUI();
            resolve(false);
            return;
        }
        
        // Try to fetch from server
        updateBootStatus('loading', 'טוען מהשרת...');
        
        fetch('data/questions.json')
            .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data) || !data.length) {
                    throw new Error('קובץ ריק');
                }
                state.questions = normalizeQuestions(data, 'questions.json');
                buildIndexes();
                saveToStorage(CONFIG.STORAGE_KEYS.QUESTIONS, state.questions);
                const topicCount = Object.keys(state.questionsByTopic).length;
                log('Loaded ' + state.questions.length + ' questions, ' + topicCount + ' topics from server');
                updateBootStatus('ready', 'נטענו ' + state.questions.length + ' שאלות');
                resolve(true);
            })
            .catch(error => {
                log('Failed to load questions: ' + error.message);
                updateBootStatus('error', 'שגיאה בטעינה');
                showFileUploadUI();
                resolve(false);
            });
    });
}

// Show file upload UI for file:// mode or when fetch fails
function showFileUploadUI() {
    const splash = $('splashScreen');
    if (!splash) return;
    
    splash.innerHTML = `
        <div class="splash-content">
            <div class="splash-logo">
                <svg viewBox="0 0 100 100" class="drone-icon">
                    <circle cx="50" cy="50" r="8" fill="var(--accent-primary)"/>
                    <line x1="50" y1="50" x2="20" y2="20" stroke="var(--accent-primary)" stroke-width="3"/>
                    <line x1="50" y1="50" x2="80" y2="20" stroke="var(--accent-primary)" stroke-width="3"/>
                    <line x1="50" y1="50" x2="20" y2="80" stroke="var(--accent-primary)" stroke-width="3"/>
                    <line x1="50" y1="50" x2="80" y2="80" stroke="var(--accent-primary)" stroke-width="3"/>
                    <circle cx="20" cy="20" r="12" fill="none" stroke="var(--accent-secondary)" stroke-width="2"/>
                    <circle cx="80" cy="20" r="12" fill="none" stroke="var(--accent-secondary)" stroke-width="2"/>
                    <circle cx="20" cy="80" r="12" fill="none" stroke="var(--accent-secondary)" stroke-width="2"/>
                    <circle cx="80" cy="80" r="12" fill="none" stroke="var(--accent-secondary)" stroke-width="2"/>
                </svg>
            </div>
            <h1 class="splash-title">SkyMind</h1>
            <p class="splash-subtitle">טען קובץ שאלות כדי להתחיל</p>
            <div class="file-upload-area" id="fileUploadArea">
                <input type="file" id="manualFileInput" accept=".json,.txt" class="hidden">
                <label for="manualFileInput" class="btn-primary upload-btn">
                    📁 בחר קובץ שאלות (JSON / TXT)
                </label>
                <p class="upload-hint">גרור קובץ לכאן או לחץ לבחירה</p>
            </div>
            <div class="splash-tips glass" style="margin-top: 20px; padding: 15px; text-align: right;">
                <h4>💡 טיפ</h4>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">
                    להפעלה מיטבית, הפעל שרת מקומי:
                    <br><code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">python3 -m http.server 8000</code>
                </p>
            </div>
        </div>
    `;
    
    // Add event listeners
    const fileInput = document.getElementById('manualFileInput');
    const uploadArea = document.getElementById('fileUploadArea');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleManualFileUpload);
    }
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', e => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length) {
                processUploadedFile(files[0]);
            }
        });
    }
}

// Handle manual file upload
function handleManualFileUpload(e) {
    const files = e.target.files;
    if (files && files.length) {
        processUploadedFile(files[0]);
    }
}

// Process uploaded file (JSON or TXT)
function processUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
        const content = evt.target.result;
        
        try {
            let questions = [];
            
            if (file.name.endsWith('.json')) {
                const data = JSON.parse(content);
                questions = Array.isArray(data) ? data : [data];
            } else {
                // Parse TXT file
                questions = parseRawText(content, file.name);
            }
            
            if (questions.length === 0) {
                alert('לא נמצאו שאלות בקובץ');
                return;
            }
            
            state.questions = normalizeQuestions(questions, file.name);
            buildIndexes();
            saveToStorage(CONFIG.STORAGE_KEYS.QUESTIONS, state.questions);
            
            log('Loaded ' + state.questions.length + ' questions from manual upload: ' + file.name);
            
            // Continue app initialization
            continueInitAfterLoad();
            
        } catch (err) {
            log('File parse error: ' + err.message);
            alert('שגיאה בקריאת הקובץ: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Continue initialization after questions are loaded
function continueInitAfterLoad() {
    loadAchievementsDefinitions().then(() => {
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
        }, 500);
    });
}

// Save questions to storage
function saveQuestions() {
    return saveToStorage(CONFIG.STORAGE_KEYS.QUESTIONS, state.questions);
}

// Load progress from storage
function loadProgress() {
    const saved = loadFromStorage(CONFIG.STORAGE_KEYS.PROGRESS);
    if (saved) {
        state.progress = saved;
    }
}

// Save progress to storage
function saveProgress() {
    saveToStorage(CONFIG.STORAGE_KEYS.PROGRESS, state.progress);
}

// Load settings from storage
function loadSettings() {
    const saved = loadFromStorage(CONFIG.STORAGE_KEYS.SETTINGS);
    if (saved) {
        state.settings = Object.assign({}, state.settings, saved);
    }
    state.cmsUnlocked = loadFromStorage(CONFIG.STORAGE_KEYS.CMS_UNLOCKED) === true;
}

// Save settings to storage
function saveSettings() {
    saveToStorage(CONFIG.STORAGE_KEYS.SETTINGS, state.settings);
}

// Load gamification data
function loadGamification() {
    const saved = loadFromStorage(CONFIG.STORAGE_KEYS.GAMIFICATION);
    if (saved) {
        state.gamification = Object.assign(getDefaultGamification(), saved);
        
        // Update daily streak
        updateDailyStreak();
        
        // Reset today's minutes if new day
        const today = getTodayKey();
        if (state.gamification.todayDate !== today) {
            state.gamification.todayStudyMinutes = 0;
            state.gamification.todayDate = today;
        }
    }
}

// Save gamification data
function saveGamification() {
    saveToStorage(CONFIG.STORAGE_KEYS.GAMIFICATION, state.gamification);
}

// Load achievements definitions
function loadAchievementsDefinitions() {
    // Try to fetch, but provide fallback for file:// mode
    return fetch('data/achievements.json')
        .then(response => response.json())
        .then(data => {
            state.achievements = data;
            log('Loaded ' + data.length + ' achievement definitions');
        })
        .catch(error => {
            log('Failed to load achievements: ' + error.message + ' - using defaults');
            // Minimal fallback achievements
            state.achievements = [
                { id: 'first_blood', name: 'צעד ראשון', description: 'ענה נכון על שאלה אחת', icon: '🎯', xpBonus: 25 },
                { id: 'first_10', name: 'התחלה טובה', description: 'ענה על 10 שאלות', icon: '📝', xpBonus: 50 },
                { id: 'streak_3', name: 'שלושה בשורה', description: 'למד 3 ימים רצופים', icon: '🔥', xpBonus: 75 }
            ];
        });
}

// Clear all data
function clearAllData() {
    const keys = Object.values(CONFIG.STORAGE_KEYS);
    keys.forEach(key => {
        try { localStorage.removeItem(key); } catch (e) {}
    });
}

// Export functions
window.saveToStorage = saveToStorage;
window.loadFromStorage = loadFromStorage;
window.removeFromStorage = removeFromStorage;
window.normalizeQuestions = normalizeQuestions;
window.buildIndexes = buildIndexes;
window.loadQuestions = loadQuestions;
window.saveQuestions = saveQuestions;
window.loadProgress = loadProgress;
window.saveProgress = saveProgress;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.loadGamification = loadGamification;
window.saveGamification = saveGamification;
window.loadAchievementsDefinitions = loadAchievementsDefinitions;
window.clearAllData = clearAllData;
window.showFileUploadUI = showFileUploadUI;
window.processUploadedFile = processUploadedFile;
window.continueInitAfterLoad = continueInitAfterLoad;
