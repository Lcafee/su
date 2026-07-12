(() => {
  'use strict';

  const catalog = window.LCAFE_CATALOG;
  if (!catalog) {
    throw new Error('LCAFE_CATALOG is not available.');
  }

  const lineOrder = ['icedtea', 'refresher', 'cloudy', 'frappe'];
  const lineIndex = { icedtea: '01', refresher: '02', cloudy: '03', frappe: '04' };
  const allProducts = lineOrder.flatMap((line) =>
    (catalog.products[line] || []).map((product) => ({ ...product, line }))
  );

  const elements = {
    views: [...document.querySelectorAll('[data-view-name]')],
    homeButton: document.getElementById('homeButton'),
    brandButton: document.getElementById('brandButton'),
    globalMenuButton: document.getElementById('globalMenuButton'),
    startQuizButton: document.getElementById('startQuizButton'),
    homeMenuButton: document.getElementById('homeMenuButton'),
    quizStepLabel: document.getElementById('quizStepLabel'),
    quizProgress: document.getElementById('quizProgress'),
    quizProgressFill: document.getElementById('quizProgressFill'),
    quizAsideLine: document.getElementById('quizAsideLine'),
    questionKicker: document.getElementById('questionKicker'),
    quizQuestion: document.getElementById('quizQuestion'),
    questionHint: document.getElementById('questionHint'),
    answerGrid: document.getElementById('answerGrid'),
    quizBackButton: document.getElementById('quizBackButton'),
    resultShell: document.getElementById('resultShell'),
    resultLineIndex: document.getElementById('resultLineIndex'),
    resultImage: document.getElementById('resultImage'),
    resultCode: document.getElementById('resultCode'),
    resultLineName: document.getElementById('resultLineName'),
    resultName: document.getElementById('resultName'),
    resultEnglishName: document.getElementById('resultEnglishName'),
    resultMood: document.getElementById('resultMood'),
    resultDescription: document.getElementById('resultDescription'),
    resultTags: document.getElementById('resultTags'),
    resultPrice: document.getElementById('resultPrice'),
    secondaryCard: document.getElementById('secondaryCard'),
    secondaryImage: document.getElementById('secondaryImage'),
    secondaryLine: document.getElementById('secondaryLine'),
    secondaryName: document.getElementById('secondaryName'),
    secondaryEnglishName: document.getElementById('secondaryEnglishName'),
    secondaryPrice: document.getElementById('secondaryPrice'),
    restartQuizButton: document.getElementById('restartQuizButton'),
    resultMenuButton: document.getElementById('resultMenuButton'),
    resultHomeButton: document.getElementById('resultHomeButton'),
    lineNavigation: document.getElementById('lineNavigation'),
    menuSections: document.getElementById('menuSections'),
    menuQuizButton: document.getElementById('menuQuizButton'),
    closeMenuButton: document.getElementById('closeMenuButton'),
    liveRegion: document.getElementById('liveRegion')
  };

  const focusTargets = {
    home: document.getElementById('homeTitle'),
    quiz: elements.quizQuestion,
    pause: document.getElementById('pauseTitle'),
    result: elements.resultName,
    menu: document.getElementById('menuTitle')
  };

  const state = {
    view: 'home',
    quizStep: 0,
    selectedLine: null,
    answers: [],
    result: null,
    pendingTimer: null,
    menuReturnFocusId: null,
    lastViewBeforeMenu: 'home'
  };

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let menuRendered = false;
  let lineObserver = null;

  function validateCatalog() {
    const codes = new Set();
    allProducts.forEach((product) => {
      if (!product.code || codes.has(product.code)) {
        throw new Error(`Invalid or duplicate product code: ${product.code || 'empty'}`);
      }
      codes.add(product.code);
    });

    Object.values(catalog.quiz.flavorQuestions).forEach((question) => {
      question.answers.forEach((answer) => {
        if (!codes.has(answer.main)) {
          throw new Error(`Quiz product code not found: ${answer.main}`);
        }
      });
    });
  }

  function clearPendingTimer() {
    if (state.pendingTimer !== null) {
      window.clearTimeout(state.pendingTimer);
      state.pendingTimer = null;
    }
  }

  function announce(message) {
    elements.liveRegion.textContent = '';
    window.setTimeout(() => {
      elements.liveRegion.textContent = message;
    }, 20);
  }

  function focusViewHeading(viewName) {
    const target = focusTargets[viewName];
    if (!target) return;
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: reduceMotionQuery.matches ? 'auto' : 'smooth'
    });
  }

  function updateHeader(viewName) {
    const isHome = viewName === 'home';
    const isMenu = viewName === 'menu';
    const isPause = viewName === 'pause';
    elements.homeButton.hidden = isHome || isPause;
    elements.globalMenuButton.hidden = isMenu || isPause;
  }

  function showView(viewName, options = {}) {
    const { focus = true, speak = true, scroll = true } = options;
    state.view = viewName;
    document.body.dataset.view = viewName;

    elements.views.forEach((view) => {
      const active = view.dataset.viewName === viewName;
      view.hidden = !active;
      view.setAttribute('aria-hidden', String(!active));
    });

    updateHeader(viewName);
    if (scroll) scrollToTop();
    if (focus) focusViewHeading(viewName);

    if (speak) {
      const messages = {
        home: 'صفحه اصلی کمپین تابستانی',
        quiz: `سؤال ${state.quizStep + 1} از ۲`,
        pause: 'در حال آماده‌کردن نتیجه',
        result: 'نتیجه کوییز آماده است',
        menu: 'منوی کامل نوشیدنی‌های تابستانی'
      };
      announce(messages[viewName] || '');
    }
  }

  function historySnapshot() {
    return {
      lcafe: true,
      view: state.view,
      quizStep: state.quizStep,
      selectedLine: state.selectedLine,
      answers: state.answers,
      result: state.result
        ? { mainCode: state.result.main.code, secondaryCode: state.result.secondary.code }
        : null
    };
  }

  function hashForState() {
    if (state.view === 'home') return `${location.pathname}${location.search}`;
    if (state.view === 'quiz') return `${location.pathname}${location.search}#quiz-${state.quizStep + 1}`;
    return `${location.pathname}${location.search}#${state.view}`;
  }

  function pushHistory() {
    try {
      history.pushState(historySnapshot(), '', hashForState());
    } catch (error) {
      // The experience still works when history is unavailable on a local file.
    }
  }

  function replaceHistory() {
    try {
      history.replaceState(historySnapshot(), '', hashForState());
    } catch (error) {
      // The experience still works when history is unavailable on a local file.
    }
  }

  function findProduct(code) {
    return allProducts.find((product) => product.code === code) || null;
  }

  function parsePrice(value) {
    const normalized = String(value || '')
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[^0-9]/g, '');
    return Number(normalized) || 0;
  }

  function formatPrice(value) {
    const amount = parsePrice(value);
    return amount ? `${amount.toLocaleString('fa-IR')} تومان` : catalog.defaults.price;
  }

  function setProductImage(image, source, name) {
    image.dataset.fallbackApplied = 'false';
    image.alt = `تصویر ${name}`;
    image.onerror = () => {
      if (image.dataset.fallbackApplied === 'true') return;
      image.dataset.fallbackApplied = 'true';
      image.src = catalog.defaults.image;
    };
    image.src = source || catalog.defaults.image;
  }

  function lineStyles(element, line) {
    const meta = catalog.lines[line];
    if (!meta) return;
    element.style.setProperty('--line-accent', meta.accent);
    element.style.setProperty('--line-wash', meta.wash);
    element.style.setProperty('--line-ink', meta.ink);
  }

  function setLineNavCurrent(line) {
    [...elements.lineNavigation.querySelectorAll('.line-nav-button')].forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.line === line));
    });
  }

  function createTagList(tags, className = '') {
    const wrapper = document.createElement('div');
    if (className) wrapper.className = className;
    (tags || []).forEach((tag) => {
      const item = document.createElement('span');
      item.textContent = tag;
      wrapper.append(item);
    });
    return wrapper;
  }

  function buildMenu() {
    if (menuRendered) return;

    const navigationFragment = document.createDocumentFragment();
    const sectionFragment = document.createDocumentFragment();

    lineOrder.forEach((line, index) => {
      const meta = catalog.lines[line];
      const products = catalog.products[line] || [];

      const navButton = document.createElement('button');
      navButton.type = 'button';
      navButton.className = 'line-nav-button';
      navButton.dataset.line = line;
      navButton.style.setProperty('--nav-accent', meta.accent);
      navButton.innerHTML = `<b lang="en" dir="ltr">${meta.name}</b>${meta.fa}`;
      navButton.addEventListener('click', () => {
        const section = document.getElementById(`line-${line}`);
        section?.scrollIntoView({ behavior: reduceMotionQuery.matches ? 'auto' : 'smooth', block: 'start' });
        setLineNavCurrent(line);
      });
      navigationFragment.append(navButton);

      const section = document.createElement('section');
      section.className = 'menu-line';
      section.id = `line-${line}`;
      section.dataset.line = line;
      section.setAttribute('aria-labelledby', `line-title-${line}`);
      lineStyles(section, line);

      const header = document.createElement('header');
      header.className = 'menu-line__header';

      const number = document.createElement('span');
      number.className = 'menu-line__number';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');

      const title = document.createElement('div');
      title.className = 'menu-line__title';
      const englishHeading = document.createElement('h3');
      englishHeading.id = `line-title-${line}`;
      englishHeading.lang = 'en';
      englishHeading.dir = 'ltr';
      englishHeading.textContent = meta.name;
      const persianTitle = document.createElement('span');
      persianTitle.textContent = meta.fa;
      title.append(englishHeading, persianTitle);

      const intro = document.createElement('p');
      intro.textContent = meta.intro;
      header.append(number, title, intro);

      const grid = document.createElement('div');
      grid.className = 'product-grid';

      products.forEach((product) => {
        const article = document.createElement('article');
        article.className = 'product-card';
        article.dataset.code = product.code;

        const media = document.createElement('div');
        media.className = 'product-card__media';
        const image = document.createElement('img');
        image.width = 512;
        image.height = 512;
        image.loading = 'lazy';
        image.decoding = 'async';
        setProductImage(image, product.image, product.name);
        const code = document.createElement('span');
        code.className = 'product-card__code';
        code.lang = 'en';
        code.dir = 'ltr';
        code.textContent = product.code;
        media.append(image, code);

        const body = document.createElement('div');
        body.className = 'product-card__body';
        const topLine = document.createElement('div');
        topLine.className = 'product-card__topline';
        const name = document.createElement('h4');
        name.textContent = product.name;
        const price = document.createElement('span');
        price.className = 'product-card__price';
        price.textContent = formatPrice(product.price);
        topLine.append(name, price);

        const englishName = document.createElement('p');
        englishName.className = 'product-card__en';
        englishName.lang = 'en';
        englishName.dir = 'ltr';
        englishName.textContent = product.en;

        const mood = document.createElement('p');
        mood.className = 'product-card__mood';
        mood.lang = 'en';
        mood.dir = 'ltr';
        mood.textContent = product.moodEn || product.sense || meta.mood;

        const description = document.createElement('p');
        description.className = 'product-card__description';
        description.textContent = product.desc;

        const tags = createTagList(product.tags, 'product-card__tags');
        body.append(topLine, englishName, mood, description, tags);
        article.append(media, body);
        grid.append(article);
      });

      section.append(header, grid);
      sectionFragment.append(section);
    });

    elements.lineNavigation.replaceChildren(navigationFragment);
    elements.menuSections.replaceChildren(sectionFragment);
    setLineNavCurrent(lineOrder[0]);
    menuRendered = true;
    observeMenuLines();
  }

  function observeMenuLines() {
    if (!('IntersectionObserver' in window) || lineObserver) return;
    lineObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.dataset.line) setLineNavCurrent(visible.target.dataset.line);
      },
      { rootMargin: '-28% 0px -58% 0px', threshold: [0.01, 0.2, 0.5] }
    );
    document.querySelectorAll('.menu-line').forEach((section) => lineObserver.observe(section));
  }

  function resetQuizState() {
    clearPendingTimer();
    state.quizStep = 0;
    state.selectedLine = null;
    state.answers = [];
    state.result = null;
  }

  function currentQuestion() {
    if (state.quizStep === 0) return catalog.quiz.lineQuestion;
    return catalog.quiz.flavorQuestions[state.selectedLine] || null;
  }

  function answerAccent(answer) {
    return catalog.lines[answer.line]?.accent || catalog.lines.icedtea.accent;
  }

  function renderQuestion(options = {}) {
    const { push = false, replace = false } = options;
    const question = currentQuestion();
    if (!question) {
      goHome({ push: true });
      return;
    }

    const stepNumber = state.quizStep + 1;
    const selectedMeta = state.selectedLine ? catalog.lines[state.selectedLine] : null;
    elements.quizStepLabel.textContent = `سؤال ${stepNumber.toLocaleString('fa-IR')} از ۲`;
    elements.quizProgress.setAttribute('aria-valuenow', String(stepNumber));
    elements.quizProgress.setAttribute('aria-valuetext', `سؤال ${stepNumber.toLocaleString('fa-IR')} از ۲`);
    elements.quizProgressFill.style.width = `${stepNumber * 50}%`;
    elements.quizAsideLine.textContent = selectedMeta?.name || 'SUMMER PAUSE';
    elements.questionKicker.textContent = state.quizStep === 0 ? 'QUESTION 01 · FEELING' : 'QUESTION 02 · TASTE';
    elements.quizQuestion.textContent = question.text;
    elements.questionHint.textContent = state.quizStep === 0
      ? 'حسی را انتخاب کن که به همین لحظه‌ات نزدیک‌تر است.'
      : 'یکی از دو مسیر طعمی را برای کامل‌کردن انتخابت بزن.';

    const fragment = document.createDocumentFragment();
    question.answers.forEach((answer, index) => {
      const meta = catalog.lines[answer.line];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer-option';
      button.style.setProperty('--option-accent', answerAccent(answer));
      button.setAttribute('aria-label', answer.sub.trim());

      const number = document.createElement('span');
      number.className = 'answer-option__index';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');

      const line = document.createElement('span');
      line.className = 'answer-option__line';
      line.lang = 'en';
      line.dir = 'ltr';
      line.textContent = meta?.name || 'SUMMER PAUSE';

      const label = document.createElement('span');
      label.className = 'answer-option__label';
      label.textContent = answer.sub;

      const mark = document.createElement('span');
      mark.className = 'answer-option__mark';
      mark.textContent = '←';
      mark.setAttribute('aria-hidden', 'true');

      button.append(number, line, label, mark);
      button.addEventListener('click', () => selectAnswer(answer, button));
      fragment.append(button);
    });

    elements.answerGrid.replaceChildren(fragment);
    elements.quizBackButton.innerHTML = state.quizStep === 0
      ? '<span aria-hidden="true">→</span> بازگشت به صفحه اصلی'
      : '<span aria-hidden="true">→</span> سؤال قبل';

    showView('quiz');
    if (push) pushHistory();
    if (replace) replaceHistory();
  }

  function selectAnswer(answer, button) {
    if (button.disabled) return;
    [...elements.answerGrid.children].forEach((option) => {
      option.disabled = true;
      option.classList.toggle('is-selected', option === button);
    });

    const delay = reduceMotionQuery.matches ? 0 : 150;
    window.setTimeout(() => {
      state.answers = state.answers.slice(0, state.quizStep);
      state.answers[state.quizStep] = answer;

      if (state.quizStep === 0) {
        state.selectedLine = answer.line;
        state.quizStep = 1;
        renderQuestion({ push: true });
        return;
      }

      beginResult(answer);
    }, delay);
  }

  function pickSecondary(main) {
    const crossLineCandidates = allProducts.filter(
      (product) => product.line !== main.line && product.code !== main.code
    );
    if (crossLineCandidates.length) {
      return crossLineCandidates[Math.floor(Math.random() * crossLineCandidates.length)];
    }

    const sameLineCandidate = allProducts.find(
      (product) => product.line === main.line && product.code !== main.code
    );
    return sameLineCandidate || main;
  }

  function createResult(mainCode, secondaryCode = null) {
    const main = findProduct(mainCode);
    if (!main) return null;
    const requestedSecondary = secondaryCode ? findProduct(secondaryCode) : null;
    const secondary = requestedSecondary && requestedSecondary.code !== main.code
      ? requestedSecondary
      : pickSecondary(main);
    return { main, secondary };
  }

  function beginResult(answer) {
    clearPendingTimer();
    const result = createResult(answer.main);
    if (!result) {
      goHome({ push: true });
      return;
    }

    state.result = result;
    showView('pause');
    const pauseDuration = reduceMotionQuery.matches ? 120 : 760;
    state.pendingTimer = window.setTimeout(() => {
      state.pendingTimer = null;
      renderResult({ push: true });
    }, pauseDuration);
  }

  function renderResult(options = {}) {
    const { push = false, replace = false } = options;
    if (!state.result) {
      goHome({ push: true });
      return;
    }

    const { main, secondary } = state.result;
    const mainMeta = catalog.lines[main.line];
    const secondaryMeta = catalog.lines[secondary.line];
    lineStyles(elements.resultShell, main.line);
    elements.resultLineIndex.textContent = lineIndex[main.line] || '01';
    elements.resultCode.textContent = main.code;
    elements.resultLineName.textContent = mainMeta.name;
    elements.resultName.textContent = main.name;
    elements.resultEnglishName.textContent = main.en;
    elements.resultMood.textContent = main.moodEn || main.sense || mainMeta.mood;
    elements.resultDescription.textContent = main.desc;
    elements.resultPrice.textContent = formatPrice(main.price);
    setProductImage(elements.resultImage, main.image, main.name);

    const tagFragment = document.createDocumentFragment();
    (main.tags || []).forEach((tag) => {
      const item = document.createElement('span');
      item.textContent = tag;
      tagFragment.append(item);
    });
    elements.resultTags.replaceChildren(tagFragment);

    elements.secondaryCard.style.setProperty('--secondary-accent', secondaryMeta.accent);
    elements.secondaryLine.textContent = secondaryMeta.name;
    elements.secondaryName.textContent = secondary.name;
    elements.secondaryEnglishName.textContent = secondary.en;
    elements.secondaryPrice.textContent = formatPrice(secondary.price);
    setProductImage(elements.secondaryImage, secondary.image, secondary.name);

    const resultView = document.getElementById('viewResult');
    resultView.dataset.mainCode = main.code;
    resultView.dataset.secondaryCode = secondary.code;
    resultView.dataset.mainLine = main.line;

    showView('result');
    if (push) pushHistory();
    if (replace) replaceHistory();
  }

  function startQuiz(options = {}) {
    const { push = true } = options;
    resetQuizState();
    renderQuestion({ push });
  }

  function goHome(options = {}) {
    const { push = true, focus = true } = options;
    resetQuizState();
    showView('home', { focus });
    if (push) pushHistory();
    else replaceHistory();
  }

  function openMenu(trigger = document.activeElement) {
    clearPendingTimer();
    buildMenu();
    state.lastViewBeforeMenu = state.view === 'menu' ? 'home' : state.view;
    const returnTarget = trigger instanceof HTMLElement ? trigger : document.activeElement;
    state.menuReturnFocusId = returnTarget?.id || null;
    showView('menu');
    pushHistory();
  }

  function closeMenu() {
    if (state.view !== 'menu') return;
    if (history.state?.lcafe && history.state.view === 'menu' && history.length > 1) {
      history.back();
      return;
    }
    restoreFallbackView(state.lastViewBeforeMenu);
    restoreMenuFocus();
  }

  function restoreFallbackView(viewName) {
    if (viewName === 'result' && state.result) renderResult({ replace: true });
    else if (viewName === 'quiz') renderQuestion({ replace: true });
    else goHome({ push: false });
  }

  function restoreMenuFocus() {
    const targetId = state.menuReturnFocusId;
    state.menuReturnFocusId = null;
    if (!targetId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus?.({ preventScroll: true });
    });
  }

  function restoreHistory(snapshot) {
    clearPendingTimer();
    const previousView = state.view;

    if (!snapshot?.lcafe) {
      goHome({ push: false });
      return;
    }

    state.quizStep = Number(snapshot.quizStep) || 0;
    state.selectedLine = snapshot.selectedLine || null;
    state.answers = Array.isArray(snapshot.answers) ? snapshot.answers : [];
    state.result = snapshot.result
      ? createResult(snapshot.result.mainCode, snapshot.result.secondaryCode)
      : null;

    if (snapshot.view === 'result' && state.result) {
      renderResult();
    } else if (snapshot.view === 'quiz') {
      renderQuestion();
    } else if (snapshot.view === 'menu') {
      buildMenu();
      showView('menu');
    } else {
      showView('home');
    }

    if (previousView === 'menu' && snapshot.view !== 'menu') {
      restoreMenuFocus();
    }
  }

  function handleQuizBack() {
    if (state.quizStep === 1) {
      state.quizStep = 0;
      state.selectedLine = null;
      state.answers = [];
      renderQuestion({ replace: true });
      return;
    }
    goHome({ push: true });
  }

  function bindEvents() {
    elements.startQuizButton.addEventListener('click', () => startQuiz());
    elements.homeMenuButton.addEventListener('click', (event) => openMenu(event.currentTarget));
    elements.globalMenuButton.addEventListener('click', (event) => openMenu(event.currentTarget));
    elements.homeButton.addEventListener('click', () => goHome({ push: true }));
    elements.brandButton.addEventListener('click', () => goHome({ push: true }));
    elements.quizBackButton.addEventListener('click', handleQuizBack);
    elements.restartQuizButton.addEventListener('click', () => startQuiz());
    elements.resultMenuButton.addEventListener('click', (event) => openMenu(event.currentTarget));
    elements.resultHomeButton.addEventListener('click', () => goHome({ push: true }));
    elements.menuQuizButton.addEventListener('click', () => startQuiz());
    elements.closeMenuButton.addEventListener('click', closeMenu);
    window.addEventListener('popstate', (event) => restoreHistory(event.state));
  }

  function prepareStaticImages() {
    document.querySelectorAll('.editorial-frame img').forEach((image) => {
      const originalAlt = image.alt.replace(/^تصویر\s*/, '');
      setProductImage(image, image.getAttribute('src'), originalAlt);
    });
  }

  function initialStateFromLocation() {
    const hash = location.hash;
    if (hash === '#menu') {
      buildMenu();
      showView('menu', { focus: false, speak: false, scroll: false });
      replaceHistory();
      return;
    }

    if (hash === '#quiz-1') {
      resetQuizState();
      renderQuestion({ replace: true });
      return;
    }

    showView('home', { focus: false, speak: false, scroll: false });
    replaceHistory();
  }

  function init() {
    validateCatalog();
    bindEvents();
    prepareStaticImages();
    initialStateFromLocation();
  }

  window.LCafeSummerPause = Object.freeze({
    startQuiz,
    openMenu,
    goHome,
    formatPrice,
    getState: () => historySnapshot()
  });

  init();
})();
