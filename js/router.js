/**
 * SkyMind Router Module v3.2.0
 * Hash-based routing for SPA navigation
 */

const SCREEN_TITLES = {
    homeScreen: 'SkyMind',
    topicsScreen: 'תרגול לפי נושאים',
    subtopicsScreen: 'בחר תת־נושא',
    topicModeScreen: 'בחר מצב תרגול',
    smartTutorScreen: 'Smart Tutor',
    quizScreen: 'תרגול',
    resultsScreen: 'תוצאות',
    searchScreen: 'חיפוש',
    insightsScreen: 'תובנות',
    achievementsScreen: 'הישגים',
    cmsScreen: 'ניהול מאגר',
    settingsScreen: 'הגדרות'
};

const BOTTOM_NAV_SCREENS = ['homeScreen', 'insightsScreen', 'achievementsScreen', 'cmsScreen', 'settingsScreen'];

// Show a screen
function showScreen(screenId, title, addToHistory = true) {
    // Hide splash
    const splash = $('splashScreen');
    if (splash) splash.classList.remove('active');
    
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    
    // Show target screen
    const screen = document.getElementById(screenId);
    if (!screen) {
        log('Screen not found: ' + screenId);
        return;
    }
    screen.classList.add('active');
    
    // Handle study timer
    if (screenId === 'quizScreen') {
        startStudyTimer();
    } else if (state.currentScreen === 'quizScreen') {
        stopStudyTimer();
    }
    
    // Manage history
    if (addToHistory && state.currentScreen !== screenId && state.currentScreen !== 'splashScreen') {
        state.screenHistory.push(state.currentScreen);
        if (state.screenHistory.length > 20) state.screenHistory.shift();
    }
    
    state.currentScreen = screenId;
    
    // Update hash
    const hash = '#/' + screenId.replace('Screen', '').toLowerCase();
    if (location.hash !== hash) {
        history.replaceState(null, '', hash);
    }
    
    // Header visibility
    const header = $('appHeader');
    const bottomNav = $('bottomNav');
    
    if (screenId === 'splashScreen') {
        if (header) header.classList.add('hidden');
        if (bottomNav) bottomNav.classList.add('hidden');
    } else {
        if (header) header.classList.remove('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
    }
    
    // Back button
    const backBtn = $('backBtn');
    if (backBtn) {
        const showBack = !BOTTOM_NAV_SCREENS.includes(screenId) && screenId !== 'splashScreen';
        backBtn.classList.toggle('hidden', !showBack);
    }
    
    // Title
    const headerTitle = $('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = title || SCREEN_TITLES[screenId] || 'SkyMind';
    }
    
    // Update bottom nav active state
    updateBottomNav(screenId);
    
    // Scroll to top
    const mainContent = $('mainContent');
    if (mainContent) mainContent.scrollTop = 0;
    
    // Screen-specific init
    onScreenShow(screenId);
}

// Update bottom nav active state
function updateBottomNav(screenId) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const targetScreen = item.dataset.screen;
        item.classList.toggle('active', targetScreen === screenId);
    });
}

// Go back
function goBack() {
    if (state.screenHistory.length > 0) {
        const prev = state.screenHistory.pop();
        showScreen(prev, null, false);
    } else {
        showScreen('homeScreen');
    }
}

// Go home
function goHome() {
    state.screenHistory = [];
    showScreen('homeScreen');
}

// Screen-specific initialization
function onScreenShow(screenId) {
    switch (screenId) {
        case 'homeScreen':
            updateHomeStats();
            break;
        case 'topicsScreen':
            renderTopicsList();
            break;
        case 'subtopicsScreen':
            renderSubtopicsList(state.selectedMainTopic);
            break;
        case 'smartTutorScreen':
            updateSmartTutorPreview();
            break;
        case 'insightsScreen':
            updateInsights();
            break;
        case 'achievementsScreen':
            renderAchievements();
            break;
        case 'cmsScreen':
            if (state.cmsUnlocked) {
                updateCMSView();
            } else {
                showScreen('settingsScreen');
                showToast('פתח את ה-CMS בהגדרות', 'info');
            }
            break;
        case 'settingsScreen':
            updateSettingsView();
            break;
        case 'searchScreen':
            const searchInput = $('searchInput');
            if (searchInput) searchInput.focus();
            break;
    }
}

// Handle hash changes
function handleHashChange() {
    const hash = location.hash.replace('#/', '') || 'home';
    const screenId = hash + 'Screen';
    
    // Validate screen exists
    if (document.getElementById(screenId)) {
        showScreen(screenId, null, false);
    }
}

// Setup router
function setupRouter() {
    window.addEventListener('hashchange', handleHashChange);
    
    // Setup bottom nav clicks
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const screenId = item.dataset.screen;
            if (screenId) {
                showScreen(screenId);
            }
        });
    });
}

// Export
window.showScreen = showScreen;
window.goBack = goBack;
window.goHome = goHome;
window.setupRouter = setupRouter;
window.handleHashChange = handleHashChange;
window.SCREEN_TITLES = SCREEN_TITLES;
