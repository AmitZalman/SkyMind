/**
 * SkyMind Spaced Repetition Module v3.2.0
 * SM-2 based algorithm with QSE profiles support
 */

// Get or create progress for a question
function getQuestionProgress(id) {
    if (!state.progress[id]) {
        state.progress[id] = {
            attempts: 0,
            correctCount: 0,
            wrongCount: 0,
            wrongStreak: 0,
            correctStreak: 0,
            lastSeen: null,
            nextDue: null,
            ease: CONFIG.SR.INITIAL_EASE,
            interval: CONFIG.SR.INITIAL_INTERVAL
        };
    }
    return state.progress[id];
}

// Update spaced repetition after answering
function updateSpacedRepetition(id, correct) {
    const p = getQuestionProgress(id);
    const now = Date.now();
    
    p.attempts++;
    p.lastSeen = now;
    
    if (correct) {
        p.correctCount++;
        p.wrongStreak = 0;
        p.correctStreak = (p.correctStreak || 0) + 1;
        
        // Increase interval using ease factor
        p.interval = Math.min(Math.round(p.interval * p.ease), 180);
        
        // Increase ease
        p.ease = Math.min(p.ease + 0.1, CONFIG.SR.MAX_EASE);
    } else {
        p.wrongCount++;
        p.wrongStreak = (p.wrongStreak || 0) + 1;
        p.correctStreak = 0;
        
        // Reset interval
        p.interval = 1;
        
        // Decrease ease
        p.ease = Math.max(p.ease - CONFIG.SR.AGAIN_PENALTY, CONFIG.SR.MIN_EASE);
    }
    
    // Set next due date
    p.nextDue = now + p.interval * 86400000;
    
    saveProgress();
}

// Get questions due for review
function getDueQuestions(topic = null) {
    const now = Date.now();
    let questions = topic ? (state.questionsByTopic[topic] || []) : state.questions;
    
    return questions.filter(q => {
        const p = state.progress[q.id];
        return p && p.nextDue && p.nextDue <= now;
    });
}

// Get questions never attempted
function getNewQuestions(topic = null) {
    let questions = topic ? (state.questionsByTopic[topic] || []) : state.questions;
    
    return questions.filter(q => {
        const p = state.progress[q.id];
        return !p || !p.attempts;
    });
}

// Get weak questions (high error rate or wrong streak)
function getWeakQuestions(topic = null, subTopic = null) {
    let questions = topic ? (state.questionsByTopic[topic] || []) : state.questions;
    if (topic && subTopic) {
        questions = questions.filter(q => (q.subTopic || 'other') === subTopic);
    }
    return questions
        .filter(q => {
            const p = state.progress[q.id];
            return p && p.attempts > 0;
        })
        .map(q => {
            const p = state.progress[q.id];
            const errorRate = 1 - (p.correctCount / p.attempts);
            const score = errorRate * 10 + (p.wrongStreak || 0) * 3;
            return { q, score };
        })
        .sort((a, b) => b.score - a.score)
        .filter(x => x.score > 2) // Only actually weak ones
        .map(x => x.q);
}

// Get mastered questions
function getMasteredQuestions(topic = null, subTopic = null) {
    let questions = topic ? (state.questionsByTopic[topic] || []) : state.questions;
    if (topic && subTopic) {
        questions = questions.filter(q => (q.subTopic || 'other') === subTopic);
    }
    const criteria = state.settings.masteryCriteria || MASTERY_CRITERIA;
    
    return questions.filter(q => isQuestionMastered(q.id, criteria));
}

// Check if a question is mastered
function isQuestionMastered(questionId, criteria) {
    criteria = criteria || state.settings.masteryCriteria || MASTERY_CRITERIA;
    const p = state.progress[questionId];
    
    if (!p || !p.attempts) return false;
    
    // Mastered if correct streak meets criteria
    if ((p.correctStreak || 0) >= criteria.minCorrectStreak) {
        return true;
    }
    
    // Or if accuracy is high enough with enough attempts
    if (p.attempts >= criteria.minAttempts) {
        const accuracy = p.correctCount / p.attempts;
        if (accuracy >= criteria.minAccuracy) {
            return true;
        }
    }
    
    return false;
}

// QSE-based smart question selection
function selectSmartQuestions(count, profileKey) {
    profileKey = profileKey || state.settings.qseProfile || 'balanced';
    const profile = QSE_PROFILES[profileKey] || QSE_PROFILES.balanced;
    const weights = profile.weights;
    
    const selected = [];
    const used = new Set();
    
    // Get question pools
    const duePoll = getDueQuestions();
    const weakPool = getWeakQuestions();
    const newPool = getNewQuestions();
    const allPool = state.questions;
    
    // Calculate target counts based on weights
    const targets = {
        due: Math.ceil(count * weights.due),
        weak: Math.ceil(count * weights.weak),
        new: Math.ceil(count * weights.new),
        random: Math.ceil(count * weights.random)
    };
    
    // Helper to add from pool
    const addFromPool = (pool, maxCount) => {
        const shuffled = shuffleArray(pool);
        let added = 0;
        for (const q of shuffled) {
            if (selected.length >= count) break;
            if (used.has(q.id)) continue;
            
            // Topic balance: max 40% from same topic
            const topicCount = selected.filter(s => s.mainTopic === q.mainTopic).length;
            if (topicCount >= Math.ceil(count * 0.4)) continue;
            
            selected.push(q);
            used.add(q.id);
            added++;
            if (added >= maxCount) break;
        }
    };
    
    // Add questions in priority order
    addFromPool(duePoll, targets.due);
    addFromPool(weakPool.filter(q => !used.has(q.id)), targets.weak);
    addFromPool(newPool, targets.new);
    addFromPool(allPool.filter(q => !used.has(q.id)), count - selected.length);
    
    return shuffleArray(selected.slice(0, count));
}

// Select questions for topic mode: failed/weak only
function selectTopicFailedQuestions(topic, subTopic, count) {
    const weak = getWeakQuestions(topic, subTopic);
    
    if (weak.length === 0) {
        showToast('אין שאלות חלשות בנושא זה!', 'success');
        return [];
    }
    
    return shuffleArray(weak).slice(0, count);
}

// Select questions for topic mode: mastered only
function selectTopicMasteredQuestions(topic, subTopic, count) {
    const mastered = getMasteredQuestions(topic, subTopic);
    
    if (mastered.length === 0) {
        showToast('אין שאלות ששלטת בהן בנושא זה', 'info');
        return [];
    }
    
    return shuffleArray(mastered).slice(0, count);
}

// Get session preview counts
function getSessionPreview(sessionSize, profileKey) {
    profileKey = profileKey || state.settings.qseProfile || 'balanced';
    const profile = QSE_PROFILES[profileKey] || QSE_PROFILES.balanced;
    
    const dueQuestions = getDueQuestions();
    const weakQuestions = getWeakQuestions();
    const newQuestions = getNewQuestions();
    
    return {
        due: dueQuestions.length,
        weak: weakQuestions.length,
        new: newQuestions.length,
        total: state.questions.length,
        profileName: profile.name,
        profileDesc: profile.description
    };
}

// Get topics statistics
function getTopicsStats() {
    const topics = {};
    
    state.questions.forEach(q => {
        const name = q.mainTopic || 'כללי';
        if (!topics[name]) {
            topics[name] = {
                name: name,
                total: 0,
                answered: 0,
                correct: 0,
                attempts: 0,
                mastered: 0,
                weak: 0,
                due: 0
            };
        }
        
        topics[name].total++;
        
        const p = state.progress[q.id];
        if (p && p.attempts > 0) {
            topics[name].answered++;
            topics[name].correct += p.correctCount;
            topics[name].attempts += p.attempts;
            
            if (isQuestionMastered(q.id)) {
                topics[name].mastered++;
            }
            
            const errorRate = 1 - (p.correctCount / p.attempts);
            if (errorRate > 0.3) {
                topics[name].weak++;
            }
            
            if (p.nextDue && p.nextDue <= Date.now()) {
                topics[name].due++;
            }
        }
    });
    
    return Object.values(topics).map(t => ({
        ...t,
        accuracy: t.attempts > 0 ? Math.round(t.correct / t.attempts * 100) : 0,
        coverage: Math.round(t.answered / t.total * 100),
        masteryPercent: Math.round(t.mastered / t.total * 100)
    })).sort((a, b) => b.total - a.total);
}

// Get weak topics
function getWeakTopics(n = 3) {
    return getTopicsStats()
        .filter(t => t.attempts >= 5)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, n);
}

// Get best topics
function getBestTopics(n = 3) {
    return getTopicsStats()
        .filter(t => t.attempts >= 5)
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, n);
}

// Check if topic is mastered
function isTopicMastered(topic) {
    const questions = state.questionsByTopic[topic];
    if (!questions || questions.length < 5) return false;
    
    const stats = getTopicsStats().find(t => t.name === topic);
    return stats && stats.masteryPercent >= 80;
}

// ==================== INFINITE MODE ENGINE ====================

// Create infinite mode state
function createInfiniteState(topic, subTopic = null) {
    let questions = state.questionsByTopic[topic] || [];
    if (subTopic) {
        questions = questions.filter(q => (q.subTopic || 'other') === subTopic);
    }
    if (questions.length === 0) return null;
    
    const criteria = state.settings.masteryCriteria || MASTERY_CRITERIA;
    
    // Separate into mastered and active pools
    const masteredPool = [];
    const activePool = [];
    
    questions.forEach(q => {
        if (isQuestionMastered(q.id, criteria)) {
            masteredPool.push(q.id);
        } else {
            activePool.push(q.id);
        }
    });
    
    return {
        topic: topic,
        activePool: shuffleArray(activePool),
        masteredPool: masteredPool,
        wrongQueue: [],  // Questions to re-show soon
        currentIndex: 0,
        questionsAnswered: 0,
        correctCount: 0,
        criteria: criteria,
        lastAlertnessCheck: 0
    };
}

// Get next question in infinite mode
function getNextInfiniteQuestion() {
    const inf = state.quiz.infiniteState;
    if (!inf) return null;
    
    inf.questionsAnswered++;
    
    // Check if topic is complete
    if (inf.activePool.length === 0 && inf.wrongQueue.length === 0) {
        return null; // Topic complete!
    }
    
    // Alertness check: occasionally test a mastered question
    const criteria = inf.criteria;
    const shouldAlert = inf.masteredPool.length > 0 && (
        (inf.questionsAnswered - inf.lastAlertnessCheck) >= criteria.alertnessCheckInterval ||
        Math.random() < criteria.alertnessCheckProbability
    );
    
    if (shouldAlert) {
        inf.lastAlertnessCheck = inf.questionsAnswered;
        const randomIdx = Math.floor(Math.random() * inf.masteredPool.length);
        const questionId = inf.masteredPool[randomIdx];
        return {
            question: state.questionsById[questionId],
            isAlertnessCheck: true
        };
    }
    
    // Check wrong queue first
    if (inf.wrongQueue.length > 0 && inf.wrongQueue[0].delay <= 0) {
        const item = inf.wrongQueue.shift();
        return {
            question: state.questionsById[item.id],
            isAlertnessCheck: false
        };
    }
    
    // Decrement delays in wrong queue
    inf.wrongQueue.forEach(item => item.delay--);
    
    // Get from active pool
    if (inf.activePool.length > 0) {
        const questionId = inf.activePool[inf.currentIndex % inf.activePool.length];
        return {
            question: state.questionsById[questionId],
            isAlertnessCheck: false
        };
    }
    
    // Only wrong queue questions left
    if (inf.wrongQueue.length > 0) {
        // Force show the first one
        const item = inf.wrongQueue.shift();
        return {
            question: state.questionsById[item.id],
            isAlertnessCheck: false
        };
    }
    
    return null;
}

// Process answer in infinite mode
function processInfiniteAnswer(questionId, correct, isAlertnessCheck) {
    const inf = state.quiz.infiniteState;
    if (!inf) return;
    
    if (correct) {
        inf.correctCount++;
        
        if (isAlertnessCheck) {
            // Good - they still remember
        } else {
            // Check if now mastered
            if (isQuestionMastered(questionId, inf.criteria)) {
                // Move from active to mastered
                const idx = inf.activePool.indexOf(questionId);
                if (idx >= 0) {
                    inf.activePool.splice(idx, 1);
                    inf.masteredPool.push(questionId);
                }
            } else {
                // Move to end of active pool
                const idx = inf.activePool.indexOf(questionId);
                if (idx >= 0) {
                    inf.activePool.splice(idx, 1);
                    inf.activePool.push(questionId);
                }
            }
        }
    } else {
        if (isAlertnessCheck) {
            // Failed alertness check - move back to active
            const idx = inf.masteredPool.indexOf(questionId);
            if (idx >= 0) {
                inf.masteredPool.splice(idx, 1);
            }
            inf.activePool.push(questionId);
        } else {
            // Add to wrong queue with delay
            const criteria = inf.criteria;
            inf.wrongQueue.push({
                id: questionId,
                delay: criteria.wrongReinjectDelay
            });
        }
    }
    
    inf.currentIndex++;
}

// Check if infinite mode is complete
function isInfiniteModeComplete() {
    const inf = state.quiz.infiniteState;
    if (!inf) return true;
    
    return inf.activePool.length === 0 && inf.wrongQueue.length === 0;
}

// Export
window.getQuestionProgress = getQuestionProgress;
window.updateSpacedRepetition = updateSpacedRepetition;
window.getDueQuestions = getDueQuestions;
window.getNewQuestions = getNewQuestions;
window.getWeakQuestions = getWeakQuestions;
window.getMasteredQuestions = getMasteredQuestions;
window.isQuestionMastered = isQuestionMastered;
window.selectSmartQuestions = selectSmartQuestions;
window.selectTopicFailedQuestions = selectTopicFailedQuestions;
window.selectTopicMasteredQuestions = selectTopicMasteredQuestions;
window.getSessionPreview = getSessionPreview;
window.getTopicsStats = getTopicsStats;
window.getWeakTopics = getWeakTopics;
window.getBestTopics = getBestTopics;
window.isTopicMastered = isTopicMastered;
window.createInfiniteState = createInfiniteState;
window.getNextInfiniteQuestion = getNextInfiniteQuestion;
window.processInfiniteAnswer = processInfiniteAnswer;
window.isInfiniteModeComplete = isInfiniteModeComplete;
