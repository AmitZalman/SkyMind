/**
 * SkyMind CMS Module v3.0.0
 * Content Studio - Question and Topic Management
 */

// ==================== QA VALIDATION ====================
function validateQuestion(q) {
    const issues = [];
    if (q.correctIndex === null || q.correctIndex === undefined) issues.push('missing_correct');
    if (q.choices.length !== 4) issues.push('options_not_4');
    if (!q.questionText || q.questionText.trim().length < 10) issues.push('short_text');
    if (q.needsReview) issues.push('needs_review');
    return issues;
}

function findDuplicateIds(questions) {
    var groups = {};
    for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var key = (q.mainTopic || '') + '|' + (q.subTopic || '');
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
    }
    var dupes = new Set();
    for (var k in groups) {
        var arr = groups[k];
        var seen = {};
        for (var j = 0; j < arr.length; j++) {
            var text = arr[j].questionText.trim().toLowerCase();
            if (seen[text]) {
                dupes.add(arr[j].id);
                dupes.add(seen[text]);
            } else {
                seen[text] = arr[j].id;
            }
        }
    }
    return dupes;
}

function isInvalid(qId) {
    return !!(state.invalidQuestions && state.invalidQuestions[qId] && state.invalidQuestions[qId].invalid);
}

// ==================== CMS VIEW ====================
function updateCMSView() {
    if (!state.cmsUnlocked) return;
    
    const cmsQuestionCount = $('cmsQuestionCount');
    if (cmsQuestionCount) {
        cmsQuestionCount.textContent = state.questions.length + ' שאלות';
    }
    
    updateCMSTopicFilter();
    updateCMSSubtopicFilter();

    const activeTab = state.cms.currentTab;
    switch (activeTab) {
        case 'questions':
            updateCMSQuestionsList();
            break;
        case 'topics':
            updateCMSTopicsList();
            break;
        case 'review':
            updateCMSReviewList();
            break;
    }
}

// ==================== TABS ====================
function switchCMSTab(tab) {
    state.cms.currentTab = tab;
    state.cms.page = 1;
    
    const tabs = document.querySelectorAll('.cms-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    
    const contents = document.querySelectorAll('.cms-tab-content');
    contents.forEach(c => {
        const tabName = 'cms' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab';
        c.classList.toggle('active', c.id === tabName);
    });
    
    updateCMSView();
}

// ==================== QUESTIONS LIST ====================
function updateCMSTopicFilter() {
    const select = $('cmsTopicFilter');
    if (!select) return;
    
    const topics = Object.keys(state.questionsByTopic).sort();
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">כל הנושאים</option>' +
        topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${state.questionsByTopic[t].length})</option>`).join('');
    
    select.value = currentValue;
    
    const datalist = $('mainTopicsList');
    if (datalist) {
        datalist.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">`).join('');
    }
}

function updateCMSSubtopicFilter() {
    var topicSelect = $('cmsTopicFilter');
    var subSelect = $('cmsSubtopicFilter');
    if (!subSelect) return;

    var topic = topicSelect ? topicSelect.value : '';
    if (!topic) {
        subSelect.innerHTML = '<option value="">כל תתי-הנושאים</option>';
        subSelect.disabled = true;
        return;
    }

    var meta = state.topicsMeta || {};
    var labels = (meta.subLabels && meta.subLabels[topic]) || {};
    var order = (meta.subOrder && meta.subOrder[topic]) || Object.keys(labels);

    subSelect.innerHTML = '<option value="">כל תתי-הנושאים</option>' +
        order.map(function(key) { return '<option value="' + escapeHtml(key) + '">' + escapeHtml(labels[key] || key) + '</option>'; }).join('');
    subSelect.disabled = false;
}

function updateCMSQuestionsList() {
    const container = $('cmsQuestionsList');
    const pagination = $('cmsPagination');
    const filteredCount = $('cmsFilteredCount');
    
    if (!container) return;
    
    let filtered = state.questions.slice();

    // 1. Topic filter
    const topicFilter = $('cmsTopicFilter');
    if (topicFilter && topicFilter.value) {
        filtered = filtered.filter(q => q.mainTopic === topicFilter.value);
    }

    // 2. Subtopic filter
    const subtopicFilter = $('cmsSubtopicFilter');
    if (subtopicFilter && subtopicFilter.value) {
        filtered = filtered.filter(q => (q.subTopic || '') === subtopicFilter.value);
    }

    // 3. QA filter chips (OR logic: show question if it matches ANY active chip)
    const activeQA = Array.from(document.querySelectorAll('.cms-qa-chip.active')).map(function(c) { return c.dataset.qa; });
    if (activeQA.length > 0) {
        var duplicateIds = null;
        if (activeQA.indexOf('duplicates') >= 0) {
            duplicateIds = findDuplicateIds(filtered);
        }
        filtered = filtered.filter(function(q) {
            var issues = validateQuestion(q);
            for (var i = 0; i < activeQA.length; i++) {
                var qa = activeQA[i];
                if (qa === 'invalid' && isInvalid(q.id)) return true;
                if (qa === 'duplicates' && duplicateIds && duplicateIds.has(q.id)) return true;
                if (issues.indexOf(qa) >= 0) return true;
            }
            return false;
        });
    }

    // 4. Search (applied last, after all filters)
    const searchFilter = $('cmsSearch');
    if (searchFilter && searchFilter.value) {
        const query = searchFilter.value.toLowerCase();
        filtered = filtered.filter(q =>
            q.questionText.toLowerCase().includes(query) ||
            q.id.toLowerCase().includes(query)
        );
    }

    // Summary line
    if (filteredCount) {
        filteredCount.textContent = filtered.length + ' מתוך ' + state.questions.length + ' שאלות';
    }
    var invalidCount = filtered.filter(function(q) { return isInvalid(q.id); }).length;
    var invalidEl = $('cmsInvalidCount');
    if (invalidEl) {
        invalidEl.textContent = invalidCount > 0 ? ('לא תקינות: ' + invalidCount) : '';
    }
    
    const pageSize = CONFIG.CMS_PAGE_SIZE;
    const totalPages = Math.ceil(filtered.length / pageSize);
    const page = Math.min(state.cms.page, totalPages) || 1;
    state.cms.page = page;
    
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    
    // Track visible IDs for select-all
    state.cms._visibleIds = filtered.map(q => q.id);

    container.innerHTML = pageItems.map(q => {
        const badges = [];
        const issues = validateQuestion(q);
        const qInvalid = isInvalid(q.id);
        const invalidNote = qInvalid && state.invalidQuestions[q.id].note ? state.invalidQuestions[q.id].note : '';

        if (qInvalid) badges.push('<span class="invalid-badge" title="' + escapeHtml(invalidNote) + '">🚫 לא תקינה</span>');
        if (q.needsReview) badges.push('<span class="needs-review-badge">⚠️ לבדיקה</span>');
        if (q.correctIndex === null) badges.push('<span class="missing-correct-badge">❌ חסר תשובה</span>');
        if (issues.length > 0 && !qInvalid) badges.push('<span class="issues-count-badge">' + issues.length + ' בעיות</span>');

        const checked = state.cms.selected[q.id] ? 'checked' : '';

        return `
            <div class="cms-question-item${qInvalid ? ' invalid' : ''}">
                <input type="checkbox" class="cms-q-check" data-id="${q.id}" ${checked}>
                <div class="cms-question-content">
                    <div class="cms-question-topic">${escapeHtml(q.mainTopic)}</div>
                    <div class="cms-question-text">${escapeHtml(q.questionText)}</div>
                    <div class="cms-question-meta">
                        <span>#${q.id.slice(-8)}</span>
                        <span>${q.choices.length} תשובות</span>
                        ${badges.join('')}
                    </div>
                </div>
                <div class="cms-question-actions">
                    <button class="cms-btn invalid-toggle${qInvalid ? ' is-invalid' : ''}" data-id="${q.id}" title="${qInvalid ? 'הסר סימון' : 'סמן כלא תקינה'}">⚠️</button>
                    <button class="cms-btn edit" data-id="${q.id}" title="ערוך">✏️</button>
                    <button class="cms-btn delete" data-id="${q.id}" title="מחק">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    updateBulkBar();
    
    if (pagination) {
        if (totalPages <= 1) {
            pagination.innerHTML = '';
        } else {
            let buttons = [];
            if (page > 1) buttons.push(`<button data-page="${page - 1}">הקודם</button>`);
            
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                    buttons.push(`<button data-page="${i}" class="${i === page ? 'active' : ''}">${i}</button>`);
                } else if (buttons[buttons.length - 1] !== '...') {
                    buttons.push('<span style="padding: 8px;">...</span>');
                }
            }
            
            if (page < totalPages) buttons.push(`<button data-page="${page + 1}">הבא</button>`);
            
            pagination.innerHTML = buttons.join('');
        }
    }
}

// ==================== TOPICS LIST ====================
let expandedTopic = null;

function updateCMSTopicsList() {
    const container = $('cmsTopicsList');
    if (!container) return;

    const topics = Object.keys(state.questionsByTopic).sort();

    container.innerHTML = topics.map(topic => {
        const isExpanded = expandedTopic === topic;
        return `
        <div class="topic-manager-item${isExpanded ? ' expanded' : ''}">
            <div class="topic-manager-row">
                <span class="topic-manager-name cms-topic-toggle" data-topic="${escapeHtml(topic)}">${isExpanded ? '▼' : '◀'} ${escapeHtml(topic)}</span>
                <span class="topic-manager-count">${state.questionsByTopic[topic].length} שאלות</span>
                <button class="btn-ghost btn-sm topic-edit-btn" data-topic="${escapeHtml(topic)}">ערוך</button>
            </div>
            ${isExpanded ? renderSubtopicsForTopic(topic) : ''}
        </div>`;
    }).join('');
}

// ==================== SUBTOPICS MANAGEMENT ====================
function renderSubtopicsForTopic(mainTopic) {
    const meta = state.topicsMeta || {};
    const labels = (meta.subLabels && meta.subLabels[mainTopic]) || {};
    const order = (meta.subOrder && meta.subOrder[mainTopic]) || Object.keys(labels);

    const items = order.map((key, i) => `
        <div class="cms-subtopic-item">
            <span class="cms-subtopic-label" title="${escapeHtml(key)}">${escapeHtml(labels[key] || key)}</span>
            <span class="cms-subtopic-key">${escapeHtml(key)}</span>
            <div class="cms-subtopic-actions">
                <button class="btn-ghost btn-xs" onclick="moveSubtopic('${escapeHtml(mainTopic)}','${escapeHtml(key)}',-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-ghost btn-xs" onclick="moveSubtopic('${escapeHtml(mainTopic)}','${escapeHtml(key)}',1)" ${i === order.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-ghost btn-xs" onclick="promptRenameSubtopic('${escapeHtml(mainTopic)}','${escapeHtml(key)}')">✏️</button>
                <button class="btn-ghost btn-xs danger" onclick="deleteSubtopic('${escapeHtml(mainTopic)}','${escapeHtml(key)}')">🗑️</button>
            </div>
        </div>`).join('');

    return `
    <div class="cms-subtopics-panel">
        <div class="cms-subtopics-header">תתי-נושאים (${order.length})</div>
        ${items || '<div class="cms-subtopic-empty">אין תתי-נושאים</div>'}
        <div class="cms-subtopic-add">
            <input type="text" id="newSubtopicInput_${mainTopic}" placeholder="שם תת-נושא חדש..." class="input-sm">
            <button class="btn-primary btn-xs" onclick="addSubtopic('${escapeHtml(mainTopic)}')">הוסף</button>
        </div>
    </div>`;
}

function toggleSubtopicPanel(mainTopic) {
    expandedTopic = expandedTopic === mainTopic ? null : mainTopic;
    updateCMSTopicsList();
}

function saveTopicLabels() {
    const data = getTopicLabelsJSON();
    localStorage.setItem('skymind_topic_labels_edited', JSON.stringify(data));
}

function addSubtopic(mainTopic) {
    const input = $('newSubtopicInput_' + mainTopic);
    if (!input) return;
    const name = input.value.trim();
    if (!name) { showToast('נא להזין שם תת-נושא', 'error'); return; }

    const meta = state.topicsMeta;
    if (!meta.subLabels[mainTopic]) meta.subLabels[mainTopic] = {};
    if (!meta.subOrder[mainTopic]) meta.subOrder[mainTopic] = [];

    // Duplicate check (case-insensitive on label)
    const nameLower = name.toLowerCase();
    const existing = Object.values(meta.subLabels[mainTopic]);
    if (existing.some(l => l.toLowerCase() === nameLower)) {
        showToast('תת-נושא עם שם זהה כבר קיים', 'error');
        return;
    }

    // Use name as key (matching existing Hebrew-key convention)
    const key = name;
    meta.subLabels[mainTopic][key] = name;
    meta.subOrder[mainTopic].push(key);

    saveTopicLabels();
    updateCMSTopicsList();
    showToast('תת-נושא נוסף', 'success');
}

function promptRenameSubtopic(mainTopic, key) {
    const meta = state.topicsMeta;
    const currentLabel = (meta.subLabels[mainTopic] && meta.subLabels[mainTopic][key]) || key;
    const newLabel = prompt('שם חדש לתת-נושא:', currentLabel);
    if (newLabel === null) return;
    const trimmed = newLabel.trim();
    if (!trimmed) { showToast('שם לא יכול להיות ריק', 'error'); return; }
    if (trimmed === currentLabel) return;

    // Duplicate check
    const trimLower = trimmed.toLowerCase();
    const existing = Object.entries(meta.subLabels[mainTopic] || {});
    if (existing.some(([k, l]) => k !== key && l.toLowerCase() === trimLower)) {
        showToast('תת-נושא עם שם זהה כבר קיים', 'error');
        return;
    }

    meta.subLabels[mainTopic][key] = trimmed;
    saveTopicLabels();
    updateCMSTopicsList();
    showToast('שם תת-נושא שונה', 'success');
}

function deleteSubtopic(mainTopic, key) {
    const meta = state.topicsMeta;
    const label = (meta.subLabels[mainTopic] && meta.subLabels[mainTopic][key]) || key;
    if (!confirm('למחוק את תת-הנושא "' + label + '"?')) return;

    delete meta.subLabels[mainTopic][key];
    if (meta.subOrder[mainTopic]) {
        meta.subOrder[mainTopic] = meta.subOrder[mainTopic].filter(k => k !== key);
    }

    saveTopicLabels();
    updateCMSTopicsList();
    showToast('תת-נושא נמחק', 'success');
}

function moveSubtopic(mainTopic, key, direction) {
    const meta = state.topicsMeta;
    const order = meta.subOrder[mainTopic];
    if (!order) return;
    const idx = order.indexOf(key);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;

    order[idx] = order[newIdx];
    order[newIdx] = key;

    saveTopicLabels();
    updateCMSTopicsList();
}

// ==================== REVIEW LIST ====================
function updateCMSReviewList() {
    const container = $('cmsReviewList');
    if (!container) return;
    
    const reviewItems = state.questions.filter(q => q.needsReview || q.correctIndex === null);
    
    if (reviewItems.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">אין שאלות הדורשות בדיקה 🎉</p>';
        return;
    }
    
    container.innerHTML = reviewItems.map(q => {
        const badges = [];
        if (q.needsReview) badges.push('<span class="needs-review-badge">⚠️ לבדיקה</span>');
        if (q.correctIndex === null) badges.push('<span class="missing-correct-badge">❌ חסר תשובה</span>');
        if (q.choices.length < 2) badges.push('<span class="needs-review-badge">📝 מעט תשובות</span>');
        
        return `
            <div class="cms-question-item">
                <div class="cms-question-content">
                    <div class="cms-question-topic">${escapeHtml(q.mainTopic)}</div>
                    <div class="cms-question-text">${escapeHtml(q.questionText)}</div>
                    <div class="cms-question-meta">
                        <span>#${q.id.slice(-8)}</span>
                        ${badges.join('')}
                    </div>
                </div>
                <div class="cms-question-actions">
                    <button class="cms-btn edit" data-id="${q.id}" title="ערוך">✏️</button>
                    <button class="cms-btn delete" data-id="${q.id}" title="מחק">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== QUESTION EDITOR ====================
function showEditor(question) {
    state.cms.editingQuestion = question ? question.id : null;
    
    const isNew = !question;
    const editorTitle = $('editorTitle');
    if (editorTitle) editorTitle.textContent = isNew ? 'שאלה חדשה' : 'עריכת שאלה';
    
    const editId = $('editId');
    const editSource = $('editSource');
    const editMainTopic = $('editMainTopic');
    const editSubTopic = $('editSubTopic');
    const editQuestion = $('editQuestion');
    const editExplanation = $('editExplanation');
    const editNeedsReview = $('editNeedsReview');
    const editRawBlock = $('editRawBlock');
    
    if (isNew) {
        if (editId) editId.value = generateId();
        if (editSource) editSource.value = 'manual';
        if (editMainTopic) editMainTopic.value = '';
        if (editSubTopic) editSubTopic.value = '';
        if (editQuestion) editQuestion.value = '';
        if (editExplanation) editExplanation.value = '';
        if (editNeedsReview) editNeedsReview.checked = false;
        renderChoicesEditor(['', '', '', ''], null);
        
        const rawSection = document.querySelector('.raw-block-section');
        if (rawSection) rawSection.classList.add('hidden');
    } else {
        if (editId) editId.value = question.id;
        if (editSource) editSource.value = question.sourceFile || 'unknown';
        if (editMainTopic) editMainTopic.value = question.mainTopic;
        if (editSubTopic) editSubTopic.value = question.subTopic || '';
        if (editQuestion) editQuestion.value = question.questionText;
        if (editExplanation) editExplanation.value = question.explanation || '';
        if (editNeedsReview) editNeedsReview.checked = question.needsReview;
        renderChoicesEditor(question.choices, question.correctIndex);
        
        const rawSection = document.querySelector('.raw-block-section');
        if (rawSection && editRawBlock) {
            if (question.rawBlock) {
                rawSection.classList.remove('hidden');
                editRawBlock.textContent = question.rawBlock;
            } else {
                rawSection.classList.add('hidden');
            }
        }
    }
    
    showModal('editorModal');
}

function renderChoicesEditor(choices, correctIndex) {
    const container = $('choicesEditor');
    if (!container) return;
    
    container.innerHTML = choices.map((choice, i) => `
        <div class="choice-edit-row">
            <input type="radio" name="correctChoice" value="${i}" ${i === correctIndex ? 'checked' : ''}>
            <input type="text" class="choice-input" value="${escapeHtml(choice)}" placeholder="תשובה ${i + 1}">
            <button type="button" class="remove-choice" ${choices.length <= 2 ? 'disabled' : ''}>×</button>
        </div>
    `).join('');
}

function addChoice() {
    const container = $('choicesEditor');
    if (!container) return;
    
    const inputs = container.querySelectorAll('.choice-input');
    const choices = Array.from(inputs).map(i => i.value);
    const selectedRadio = container.querySelector('input[name="correctChoice"]:checked');
    const correctIndex = selectedRadio ? parseInt(selectedRadio.value) : null;
    
    choices.push('');
    renderChoicesEditor(choices, correctIndex);
}

function removeChoice(index) {
    const container = $('choicesEditor');
    if (!container) return;
    
    const inputs = container.querySelectorAll('.choice-input');
    if (inputs.length <= 2) return;
    
    const choices = Array.from(inputs).map(i => i.value);
    const selectedRadio = container.querySelector('input[name="correctChoice"]:checked');
    let correctIndex = selectedRadio ? parseInt(selectedRadio.value) : null;
    
    choices.splice(index, 1);
    
    if (correctIndex === index) {
        correctIndex = null;
    } else if (correctIndex !== null && correctIndex > index) {
        correctIndex--;
    }
    
    renderChoicesEditor(choices, correctIndex);
}

function saveQuestion() {
    const editId = $('editId');
    const editMainTopic = $('editMainTopic');
    const editSubTopic = $('editSubTopic');
    const editQuestion = $('editQuestion');
    const editExplanation = $('editExplanation');
    const editNeedsReview = $('editNeedsReview');
    const choicesEditor = $('choicesEditor');
    
    if (!editId || !editMainTopic || !editQuestion || !choicesEditor) return;
    
    const id = editId.value.trim();
    const mainTopic = editMainTopic.value.trim();
    const questionText = editQuestion.value.trim();
    
    if (!mainTopic || !questionText) {
        showToast('נושא ושאלה הם שדות חובה', 'error');
        return;
    }
    
    const inputs = choicesEditor.querySelectorAll('.choice-input');
    const choices = Array.from(inputs).map(i => i.value.trim()).filter(c => c);
    
    if (choices.length < 2) {
        showToast('נדרשות לפחות 2 תשובות', 'error');
        return;
    }
    
    const selectedRadio = choicesEditor.querySelector('input[name="correctChoice"]:checked');
    let correctIndex = selectedRadio ? parseInt(selectedRadio.value) : null;
    
    if (correctIndex !== null && correctIndex >= choices.length) {
        correctIndex = null;
    }
    
    const now = Date.now();
    const questionData = {
        id: id,
        mainTopic: mainTopic,
        subTopic: editSubTopic ? editSubTopic.value.trim() : '',
        questionText: questionText,
        choices: choices,
        correctIndex: correctIndex,
        explanation: editExplanation ? editExplanation.value.trim() : '',
        needsReview: editNeedsReview ? editNeedsReview.checked : false,
        updatedAt: now
    };
    
    const existingIndex = state.questions.findIndex(q => q.id === id);
    
    if (existingIndex >= 0) {
        const existing = state.questions[existingIndex];
        questionData.rawBlock = existing.rawBlock || '';
        questionData.sourceFile = existing.sourceFile || '';
        questionData.createdAt = existing.createdAt;
        state.questions[existingIndex] = questionData;
    } else {
        questionData.rawBlock = '';
        questionData.sourceFile = 'manual';
        questionData.createdAt = now;
        state.questions.push(questionData);
    }
    
    buildIndexes();
    saveQuestions();
    
    hideModal('editorModal');
    updateCMSView();
    showToast('השאלה נשמרה', 'success');
}

function duplicateQuestion() {
    const editingId = state.cms.editingQuestion;
    if (!editingId) return;
    
    const original = state.questionsById[editingId];
    if (!original) return;
    
    const duplicate = {
        ...original,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    state.questions.push(duplicate);
    buildIndexes();
    saveQuestions();
    
    hideModal('editorModal');
    showEditor(duplicate);
    showToast('השאלה שוכפלה', 'success');
}

function deleteQuestion(id) {
    showConfirm('מחיקת שאלה', 'האם למחוק את השאלה?', () => {
        const index = state.questions.findIndex(q => q.id === id);
        if (index >= 0) {
            state.questions.splice(index, 1);
            buildIndexes();
            saveQuestions();
            
            if (state.progress[id]) {
                delete state.progress[id];
                saveProgress();
            }
            
            hideModal('editorModal');
            updateCMSView();
            showToast('השאלה נמחקה', 'success');
        }
    });
}

// ==================== TOPIC EDITOR ====================
let editingTopic = null;

function migrateTopicKey(oldKey, newKey) {
    if (oldKey === newKey) return;
    var meta = state.topicsMeta;
    if (!meta) return;

    // Migrate subLabels
    if (meta.subLabels && meta.subLabels[oldKey]) {
        if (!meta.subLabels[newKey]) {
            meta.subLabels[newKey] = meta.subLabels[oldKey];
        } else {
            // Merge: old entries that don't conflict go into new
            var existing = meta.subLabels[newKey];
            var old = meta.subLabels[oldKey];
            for (var k in old) {
                if (!(k in existing)) existing[k] = old[k];
            }
        }
        delete meta.subLabels[oldKey];
    }

    // Migrate subOrder
    if (meta.subOrder && meta.subOrder[oldKey]) {
        if (!meta.subOrder[newKey]) {
            meta.subOrder[newKey] = meta.subOrder[oldKey];
        } else {
            // Append keys from old that aren't already in new
            var existingSet = new Set(meta.subOrder[newKey]);
            meta.subOrder[oldKey].forEach(function(k) {
                if (!existingSet.has(k)) meta.subOrder[newKey].push(k);
            });
        }
        delete meta.subOrder[oldKey];
    }

    // Migrate mainLabels
    if (meta.mainLabels && meta.mainLabels[oldKey]) {
        if (!meta.mainLabels[newKey]) {
            meta.mainLabels[newKey] = meta.mainLabels[oldKey];
        }
        delete meta.mainLabels[oldKey];
    }

    // Migrate mainOrder
    if (meta.mainOrder) {
        var idx = meta.mainOrder.indexOf(oldKey);
        if (idx >= 0) {
            if (meta.mainOrder.indexOf(newKey) < 0) {
                meta.mainOrder[idx] = newKey;
            } else {
                meta.mainOrder.splice(idx, 1);
            }
        }
    }

    saveTopicLabels();
}

function showTopicEditor(topic) {
    editingTopic = topic;

    const currentName = $('currentTopicName');
    const newName = $('newTopicName');

    if (currentName) currentName.value = topic;
    if (newName) newName.value = topic;

    showModal('topicEditorModal');
}

function renameTopic() {
    if (!editingTopic) return;

    const newName = $('newTopicName');
    if (!newName) return;

    const newTopicName = newName.value.trim();
    if (!newTopicName) {
        showToast('נא להזין שם נושא', 'error');
        return;
    }

    if (newTopicName === editingTopic) {
        hideModal('topicEditorModal');
        return;
    }

    // Block rename if target key already exists (case-insensitive)
    var existingTopics = Object.keys(state.questionsByTopic);
    var newLower = newTopicName.toLowerCase();
    var conflict = existingTopics.find(function(t) {
        return t !== editingTopic && t.toLowerCase() === newLower;
    });
    if (conflict) {
        showToast('נושא עם שם זהה כבר קיים: ' + conflict, 'error');
        return;
    }

    state.questions.forEach(q => {
        if (q.mainTopic === editingTopic) {
            q.mainTopic = newTopicName;
            q.updatedAt = Date.now();
        }
    });

    migrateTopicKey(editingTopic, newTopicName);

    buildIndexes();
    saveQuestions();

    hideModal('topicEditorModal');
    updateCMSView();
    showToast('שם הנושא שונה', 'success');
}

function showMergeTopicModal() {
    if (!editingTopic) return;
    
    const sourceEl = $('mergeSourceTopic');
    const targetEl = $('mergeTargetTopic');
    
    if (sourceEl) sourceEl.textContent = editingTopic;
    
    if (targetEl) {
        const topics = Object.keys(state.questionsByTopic).filter(t => t !== editingTopic).sort();
        targetEl.innerHTML = '<option value="">בחר נושא יעד</option>' +
            topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }
    
    hideModal('topicEditorModal');
    showModal('mergeTopicModal');
}

function mergeTopic() {
    if (!editingTopic) return;

    const targetEl = $('mergeTargetTopic');
    if (!targetEl || !targetEl.value) {
        showToast('נא לבחור נושא יעד', 'error');
        return;
    }

    const targetTopic = targetEl.value;

    state.questions.forEach(q => {
        if (q.mainTopic === editingTopic) {
            q.mainTopic = targetTopic;
            q.updatedAt = Date.now();
        }
    });

    migrateTopicKey(editingTopic, targetTopic);

    buildIndexes();
    saveQuestions();

    hideModal('mergeTopicModal');
    updateCMSView();
    showToast('הנושאים מוזגו', 'success');
}

function deleteTopic() {
    if (!editingTopic) return;
    
    const questions = state.questionsByTopic[editingTopic];
    if (questions && questions.length > 0) {
        showToast('לא ניתן למחוק נושא עם שאלות. מזג אותו קודם.', 'error');
        return;
    }
    
    hideModal('topicEditorModal');
    showToast('הנושא נמחק', 'success');
}

// ==================== EXPORT ====================
function exportQuestions() {
    const data = JSON.stringify(state.questions, null, 2);
    downloadFile(data, 'skymind-questions-' + getTodayKey() + '.json', 'application/json');
    showToast('הקובץ הורד', 'success');
}

function exportFullBackup() {
    const backup = {
        version: APP_VERSION,
        exportDate: Date.now(),
        questions: state.questions,
        progress: state.progress,
        gamification: state.gamification,
        settings: state.settings
    };
    
    const data = JSON.stringify(backup, null, 2);
    downloadFile(data, 'skymind-backup-' + getTodayKey() + '.json', 'application/json');
    showToast('הגיבוי הורד', 'success');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportProgress() {
    const data = JSON.stringify({
        progress: state.progress,
        gamification: state.gamification
    }, null, 2);
    downloadFile(data, 'skymind-progress-' + getTodayKey() + '.json', 'application/json');
    showToast('ההתקדמות יוצאה', 'success');
}

// ==================== CMS ACCESS ====================
function unlockCMS() {
    const passwordInput = $('cmsPassword');
    if (!passwordInput) return;
    
    const password = passwordInput.value;
    
    if (password === CONFIG.CMS_PASSWORD) {
        state.cmsUnlocked = true;
        saveToStorage(CONFIG.STORAGE_KEYS.CMS_UNLOCKED, true);
        passwordInput.value = '';
        updateSettingsView();
        showToast('CMS נפתח!', 'success');
    } else {
        showToast('סיסמה שגויה', 'error');
    }
}

function lockCMS() {
    state.cmsUnlocked = false;
    saveToStorage(CONFIG.STORAGE_KEYS.CMS_UNLOCKED, false);
    updateSettingsView();
    showToast('CMS ננעל', 'info');
}

// ==================== RESET ====================
function resetQuestionBank() {
    showConfirm('איפוס מאגר', 'האם לאפס את כל השאלות למצב המקורי?', () => {
        removeFromStorage(CONFIG.STORAGE_KEYS.QUESTIONS);
        location.reload();
    });
}

function resetProgress() {
    showConfirm('איפוס התקדמות', 'האם לאפס את כל ההתקדמות?', () => {
        state.progress = {};
        saveProgress();
        showToast('ההתקדמות אופסה', 'success');
        updateHomeStats();
    });
}

function resetGamification() {
    showConfirm('איפוס XP והישגים', 'האם לאפס את כל ה-XP וההישגים?', () => {
        state.gamification = getDefaultGamification();
        saveGamification();
        showToast('XP והישגים אופסו', 'success');
        updateHomeStats();
        renderAchievements();
    });
}

function resetAll() {
    showConfirm('איפוס הכל', 'האם למחוק את כל הנתונים?', () => {
        clearAllData();
        location.reload();
    });
}

// ==================== GITHUB COMMIT ====================
const GH_OWNER = 'AmitZalman';
const GH_REPO = 'SkyMind';
const GH_BRANCH = 'main';
const GH_TOKEN_KEY = 'SKYMIND_CMS_GH_TOKEN';

function b64encodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function ghApi(path, token, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Accept'] = 'application/vnd.github+json';
    headers['Authorization'] = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    opts.headers = headers;
    return fetch('https://api.github.com' + path, opts).then(function(res) {
        return res.text().then(function(text) {
            var data = null;
            try { data = text ? JSON.parse(text) : null; } catch(e) { data = text; }
            if (!res.ok) {
                var msg = (data && data.message) ? data.message : 'GitHub API error';
                var err = new Error(msg + ' (HTTP ' + res.status + ')');
                err.status = res.status;
                throw err;
            }
            return data;
        });
    });
}

function getFileSha(filePath, token) {
    return ghApi('/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + filePath + '?ref=' + GH_BRANCH, token)
        .then(function(data) { return data.sha; })
        .catch(function(err) {
            if (err.status === 404) return null;
            throw err;
        });
}

function putFile(filePath, content, sha, message, token) {
    var body = {
        message: message,
        content: b64encodeUtf8(content),
        branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    return ghApi('/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + filePath, token, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

function putFileWithRetry(filePath, content, sha, message, token) {
    return putFile(filePath, content, sha, message, token)
        .catch(function(err) {
            if (err.status === 409) {
                return getFileSha(filePath, token).then(function(freshSha) {
                    return putFile(filePath, content, freshSha, message, token);
                });
            }
            if (err.status === 401) throw new Error('Token לא תקין (401)');
            if (err.status === 403) throw new Error('אין הרשאות מספיקות ל-repo (403)');
            throw err;
        });
}

function showGithubCommitModal() {
    var tokenInput = $('ghToken');
    var saved = sessionStorage.getItem(GH_TOKEN_KEY);
    if (saved && tokenInput) tokenInput.value = saved;
    var statusEl = $('ghCommitStatus');
    if (statusEl) statusEl.textContent = '';
    var commitBtn = $('ghCommitBtn');
    if (commitBtn) { commitBtn.disabled = false; commitBtn.textContent = 'Commit'; }
    showModal('githubCommitModal');
}

function commitToGitHub() {
    var tokenInput = $('ghToken');
    var msgInput = $('ghCommitMsg');
    var rememberCb = $('ghRememberToken');
    var statusEl = $('ghCommitStatus');
    var commitBtn = $('ghCommitBtn');

    var token = tokenInput ? tokenInput.value.trim() : '';
    var message = msgInput ? msgInput.value.trim() : '';
    if (!message) message = 'Update questions via CMS';
    if (!token) { showToast('נא להזין GitHub Token', 'error'); return; }

    if (rememberCb && rememberCb.checked) {
        sessionStorage.setItem(GH_TOKEN_KEY, token);
    }

    if (commitBtn) { commitBtn.disabled = true; commitBtn.textContent = 'שולח...'; }
    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    var sourceContent = JSON.stringify(state.questions, null, 2);
    var questionsContent = sourceContent;
    var now = Date.now();
    var versionContent = JSON.stringify({
        updatedAt: now,
        version: APP_VERSION,
        questionsCount: state.questions.length
    }, null, 2);
    var topicLabelsContent = JSON.stringify(getTopicLabelsJSON(), null, 2);
    var invalidContent = JSON.stringify(state.invalidQuestions || {}, null, 2);

    setStatus('מביא SHA של קבצים...');

    Promise.all([
        getFileSha('data/questions.source.json', token),
        getFileSha('data/questions.json', token),
        getFileSha('data/version.json', token),
        getFileSha('data/topic_labels_he.json', token),
        getFileSha('data/invalid_questions.json', token)
    ])
    .then(function(shas) {
        setStatus('שומר questions.source.json...');
        return putFileWithRetry('data/questions.source.json', sourceContent, shas[0], message + ' [source]', token)
            .then(function() {
                setStatus('שומר questions.json...');
                return putFileWithRetry('data/questions.json', questionsContent, shas[1], message, token);
            })
            .then(function() {
                setStatus('שומר version.json...');
                return putFileWithRetry('data/version.json', versionContent, shas[2], message + ' [version]', token);
            })
            .then(function() {
                setStatus('שומר topic_labels_he.json...');
                return putFileWithRetry('data/topic_labels_he.json', topicLabelsContent, shas[3], message + ' [labels]', token);
            })
            .then(function() {
                setStatus('שומר invalid_questions.json...');
                return putFileWithRetry('data/invalid_questions.json', invalidContent, shas[4], message + ' [invalid]', token);
            });
    })
    .then(function() {
        setStatus('');
        hideModal('githubCommitModal');
        localStorage.removeItem('skymind_topic_labels_edited');
        localStorage.removeItem('skymind_invalid_questions');
        showToast('נשמר ב-GitHub בהצלחה!', 'success');
    })
    .catch(function(err) {
        setStatus('שגיאה: ' + err.message);
        showToast('שגיאה: ' + err.message, 'error');
    })
    .finally(function() {
        if (commitBtn) { commitBtn.disabled = false; commitBtn.textContent = 'Commit'; }
    });
}

// ==================== BULK ACTIONS ====================
function updateBulkBar() {
    const bar = $('cmsBulkBar');
    const countEl = $('cmsSelectedCount');
    const deleteBtn = $('cmsDeleteSelected');
    const clearBtn = $('cmsClearSelection');
    const count = Object.keys(state.cms.selected).length;

    if (bar) bar.classList.remove('hidden');
    if (countEl) countEl.textContent = count ? count + ' נבחרו' : '';
    if (deleteBtn) deleteBtn.classList.toggle('hidden', count === 0);
    if (clearBtn) clearBtn.classList.toggle('hidden', count === 0);
}

function toggleCmsSelect(id, checked) {
    if (checked) {
        state.cms.selected[id] = true;
    } else {
        delete state.cms.selected[id];
    }
    updateBulkBar();
}

function cmsSelectAll(checked) {
    var ids = state.cms._visibleIds || [];
    if (checked) {
        ids.forEach(function(id) { state.cms.selected[id] = true; });
    } else {
        ids.forEach(function(id) { delete state.cms.selected[id]; });
    }
    // Update checkboxes on current page
    var checks = document.querySelectorAll('.cms-q-check');
    checks.forEach(function(cb) { cb.checked = checked; });
    updateBulkBar();
}

function cmsClearSelection() {
    state.cms.selected = {};
    var selAll = $('cmsSelectAll');
    if (selAll) selAll.checked = false;
    var checks = document.querySelectorAll('.cms-q-check');
    checks.forEach(function(cb) { cb.checked = false; });
    updateBulkBar();
}

function cmsDeleteSelected() {
    var ids = Object.keys(state.cms.selected);
    if (!ids.length) return;

    showConfirm('מחיקת ' + ids.length + ' שאלות', 'האם למחוק את ' + ids.length + ' השאלות הנבחרות?', function() {
        ids.forEach(function(id) {
            var idx = state.questions.findIndex(function(q) { return q.id === id; });
            if (idx >= 0) state.questions.splice(idx, 1);
            if (state.progress[id]) delete state.progress[id];
        });
        state.cms.selected = {};
        buildIndexes();
        saveQuestions();
        saveProgress();
        updateCMSView();
        showToast(ids.length + ' שאלות נמחקו', 'success');
    });
}

// ==================== INVALID FLAGGING ====================
function toggleInvalid(qId) {
    if (!state.invalidQuestions) state.invalidQuestions = {};

    if (state.invalidQuestions[qId] && state.invalidQuestions[qId].invalid) {
        delete state.invalidQuestions[qId];
        saveInvalidQuestions();
        updateCMSQuestionsList();
        showToast('סימון הוסר', 'info');
    } else {
        var note = prompt('הערה (אופציונלי, עד 120 תווים):', '') || '';
        state.invalidQuestions[qId] = {
            invalid: true,
            note: note.slice(0, 120),
            updatedAt: Date.now()
        };
        saveInvalidQuestions();
        updateCMSQuestionsList();
        showToast('שאלה סומנה כלא תקינה', 'warning');
    }
}

function saveInvalidQuestions() {
    localStorage.setItem('skymind_invalid_questions', JSON.stringify(state.invalidQuestions));
}

// Export
window.updateCMSView = updateCMSView;
window.switchCMSTab = switchCMSTab;
window.updateCMSQuestionsList = updateCMSQuestionsList;
window.updateCMSTopicsList = updateCMSTopicsList;
window.updateCMSReviewList = updateCMSReviewList;
window.showEditor = showEditor;
window.renderChoicesEditor = renderChoicesEditor;
window.addChoice = addChoice;
window.removeChoice = removeChoice;
window.saveQuestion = saveQuestion;
window.duplicateQuestion = duplicateQuestion;
window.deleteQuestion = deleteQuestion;
window.showTopicEditor = showTopicEditor;
window.renameTopic = renameTopic;
window.showMergeTopicModal = showMergeTopicModal;
window.mergeTopic = mergeTopic;
window.deleteTopic = deleteTopic;
window.exportQuestions = exportQuestions;
window.exportFullBackup = exportFullBackup;
window.exportProgress = exportProgress;
window.unlockCMS = unlockCMS;
window.lockCMS = lockCMS;
window.resetQuestionBank = resetQuestionBank;
window.resetProgress = resetProgress;
window.resetGamification = resetGamification;
window.resetAll = resetAll;
window.showGithubCommitModal = showGithubCommitModal;
window.commitToGitHub = commitToGitHub;
window.updateBulkBar = updateBulkBar;
window.toggleCmsSelect = toggleCmsSelect;
window.cmsSelectAll = cmsSelectAll;
window.cmsClearSelection = cmsClearSelection;
window.cmsDeleteSelected = cmsDeleteSelected;
window.toggleSubtopicPanel = toggleSubtopicPanel;
window.addSubtopic = addSubtopic;
window.promptRenameSubtopic = promptRenameSubtopic;
window.deleteSubtopic = deleteSubtopic;
window.moveSubtopic = moveSubtopic;
window.toggleInvalid = toggleInvalid;
window.saveInvalidQuestions = saveInvalidQuestions;
window.migrateTopicKey = migrateTopicKey;
window.updateCMSSubtopicFilter = updateCMSSubtopicFilter;
window.validateQuestion = validateQuestion;
window.isInvalid = isInvalid;
