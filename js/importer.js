/**
 * SkyMind Importer Module v3.0.0
 * Robust question import from JSON and raw text
 */

// ==================== JSON IMPORT ====================
function importQuestions(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (!Array.isArray(data)) {
            showToast('הקובץ אינו מכיל מערך שאלות', 'error');
            return;
        }
        
        const importMode = document.querySelector('input[name="importMode"]:checked');
        const mode = importMode ? importMode.value : 'merge';
        
        if (mode === 'replace') {
            showConfirm('החלפת מאגר', 'האם להחליף את כל השאלות הקיימות?', () => {
                state.questions = normalizeQuestions(data);
                buildIndexes();
                saveQuestions();
                updateCMSView();
                showToast('יובאו ' + state.questions.length + ' שאלות', 'success');
            });
        } else {
            // Merge mode
            const normalized = normalizeQuestions(data);
            const existingIds = new Set(state.questions.map(q => q.id));
            
            let added = 0;
            let skipped = 0;
            
            normalized.forEach(q => {
                if (existingIds.has(q.id)) {
                    // Check for content duplicate
                    const hash = hashContent(q.questionText + q.choices.join(''));
                    const duplicate = state.questions.find(eq => 
                        hashContent(eq.questionText + eq.choices.join('')) === hash
                    );
                    
                    if (duplicate) {
                        skipped++;
                    } else {
                        // ID collision but different content - generate new ID
                        q.id = generateId();
                        state.questions.push(q);
                        added++;
                    }
                } else {
                    state.questions.push(q);
                    added++;
                }
            });
            
            buildIndexes();
            saveQuestions();
            updateCMSView();
            
            let msg = 'יובאו ' + added + ' שאלות';
            if (skipped > 0) msg += ', ' + skipped + ' כפילויות דולגו';
            showToast(msg, 'success');
        }
    } catch (e) {
        log('Import error: ' + e.message);
        showToast('שגיאה בקריאת הקובץ: ' + e.message, 'error');
    }
}

// ==================== BACKUP IMPORT ====================
function importBackup(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (!data.questions && !data.progress && !data.gamification) {
            showToast('קובץ גיבוי לא תקין', 'error');
            return;
        }
        
        showConfirm('שחזור גיבוי', 'האם לשחזר את הגיבוי? פעולה זו תחליף את הנתונים הקיימים.', () => {
            if (data.questions) {
                state.questions = normalizeQuestions(data.questions);
                buildIndexes();
                saveQuestions();
            }
            
            if (data.progress) {
                state.progress = data.progress;
                saveProgress();
            }
            
            if (data.gamification) {
                state.gamification = Object.assign(getDefaultGamification(), data.gamification);
                saveGamification();
            }
            
            if (data.settings) {
                state.settings = Object.assign({}, state.settings, data.settings);
                saveSettings();
            }
            
            showToast('הגיבוי שוחזר בהצלחה', 'success');
            updateHomeStats();
            updateCMSView();
        });
    } catch (e) {
        log('Backup import error: ' + e.message);
        showToast('שגיאה בקריאת הגיבוי: ' + e.message, 'error');
    }
}

function importProgress(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (data.progress) {
            state.progress = Object.assign({}, state.progress, data.progress);
            saveProgress();
        }
        
        if (data.gamification) {
            state.gamification = Object.assign(getDefaultGamification(), data.gamification);
            saveGamification();
        }
        
        showToast('ההתקדמות יובאה', 'success');
        updateHomeStats();
    } catch (e) {
        showToast('שגיאה בייבוא: ' + e.message, 'error');
    }
}

// ==================== TEXT IMPORT ====================
function importTextFiles(files) {
    if (!files || files.length === 0) return;
    
    const results = [];
    let processed = 0;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const text = evt.target.result;
            const questions = parseRawText(text, file.name);
            results.push(...questions);
            
            processed++;
            if (processed === files.length) {
                finishTextImport(results);
            }
        };
        reader.readAsText(file);
    });
}

function finishTextImport(questions) {
    if (questions.length === 0) {
        showToast('לא נמצאו שאלות בקבצים', 'warning');
        return;
    }
    
    const normalized = normalizeQuestions(questions);
    
    normalized.forEach(q => {
        state.questions.push(q);
    });
    
    buildIndexes();
    saveQuestions();
    updateCMSView();
    
    const needsReview = normalized.filter(q => q.needsReview).length;
    let msg = 'יובאו ' + normalized.length + ' שאלות';
    if (needsReview > 0) msg += ', ' + needsReview + ' דורשות בדיקה';
    
    showToast(msg, 'success');
    
    // Switch to review tab if there are items
    if (needsReview > 0) {
        switchCMSTab('review');
    }
}

// ==================== TEXT PARSER ====================
function parseRawText(text, filename) {
    const questions = [];
    const blocks = splitIntoBlocks(text);
    
    blocks.forEach((block, index) => {
        const parsed = parseQuestionBlock(block, filename, index);
        if (parsed) {
            questions.push(parsed);
        }
    });
    
    return questions;
}

function splitIntoBlocks(text) {
    // Split by common separators
    const separators = [
        /\n\s*⸻\s*\n/,  // Unicode separator
        /\n\s*---+\s*\n/,  // Dashes
        /\n\s*===+\s*\n/,  // Equals
        /\n\s*\*\*\*+\s*\n/,  // Asterisks
        /\n(?=שאלה\s*(מס['׳]?\s*)?\d+)/i,  // Question number header
    ];
    
    let blocks = [text];
    
    separators.forEach(sep => {
        const newBlocks = [];
        blocks.forEach(block => {
            const parts = block.split(sep).filter(p => p.trim());
            newBlocks.push(...parts);
        });
        blocks = newBlocks;
    });
    
    return blocks.filter(b => b.trim().length > 10);
}

function parseQuestionBlock(block, filename, index) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length < 2) return null;
    
    const result = {
        id: generateId(),
        mainTopic: 'General',
        subTopic: '',
        questionText: '',
        choices: [],
        correctIndex: null,
        explanation: '',
        needsReview: true,
        rawBlock: block.trim(),
        sourceFile: filename || 'text_import'
    };
    
    // Try to extract topic from first line if it looks like a header
    let startLine = 0;
    const topicMatch = lines[0].match(/^(נושא|קטגוריה|topic)[:：]\s*(.+)/i);
    if (topicMatch) {
        result.mainTopic = topicMatch[2].trim();
        startLine = 1;
    }
    
    // Find question text
    let questionLines = [];
    let choicesStartIndex = -1;
    
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if line starts a choice
        if (isChoiceLine(line)) {
            choicesStartIndex = i;
            break;
        }
        
        // Skip question number headers
        if (/^שאלה\s*(מס['׳]?\s*)?\d+/i.test(line)) continue;
        
        questionLines.push(line);
    }
    
    result.questionText = questionLines.join(' ').trim();
    
    // Extract choices
    if (choicesStartIndex >= 0) {
        for (let i = choicesStartIndex; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for correct answer indicator
            if (isCorrectAnswerLine(line)) {
                const correctInfo = extractCorrectAnswer(line);
                if (correctInfo !== null) {
                    result.correctIndex = correctInfo;
                }
                continue;
            }
            
            // Check for explanation
            if (isExplanationLine(line)) {
                result.explanation = extractExplanation(lines.slice(i).join(' '));
                break;
            }
            
            // Extract choice
            const choice = extractChoice(line);
            if (choice) {
                // Check if this choice is marked as correct
                if (line.includes('✓') || line.includes('✔') || line.includes('[נכון]')) {
                    result.correctIndex = result.choices.length;
                }
                result.choices.push(choice);
            }
        }
    }
    
    // Validate and determine needsReview status
    if (result.questionText && result.choices.length >= 2 && result.correctIndex !== null) {
        result.needsReview = false;
    }
    
    // If we have nothing useful, skip
    if (!result.questionText && result.choices.length === 0) {
        return null;
    }
    
    return result;
}

function isChoiceLine(line) {
    // Hebrew letters: א, ב, ג, ד, ה, ו
    // English letters: A, B, C, D, E, F
    // Numbers: 1, 2, 3, 4
    const patterns = [
        /^[אבגדהו][\.\)\-:]/,
        /^[א-ת]\s*[\.\)\-:]/,
        /^[A-Fa-f][\.\)\-:]/,
        /^[1-9][\.\)\-:]/,
        /^•\s/,
        /^-\s/,
        /^\*\s/,
    ];
    
    return patterns.some(p => p.test(line));
}

function extractChoice(line) {
    // Remove the bullet/letter prefix
    let choice = line
        .replace(/^[אבגדהו][\.\)\-:\s]+/, '')
        .replace(/^[א-ת][\.\)\-:\s]+/, '')
        .replace(/^[A-Fa-f][\.\)\-:\s]+/, '')
        .replace(/^[1-9][\.\)\-:\s]+/, '')
        .replace(/^[•\-\*]\s+/, '')
        .replace(/✓|✔|\[נכון\]/g, '')
        .trim();
    
    return choice || null;
}

function isCorrectAnswerLine(line) {
    const patterns = [
        /תשובה\s*נכונה/i,
        /correct\s*answer/i,
        /^תשובה[:：]/,
        /^answer[:：]/i,
    ];
    
    return patterns.some(p => p.test(line));
}

function extractCorrectAnswer(line) {
    // Try to find letter indicator
    const letterMatch = line.match(/[אבגדהו]|[A-Da-d]/);
    if (letterMatch) {
        const letter = letterMatch[0].toUpperCase();
        const letterMap = {
            'א': 0, 'A': 0,
            'ב': 1, 'B': 1,
            'ג': 2, 'C': 2,
            'ד': 3, 'D': 3,
            'ה': 4, 'E': 4,
            'ו': 5, 'F': 5,
        };
        if (letterMap[letter] !== undefined || letterMap[letterMatch[0]] !== undefined) {
            return letterMap[letter] !== undefined ? letterMap[letter] : letterMap[letterMatch[0]];
        }
    }
    
    // Try to find number
    const numMatch = line.match(/\d/);
    if (numMatch) {
        return parseInt(numMatch[0]) - 1;
    }
    
    return null;
}

function isExplanationLine(line) {
    const patterns = [
        /^הסבר/i,
        /^explanation/i,
        /^נימוק/i,
        /^הערה/i,
    ];
    
    return patterns.some(p => p.test(line));
}

function extractExplanation(text) {
    return text
        .replace(/^הסבר\s*(קצר)?[:：]?\s*/i, '')
        .replace(/^explanation[:：]?\s*/i, '')
        .replace(/^נימוק[:：]?\s*/i, '')
        .trim();
}

// Export
window.importQuestions = importQuestions;
window.importBackup = importBackup;
window.importProgress = importProgress;
window.importTextFiles = importTextFiles;
window.parseRawText = parseRawText;
