/**
 * SkyMind Quiz Module v3.2.0
 * Quiz logic with topic modes and infinite mode support
 */

// ==================== SMART TUTOR ====================
function showSmartTutorScreen() {
    updateSmartTutorPreview();
    showScreen('smartTutorScreen');
}

function updateSmartTutorPreview() {
    const preview = getSessionPreview(state.settings.questionsPerSession, state.settings.qseProfile);
    
    const mixDue = $('mixDue');
    const mixWeak = $('mixWeak');
    const mixNew = $('mixNew');
    const mixTotal = $('mixTotal');
    const profileName = $('profileName');
    const profileDesc = $('profileDesc');
    
    if (mixDue) mixDue.textContent = preview.due;
    if (mixWeak) mixWeak.textContent = preview.weak;
    if (mixNew) mixNew.textContent = preview.new;
    if (mixTotal) mixTotal.textContent = preview.total;
    if (profileName) profileName.textContent = preview.profileName;
    if (profileDesc) profileDesc.textContent = preview.profileDesc;
    
    // Update profile selector
    const profileSelector = $('qseProfileSelector');
    if (profileSelector) {
        profileSelector.value = state.settings.qseProfile || 'balanced';
    }
}

function changeQSEProfile(profileKey) {
    state.settings.qseProfile = profileKey;
    saveSettings();
    updateSmartTutorPreview();
}

function startSmartTutor() {
    const questions = selectSmartQuestions(state.settings.questionsPerSession, state.settings.qseProfile);
    
    if (questions.length === 0) {
        showToast('אין שאלות זמינות', 'warning');
        return;
    }
    
    resetSessionStreak();
    
    state.quiz = {
        mode: 'smart',
        focusMode: state.settings.qseProfile,
        questions: questions,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: null,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
}

// ==================== TOPIC MODE SELECTION ====================
let selectedTopicForMode = { topic: null, subTopic: null };


function getQuestionsForTopicFilter(topic, subTopic = null) {
    const all = state.questionsByTopic[topic] || [];
    if (!subTopic) return all;
    return all.filter(q => (q.subTopic || 'other') === subTopic);
}

function showTopicModeSelection(topic, subTopic = null) {
    selectedTopicForMode = { topic, subTopic };

    const meta = state.topicsMeta || {};
    const mainLabel = (meta.mainLabels && meta.mainLabels[topic]) ? meta.mainLabels[topic] : topic;
    const subLabel = subTopic && meta.subLabels && meta.subLabels[topic] && meta.subLabels[topic][subTopic]
        ? meta.subLabels[topic][subTopic]
        : (subTopic || null);

    const filtered = getQuestionsForTopicFilter(topic, subTopic);
    const total = filtered.length;
    const answered = filtered.filter(q => state.progress[q.id] && state.progress[q.id].attempts > 0).length;
    const correct = filtered.reduce((sum, q) => {
        const p = state.progress[q.id];
        return sum + (p ? p.correctCount : 0);
    }, 0);
    const attempts = filtered.reduce((sum, q) => {
        const p = state.progress[q.id];
        return sum + (p ? p.attempts : 0);
    }, 0);
    const accuracy = attempts > 0 ? Math.round(correct / attempts * 100) : 0;
    const coverage = total > 0 ? Math.round(answered / total * 100) : 0;

    const weak = getWeakQuestions(topic, subTopic).length;

    const topicNameEl = $('modeTopicName');
    const topicStatsEl = $('modeTopicStats');

    if (topicNameEl) {
        topicNameEl.textContent = subLabel ? `${mainLabel} • ${subLabel}` : mainLabel;
    }
    if (topicStatsEl) {
        topicStatsEl.innerHTML = `
            <span>סה"כ: ${total}</span>
            <span>דיוק: ${accuracy}%</span>
            <span>כיסוי: ${coverage}%</span>
            <span>חלשות: ${weak}</span>
        `;
    }

    if (total === 0) {
        showToast('אין שאלות בתת־נושא הזה', 'warning');
        return;
    }

    showModal('topicModeModal');
}

function startTopicMode(mode) {
    hideModal('topicModeModal');
    
    const topic = selectedTopicForMode.topic;
    const subTopic = selectedTopicForMode.subTopic;
    if (!topic) return;
    
    const questions = getQuestionsForTopicFilter(topic, subTopic);
    if (!questions || questions.length === 0) {
        showToast('אין שאלות בנושא זה', 'warning');
        return;
    }
    
    resetSessionStreak();
    
    switch (mode) {
        case 'normal':
            startTopicPractice(topic, subTopic);
            break;
        case 'failed':
            startTopicFailedMode(topic, subTopic);
            break;
        case 'mastered':
            startTopicMasteredMode(topic, subTopic);
            break;
        case 'infinite':
            startTopicInfiniteMode(topic, subTopic);
            break;
    }
}

// ==================== TOPIC PRACTICE ====================
function startTopicPractice(topic, subTopic = null) {
    const questions = getQuestionsForTopicFilter(topic, subTopic);
    
    if (!questions || questions.length === 0) {
        showToast('אין שאלות בנושא זה', 'warning');
        return;
    }
    
    const count = Math.min(questions.length, state.settings.questionsPerSession);
    const selected = shuffleArray(questions).slice(0, count);
    
    state.quiz = {
        mode: 'topic',
        focusMode: null,
        questions: selected,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: topic,
        subTopicFilter: subTopic,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
}

function startTopicFailedMode(topic, subTopic = null) {
    const questions = selectTopicFailedQuestions(topic, subTopic, state.settings.questionsPerSession);
    
    if (questions.length === 0) {
        return;
    }
    
    state.quiz = {
        mode: 'topic_failed',
        focusMode: null,
        questions: questions,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: topic,
        subTopicFilter: subTopic,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
}

function startTopicMasteredMode(topic, subTopic = null) {
    const questions = selectTopicMasteredQuestions(topic, subTopic, state.settings.questionsPerSession);
    
    if (questions.length === 0) {
        return;
    }
    
    state.quiz = {
        mode: 'topic_mastered',
        focusMode: null,
        questions: questions,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: topic,
        subTopicFilter: subTopic,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
}

function startTopicInfiniteMode(topic, subTopic = null) {
    const infiniteState = createInfiniteState(topic, subTopic);
    
    if (!infiniteState) {
        showToast('אין שאלות בנושא זה', 'warning');
        return;
    }
    
    state.quiz = {
        mode: 'topic_infinite',
        focusMode: null,
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: topic,
        subTopicFilter: subTopic,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: infiniteState
    };
    
    showQuiz();
    displayInfiniteQuestion();
}

// ==================== EXAM MODE ====================
function startExam() {
    const examQuestions = state.settings.examQuestions;
    const examTime = state.settings.examTime;
    
    if (state.questions.length < examQuestions) {
        showToast('אין מספיק שאלות למבחן', 'warning');
        return;
    }
    
    const selected = shuffleArray(state.questions).slice(0, examQuestions);
    
    resetSessionStreak();
    
    state.quiz = {
        mode: 'exam',
        focusMode: null,
        questions: selected,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: null,
        timer: null,
        timeRemaining: examTime * 60,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
    startExamTimer();
}

function startExamTimer() {
    const timerEl = $('quizTimer');
    if (timerEl) {
        timerEl.classList.remove('hidden');
        timerEl.textContent = formatTime(state.quiz.timeRemaining);
    }
    
    state.quiz.timer = setInterval(() => {
        state.quiz.timeRemaining--;
        
        if (timerEl) {
            timerEl.textContent = formatTime(state.quiz.timeRemaining);
            
            if (state.quiz.timeRemaining <= 60) {
                timerEl.style.color = 'var(--error)';
            } else if (state.quiz.timeRemaining <= 300) {
                timerEl.style.color = 'var(--warning)';
            }
        }
        
        if (state.quiz.timeRemaining <= 0) {
            finishQuiz();
        }
    }, 1000);
}

function stopExamTimer() {
    if (state.quiz.timer) {
        clearInterval(state.quiz.timer);
        state.quiz.timer = null;
    }
    
    const timerEl = $('quizTimer');
    if (timerEl) {
        timerEl.classList.add('hidden');
        timerEl.style.color = '';
    }
}

// ==================== REVIEW MISTAKES ====================
function startReviewMistakes() {
    const mistakes = state.quiz.answers
        .filter(a => !a.correct)
        .map(a => state.questionsById[a.questionId])
        .filter(q => q);
    
    if (mistakes.length === 0) {
        showToast('אין טעויות לסקור', 'info');
        return;
    }
    
    state.quiz = {
        mode: 'review',
        focusMode: null,
        questions: mistakes,
        currentIndex: 0,
        score: 0,
        answers: [],
        topicFilter: null,
        timer: null,
        timeRemaining: 0,
        answered: false,
        xpEarned: 0,
        infiniteState: null
    };
    
    showQuiz();
}

// ==================== QUIZ UI ====================
function showQuiz() {
    showScreen('quizScreen');
    
    if (state.quiz.mode === 'topic_infinite') {
        displayInfiniteQuestion();
    } else {
        displayQuestion();
    }
}

function displayQuestion() {
    const quiz = state.quiz;
    const question = quiz.questions[quiz.currentIndex];
    
    if (!question) {
        finishQuiz();
        return;
    }
    
    quiz.answered = false;
    
    const progressFill = $('progressFill');
    if (progressFill) {
        const progress = ((quiz.currentIndex) / quiz.questions.length) * 100;
        progressFill.style.width = progress + '%';
    }
    
    const questionCounter = $('questionCounter');
    if (questionCounter) {
        questionCounter.textContent = (quiz.currentIndex + 1) + ' / ' + quiz.questions.length;
    }
    
    const scoreDisplay = $('scoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.textContent = quiz.score + ' נכון';
    }
    
    renderQuestionContent(question);
}

function displayInfiniteQuestion() {
    const quiz = state.quiz;
    const inf = quiz.infiniteState;
    
    if (isInfiniteModeComplete()) {
        finishInfiniteMode();
        return;
    }
    
    const result = getNextInfiniteQuestion();
    if (!result || !result.question) {
        finishInfiniteMode();
        return;
    }
    
    quiz.answered = false;
    quiz.currentQuestion = result.question;
    quiz.isAlertnessCheck = result.isAlertnessCheck;
    
    const progressFill = $('progressFill');
    if (progressFill) {
        const total = inf.activePool.length + inf.masteredPool.length + inf.wrongQueue.length;
        const mastered = inf.masteredPool.length;
        const progress = total > 0 ? (mastered / total) * 100 : 0;
        progressFill.style.width = progress + '%';
    }
    
    const questionCounter = $('questionCounter');
    if (questionCounter) {
        const remaining = inf.activePool.length + inf.wrongQueue.length;
        questionCounter.textContent = `נותרו ${remaining} | שולטים ${inf.masteredPool.length}`;
    }
    
    const scoreDisplay = $('scoreDisplay');
    if (scoreDisplay) {
        const accuracy = inf.questionsAnswered > 0 
            ? Math.round((inf.correctCount / inf.questionsAnswered) * 100) 
            : 0;
        scoreDisplay.textContent = accuracy + '% דיוק';
    }
    
    const alertnessIndicator = $('alertnessIndicator');
    if (alertnessIndicator) {
        alertnessIndicator.classList.toggle('hidden', !result.isAlertnessCheck);
    }
    
    renderQuestionContent(result.question);
}

function renderQuestionContent(question) {
    const questionTopic = $('questionTopic');
    if (questionTopic) {
        questionTopic.textContent = question.mainTopic;
    }
    
    const questionId = $('questionId');
    if (questionId && state.cmsUnlocked) {
        questionId.textContent = '#' + question.id.slice(-8);
    } else if (questionId) {
        questionId.textContent = '';
    }
    
    const questionText = $('questionText');
    if (questionText) {
        questionText.textContent = question.questionText;
    }
    
    const choicesList = $('choicesList');
    if (choicesList) {
        choicesList.innerHTML = question.choices.map((choice, index) => `
            <button class="choice-btn" data-index="${index}">
                ${escapeHtml(choice)}
            </button>
        `).join('');
    }
    
    const explanationCard = $('explanationCard');
    if (explanationCard) {
        explanationCard.classList.add('hidden');
    }
    
    const nextBtn = $('nextBtn');
    const finishBtn = $('finishBtn');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (finishBtn) finishBtn.classList.add('hidden');
}

function handleAnswer(selectedIndex) {
    const quiz = state.quiz;
    
    if (quiz.answered) return;
    quiz.answered = true;
    
    const question = quiz.mode === 'topic_infinite' 
        ? quiz.currentQuestion 
        : quiz.questions[quiz.currentIndex];
    
    if (!question) return;
    
    const correct = selectedIndex === question.correctIndex;
    
    quiz.answers.push({
        questionId: question.id,
        selectedIndex: selectedIndex,
        correctIndex: question.correctIndex,
        correct: correct
    });
    
    if (correct) {
        quiz.score++;
    }
    
    if (quiz.mode !== 'exam') {
        updateSpacedRepetition(question.id, correct);
        const xp = recordAnswer(correct);
        quiz.xpEarned += xp;
    }
    
    if (quiz.mode === 'topic_infinite') {
        processInfiniteAnswer(question.id, correct, quiz.isAlertnessCheck);
    }
    
    const choices = document.querySelectorAll('.choice-btn');
    choices.forEach((btn, index) => {
        btn.classList.add('disabled');
        if (index === question.correctIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && !correct) {
            btn.classList.add('incorrect');
        }
    });
    
    if (state.settings.showExplanation && question.explanation) {
        const explanationCard = $('explanationCard');
        const explanationText = $('explanationText');
        
        if (explanationCard && explanationText) {
            explanationText.textContent = question.explanation;
            explanationCard.classList.remove('hidden');
        }
    }
    
    if (quiz.mode === 'topic_infinite') {
        const nextBtn = $('nextBtn');
        if (nextBtn) nextBtn.classList.remove('hidden');
    } else {
        const isLast = quiz.currentIndex === quiz.questions.length - 1;
        const nextBtn = $('nextBtn');
        const finishBtn = $('finishBtn');
        
        if (isLast) {
            if (finishBtn) finishBtn.classList.remove('hidden');
        } else {
            if (nextBtn) nextBtn.classList.remove('hidden');
        }
    }
}

function nextQuestion() {
    if (state.quiz.mode === 'topic_infinite') {
        displayInfiniteQuestion();
    } else {
        state.quiz.currentIndex++;
        displayQuestion();
    }
}

function finishQuiz() {
    stopExamTimer();
    
    const quiz = state.quiz;
    
    if (quiz.mode === 'exam') {
        quiz.answers.forEach(a => {
            updateSpacedRepetition(a.questionId, a.correct);
            const xp = recordAnswer(a.correct);
            quiz.xpEarned += xp;
        });
        
        recordExamScore(quiz.score, quiz.questions.length);
    }
    
    showResults();
}

function finishInfiniteMode() {
    stopExamTimer();
    
    const quiz = state.quiz;
    const inf = quiz.infiniteState;
    
    if (inf && inf.topic) {
        recordTopicCompletion(inf.topic);
    }
    
    showInfiniteResults();
}

// ==================== RESULTS ====================
function showResults() {
    showScreen('resultsScreen');
    
    const quiz = state.quiz;
    const total = quiz.questions.length;
    const score = quiz.score;
    const percentage = total > 0 ? Math.round(score / total * 100) : 0;
    
    const resultsIcon = $('resultsIcon');
    if (resultsIcon) {
        if (percentage >= 90) resultsIcon.textContent = '🏆';
        else if (percentage >= 70) resultsIcon.textContent = '🌟';
        else if (percentage >= 50) resultsIcon.textContent = '👍';
        else resultsIcon.textContent = '💪';
    }
    
    const resultsPercent = $('resultsPercent');
    const resultsText = $('resultsText');
    
    if (resultsPercent) resultsPercent.textContent = percentage + '%';
    if (resultsText) resultsText.textContent = score + ' מתוך ' + total;
    
    const xpEarned = $('xpEarned');
    if (xpEarned) {
        xpEarned.textContent = '+' + quiz.xpEarned + ' XP';
    }
    
    renderResultsBreakdown();
    
    const reviewBtn = $('reviewMistakesBtn');
    if (reviewBtn) {
        const hasMistakes = quiz.answers.some(a => !a.correct);
        reviewBtn.classList.toggle('hidden', !hasMistakes);
    }
    
    if (percentage >= 80) {
        showConfetti();
    }
}

function showInfiniteResults() {
    showScreen('resultsScreen');
    
    const quiz = state.quiz;
    const inf = quiz.infiniteState;
    
    const resultsIcon = $('resultsIcon');
    if (resultsIcon) {
        resultsIcon.textContent = '✨';
    }
    
    const resultsPercent = $('resultsPercent');
    const resultsText = $('resultsText');
    
    if (resultsPercent) resultsPercent.textContent = '🎉';
    if (resultsText) {
        resultsText.textContent = `סיימת את הנושא: ${inf.topic}`;
    }
    
    const xpEarned = $('xpEarned');
    if (xpEarned) {
        xpEarned.textContent = '+' + quiz.xpEarned + ' XP';
    }
    
    const resultsBreakdown = $('resultsBreakdown');
    if (resultsBreakdown) {
        const accuracy = inf.questionsAnswered > 0 
            ? Math.round((inf.correctCount / inf.questionsAnswered) * 100) 
            : 0;
        
        resultsBreakdown.innerHTML = `
            <div class="breakdown-item">
                <span class="breakdown-topic">שאלות שנענו</span>
                <span class="breakdown-score">${inf.questionsAnswered}</span>
            </div>
            <div class="breakdown-item">
                <span class="breakdown-topic">תשובות נכונות</span>
                <span class="breakdown-score">${inf.correctCount}</span>
            </div>
            <div class="breakdown-item">
                <span class="breakdown-topic">דיוק</span>
                <span class="breakdown-score">${accuracy}%</span>
            </div>
            <div class="breakdown-item">
                <span class="breakdown-topic">שאלות שנשלטו</span>
                <span class="breakdown-score">${inf.masteredPool.length}</span>
            </div>
        `;
    }
    
    const reviewBtn = $('reviewMistakesBtn');
    if (reviewBtn) reviewBtn.classList.add('hidden');
    
    showConfetti();
}

function renderResultsBreakdown() {
    const quiz = state.quiz;
    const breakdown = {};
    
    quiz.answers.forEach(a => {
        const q = state.questionsById[a.questionId];
        if (!q) return;
        
        const topic = q.mainTopic;
        if (!breakdown[topic]) {
            breakdown[topic] = { correct: 0, total: 0 };
        }
        breakdown[topic].total++;
        if (a.correct) breakdown[topic].correct++;
    });
    
    const resultsBreakdown = $('resultsBreakdown');
    if (resultsBreakdown) {
        resultsBreakdown.innerHTML = Object.entries(breakdown).map(([topic, stats]) => {
            const pct = Math.round(stats.correct / stats.total * 100);
            return `
                <div class="breakdown-item">
                    <span class="breakdown-topic">${escapeHtml(topic)}</span>
                    <span class="breakdown-score">${stats.correct}/${stats.total}</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function retryQuiz() {
    const quiz = state.quiz;
    
    if (quiz.mode === 'smart') {
        startSmartTutor();
    } else if (quiz.mode === 'topic' && quiz.topicFilter) {
        startTopicPractice(quiz.topicFilter);
    } else if (quiz.mode === 'topic_failed' && quiz.topicFilter) {
        startTopicFailedMode(quiz.topicFilter);
    } else if (quiz.mode === 'topic_mastered' && quiz.topicFilter) {
        startTopicMasteredMode(quiz.topicFilter);
    } else if (quiz.mode === 'topic_infinite' && quiz.topicFilter) {
        startTopicInfiniteMode(quiz.topicFilter);
    } else if (quiz.mode === 'exam') {
        startExam();
    } else {
        goHome();
    }
}

// Export
window.showSmartTutorScreen = showSmartTutorScreen;
window.updateSmartTutorPreview = updateSmartTutorPreview;
window.changeQSEProfile = changeQSEProfile;
window.startSmartTutor = startSmartTutor;
window.showTopicModeSelection = showTopicModeSelection;
window.startTopicMode = startTopicMode;
window.startTopicPractice = startTopicPractice;
window.startTopicFailedMode = startTopicFailedMode;
window.startTopicMasteredMode = startTopicMasteredMode;
window.startTopicInfiniteMode = startTopicInfiniteMode;
window.startExam = startExam;
window.startReviewMistakes = startReviewMistakes;
window.displayQuestion = displayQuestion;
window.displayInfiniteQuestion = displayInfiniteQuestion;
window.handleAnswer = handleAnswer;
window.nextQuestion = nextQuestion;
window.finishQuiz = finishQuiz;
window.finishInfiniteMode = finishInfiniteMode;
window.showResults = showResults;
window.retryQuiz = retryQuiz;
