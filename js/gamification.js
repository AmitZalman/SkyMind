/**
 * SkyMind Gamification Module v3.2.0
 * XP, Levels, Achievements, Streaks, Ranks
 */

// Get level from XP (simple formula)
function getLevel(xp) {
    return Math.floor(xp / CONFIG.LEVEL_XP) + 1;
}

// Get XP needed for next level
function getXPToNextLevel(xp) {
    return CONFIG.LEVEL_XP - (xp % CONFIG.LEVEL_XP);
}

// Get level progress percentage
function getLevelProgress(xp) {
    return ((xp % CONFIG.LEVEL_XP) / CONFIG.LEVEL_XP) * 100;
}

// Update daily streak
function updateDailyStreak() {
    const today = getTodayKey();
    const lastDate = state.gamification.lastStudyDate;
    
    if (!lastDate) return;
    
    const diff = getDateDiffDays(lastDate, today);
    if (diff > 1) {
        // Check for comeback achievement
        if (diff >= 7 && state.gamification.dailyStreak > 0) {
            // User is coming back after a week break
            state.gamification.comebackFlag = true;
        }
        
        // Streak broken
        state.gamification.dailyStreak = 0;
        log('Daily streak reset (gap of ' + diff + ' days)');
    }
}

// Record study activity for today
function recordStudyDay() {
    const today = getTodayKey();
    const lastDate = state.gamification.lastStudyDate;
    const g = state.gamification;
    
    if (lastDate !== today) {
        if (lastDate) {
            const diff = getDateDiffDays(lastDate, today);
            if (diff === 1) {
                // Consecutive day
                g.dailyStreak++;
                log('Daily streak increased to ' + g.dailyStreak);
            } else if (diff > 1) {
                // Streak broken, start new
                g.dailyStreak = 1;
            }
        } else {
            // First study day
            g.dailyStreak = 1;
        }
        
        g.lastStudyDate = today;
        
        // Daily bonus
        awardXP(CONFIG.XP.DAILY_BONUS, 'daily study bonus');
    }
    
    // Track weekly activity
    g.weeklyActivity[today] = (g.weeklyActivity[today] || 0) + 1;
    
    // Clean old entries (keep 30 days)
    const keys = Object.keys(g.weeklyActivity).sort();
    while (keys.length > 30) {
        delete g.weeklyActivity[keys.shift()];
    }
    
    saveGamification();
}

// Award XP
function awardXP(amount, reason) {
    const g = state.gamification;
    const oldRank = getRankInfo(g.totalXP).rank;
    
    g.totalXP += amount;
    log('Awarded ' + amount + ' XP for ' + reason + '. Total: ' + g.totalXP);
    
    const newRank = getRankInfo(g.totalXP).rank;
    if (newRank.level > oldRank.level) {
        showToast('🎉 עלית לדרגת ' + newRank.name + ' ' + newRank.icon, 'success');
        showConfetti();
    }
    
    saveGamification();
    return amount;
}

// Record an answer and update gamification
function recordAnswer(correct) {
    const g = state.gamification;
    
    g.totalAnswered++;
    recordStudyDay();
    
    let xpEarned = 0;
    
    if (correct) {
        g.totalCorrect++;
        g.sessionStreak++;
        
        if (g.sessionStreak > g.bestSessionStreak) {
            g.bestSessionStreak = g.sessionStreak;
        }
        
        xpEarned += awardXP(CONFIG.XP.CORRECT, 'correct answer');
        
        // Streak bonus (every 5 in a row, up to cap)
        if (g.sessionStreak > 0 && g.sessionStreak % 5 === 0) {
            const bonus = Math.min(g.sessionStreak, CONFIG.XP.STREAK_CAP);
            xpEarned += awardXP(bonus, g.sessionStreak + ' correct streak');
            showToast('🔥 רצף של ' + g.sessionStreak + '! +' + bonus + ' XP', 'success');
        }
    } else {
        g.sessionStreak = 0;
        xpEarned += awardXP(CONFIG.XP.WRONG, 'attempt');
    }
    
    // Check for night owl achievement
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
        g.nightOwlCount = (g.nightOwlCount || 0) + 1;
    }
    
    // Check for early bird
    if (hour >= 5 && hour < 6) {
        g.earlyBirdUnlocked = true;
    }
    
    checkAchievements();
    saveGamification();
    
    return xpEarned;
}

// Reset session streak (call at start of new session)
function resetSessionStreak() {
    state.gamification.sessionStreak = 0;
    saveGamification();
}

// Record exam score
function recordExamScore(score, total) {
    const g = state.gamification;
    const percentage = Math.round(score / total * 100);
    
    g.examScores = g.examScores || [];
    g.examScores.push({
        score: score,
        total: total,
        percentage: percentage,
        date: Date.now()
    });
    
    // Keep last 20 exams
    if (g.examScores.length > 20) {
        g.examScores.shift();
    }
    
    saveGamification();
    checkAchievements();
}

// Record topic completion (infinite mode)
function recordTopicCompletion(topic) {
    const g = state.gamification;
    g.completedTopics = g.completedTopics || [];
    
    if (!g.completedTopics.includes(topic)) {
        g.completedTopics.push(topic);
        awardXP(CONFIG.XP.TOPIC_COMPLETE, 'topic complete: ' + topic);
        showToast('🎉 סיימת את הנושא: ' + topic, 'success');
        showConfetti();
    }
    
    saveGamification();
    checkAchievements();
}

// Check and unlock achievements
function checkAchievements() {
    const g = state.gamification;
    const newUnlocks = [];
    
    state.achievements.forEach(ach => {
        if (g.achievements && g.achievements[ach.id]) return; // Already unlocked
        
        let unlocked = false;
        
        switch (ach.id) {
            case 'first_blood':
                unlocked = g.totalCorrect >= 1;
                break;
            case 'first_10':
                unlocked = g.totalAnswered >= 10;
                break;
            case 'correct_50':
                unlocked = g.totalCorrect >= 50;
                break;
            case 'correct_100':
                unlocked = g.totalCorrect >= 100;
                break;
            case 'correct_500':
                unlocked = g.totalCorrect >= 500;
                break;
            case 'correct_1000':
                unlocked = g.totalCorrect >= 1000;
                break;
            case 'streak_3':
                unlocked = g.dailyStreak >= 3;
                break;
            case 'streak_7':
                unlocked = g.dailyStreak >= 7;
                break;
            case 'streak_30':
                unlocked = g.dailyStreak >= 30;
                break;
            case 'xp_1000':
                unlocked = g.totalXP >= 1000;
                break;
            case 'xp_5000':
                unlocked = g.totalXP >= 5000;
                break;
            case 'xp_10000':
                unlocked = g.totalXP >= 10000;
                break;
            case 'study_60':
                unlocked = g.totalStudyMinutes >= 60;
                break;
            case 'study_300':
                unlocked = g.totalStudyMinutes >= 300;
                break;
            case 'session_streak_5':
                unlocked = g.bestSessionStreak >= 5;
                break;
            case 'session_streak_10':
                unlocked = g.bestSessionStreak >= 10;
                break;
            case 'session_streak_20':
                unlocked = g.bestSessionStreak >= 20;
                break;
            case 'exam_pass':
                unlocked = g.examScores && g.examScores.some(e => e.percentage >= 60);
                break;
            case 'exam_hero':
                unlocked = g.examScores && g.examScores.some(e => e.percentage >= 80);
                break;
            case 'exam_perfect':
                unlocked = g.examScores && g.examScores.some(e => e.percentage === 100);
                break;
            case 'topic_master':
                unlocked = Object.keys(state.questionsByTopic).some(t => isTopicMastered(t));
                break;
            case 'all_topics':
                const topics = Object.keys(state.questionsByTopic);
                unlocked = topics.every(t => {
                    const questions = state.questionsByTopic[t];
                    return questions.some(q => state.progress[q.id] && state.progress[q.id].attempts > 0);
                });
                break;
            case 'topic_complete':
                unlocked = (g.completedTopics || []).length > 0;
                break;
            case 'night_owl':
                unlocked = (g.nightOwlCount || 0) >= 20;
                break;
            case 'early_bird':
                unlocked = g.earlyBirdUnlocked === true;
                break;
            case 'comeback':
                unlocked = g.comebackFlag === true;
                break;
        }
        
        if (unlocked) {
            if (!g.achievements) g.achievements = {};
            g.achievements[ach.id] = { unlockedAt: Date.now() };
            newUnlocks.push(ach);
            log('Achievement unlocked: ' + ach.id);
        }
    });
    
    if (newUnlocks.length > 0) {
        saveGamification();
        newUnlocks.forEach((ach, i) => {
            setTimeout(() => showAchievementUnlock(ach), i * 1500);
        });
    }
}

// Show achievement unlock notification
function showAchievementUnlock(ach) {
    showConfetti();
    
    const container = $('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast achievement-toast';
    toast.innerHTML = `
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
            <strong>הישג חדש!</strong>
            <span>${escapeHtml(ach.name)}</span>
        </div>
    `;
    container.appendChild(toast);
    
    // Award XP bonus
    if (ach.xpBonus) {
        setTimeout(() => {
            awardXP(ach.xpBonus, 'achievement: ' + ach.name);
        }, 500);
    }
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== STUDY TIMER ====================
function startStudyTimer() {
    if (state.studyTimer.active) return;
    
    state.studyTimer.active = true;
    state.studyTimer.startTime = Date.now();
    state.studyTimer.pausedTime = 0;
    log('Study timer started');
}

function pauseStudyTimer() {
    if (!state.studyTimer.active) return;
    
    const elapsed = Date.now() - state.studyTimer.startTime;
    state.studyTimer.pausedTime += elapsed;
    state.studyTimer.active = false;
    log('Study timer paused. Accumulated: ' + Math.round(state.studyTimer.pausedTime / 1000) + 's');
}

function resumeStudyTimer() {
    if (state.studyTimer.active) return;
    
    state.studyTimer.active = true;
    state.studyTimer.startTime = Date.now();
    log('Study timer resumed');
}

function stopStudyTimer() {
    if (state.studyTimer.active) {
        state.studyTimer.pausedTime += Date.now() - state.studyTimer.startTime;
    }
    
    const totalSeconds = Math.floor(state.studyTimer.pausedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    
    if (minutes > 0) {
        state.gamification.totalStudyMinutes += minutes;
        state.gamification.todayStudyMinutes += minutes;
        log('Added ' + minutes + ' minutes to study time. Total: ' + state.gamification.totalStudyMinutes);
        saveGamification();
        checkAchievements();
    }
    
    state.studyTimer.active = false;
    state.studyTimer.startTime = null;
    state.studyTimer.pausedTime = 0;
}

function handleVisibilityChange() {
    if (state.currentScreen === 'quizScreen') {
        if (document.hidden) {
            pauseStudyTimer();
        } else {
            resumeStudyTimer();
        }
    }
}

// Export
window.getLevel = getLevel;
window.getXPToNextLevel = getXPToNextLevel;
window.getLevelProgress = getLevelProgress;
window.updateDailyStreak = updateDailyStreak;
window.recordStudyDay = recordStudyDay;
window.awardXP = awardXP;
window.recordAnswer = recordAnswer;
window.resetSessionStreak = resetSessionStreak;
window.recordExamScore = recordExamScore;
window.recordTopicCompletion = recordTopicCompletion;
window.checkAchievements = checkAchievements;
window.showAchievementUnlock = showAchievementUnlock;
window.startStudyTimer = startStudyTimer;
window.pauseStudyTimer = pauseStudyTimer;
window.resumeStudyTimer = resumeStudyTimer;
window.stopStudyTimer = stopStudyTimer;
window.handleVisibilityChange = handleVisibilityChange;
