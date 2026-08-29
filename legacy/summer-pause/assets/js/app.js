"use strict";

(() => {
  const state = {
    currentScreen: "menuScreen",
    quizStep: 1,
    selectedLine: null,
    resultCode: null,
    previousScreenBeforeMenu: "menuScreen",
    transitioning: false,
    screenTransitioning: false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  };

  const elements = {
    screens: [...document.querySelectorAll(".screen")],
    homeScreen: document.getElementById("homeScreen"),
    quizScreen: document.getElementById("quizScreen"),
    revealScreen: document.getElementById("revealScreen"),
    resultScreen: document.getElementById("resultScreen"),
    menuScreen: document.getElementById("menuScreen"),
    homeBackdrop: document.querySelector(".home-backdrop"),
    quizScene: document.querySelector(".quiz-scene"),
    menuCoverGallery: document.querySelector(".menu-cover-gallery"),
    homeShowcaseImages: [document.getElementById("homeImageA"), document.getElementById("homeImageB"), document.getElementById("homeImageC")],
    menuCoverImages: [document.getElementById("menuCoverImageA"), document.getElementById("menuCoverImageB"), document.getElementById("menuCoverImageC")],
    startQuizButton: document.getElementById("startQuizButton"),
    openMenuButton: document.getElementById("openMenuButton"),
    quizBackButton: document.getElementById("quizBackButton"),
    questionCaption: document.getElementById("questionCaption"),
    questionTitle: document.getElementById("questionTitle"),
    answerList: document.getElementById("answerList"),
    stepCurrent: document.getElementById("stepCurrent"),
    stepIndicator: document.querySelector(".step-indicator"),
    quizSceneImageA: document.getElementById("quizSceneImageA"),
    quizSceneImageB: document.getElementById("quizSceneImageB"),
    revealImage: document.getElementById("revealImage"),
    revealTitle: document.getElementById("revealTitle"),
    resultHomeButton: document.getElementById("resultHomeButton"),
    resultImage: document.getElementById("resultImage"),
    resultLineEn: document.getElementById("resultLineEn"),
    resultName: document.getElementById("resultName"),
    resultNameEn: document.getElementById("resultNameEn"),
    resultPrice: document.getElementById("resultPrice"),
    resultDescription: document.getElementById("resultDescription"),
    resultTags: document.getElementById("resultTags"),
    resultMood: document.getElementById("resultMood"),
    encoreImage: document.getElementById("encoreImage"),
    encoreLine: document.getElementById("encoreLine"),
    encoreName: document.getElementById("encoreName"),
    encoreNameEn: document.getElementById("encoreNameEn"),
    encorePrice: document.getElementById("encorePrice"),
    restartQuizButton: document.getElementById("restartQuizButton"),
    resultMenuButton: document.getElementById("resultMenuButton"),
    closeMenuButton: document.getElementById("closeMenuButton"),
    menuTitle: document.getElementById("menuTitle"),
    menuChapters: document.getElementById("menuChapters"),
    menuQuizButtonTop: document.getElementById("menuQuizButtonTop"),
    menuQuizButton: document.getElementById("menuQuizButton"),
    screenReaderStatus: document.getElementById("screenReaderStatus")
  };

  const productByCode = new Map(CAFE_PRODUCTS.map(product => [product.code, product]));
  const productsByLine = {};
  Object.keys(CAFE_LINES).forEach(lineKey => {
    productsByLine[lineKey] = CAFE_PRODUCTS.filter(product => product.line === lineKey);
  });
  const priceFormatter = new Intl.NumberFormat("en-US");
  let announceTimer = 0;
  let transitionTimer = 0;
  let revealTimer = 0;
  let screenExitTimer = 0;
  let screenUnlockTimer = 0;
  let menuBuilt = false;
  const warmedImageSources = new Set();
  const SCREEN_EXIT_DURATION = 420;
  const SCREEN_ENTER_DURATION = 560;
  const INITIAL_HERO_CODE = "IT-01";
  const RESPONSIVE_IMAGE_PATTERN = /\.webp$/i;

  function toPersianDigits(value) {
    return String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function formatPrice(value) {
    const hasPrice = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    const numericValue = hasPrice ? Number(value) : DEFAULT_PRODUCT_PRICE;
    return `${toPersianDigits(priceFormatter.format(numericValue)).replace(/,/g, "٬")} تومان`;
  }

  function setImage(imageElement, source, altText) {
    const nextSource = source || DEFAULT_PRODUCT_IMAGE;
    imageElement.onerror = () => {
      imageElement.onerror = null;
      imageElement.removeAttribute("srcset");
      imageElement.src = DEFAULT_PRODUCT_IMAGE;
    };

    if (RESPONSIVE_IMAGE_PATTERN.test(nextSource)) {
      const baseSource = nextSource.replace(RESPONSIVE_IMAGE_PATTERN, "");
      const nextSrcset = `${baseSource}-640.webp 640w, ${baseSource}-960.webp 960w, ${nextSource} 1254w`;
      if (imageElement.getAttribute("srcset") !== nextSrcset) imageElement.srcset = nextSrcset;
    } else {
      imageElement.removeAttribute("srcset");
    }

    if (imageElement.getAttribute("src") !== nextSource) imageElement.src = nextSource;
    imageElement.alt = altText !== undefined && altText !== null ? altText : "تصویر نوشیدنی L Cafe";
  }

  function warmImage(source) {
    if (!source || warmedImageSources.has(source)) return;
    warmedImageSources.add(source);
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.sizes = "(max-width: 480px) 100vw, 480px";
    if (RESPONSIVE_IMAGE_PATTERN.test(source)) {
      const baseSource = source.replace(RESPONSIVE_IMAGE_PATTERN, "");
      image.srcset = `${baseSource}-640.webp 640w, ${baseSource}-960.webp 960w, ${source} 1254w`;
    }
    image.src = source;
    if (typeof image.decode === "function") image.decode().catch(() => {});
  }

  function randomProducts(count) {
    const linePools = Object.values(productsByLine);
    for (let index = linePools.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [linePools[index], linePools[randomIndex]] = [linePools[randomIndex], linePools[index]];
    }
    return linePools.slice(0, count).map(lineProducts => lineProducts[Math.floor(Math.random() * lineProducts.length)]);
  }

  function renderRandomShowcase(imageElements) {
    randomProducts(imageElements.length).forEach((product, index) => {
      const image = imageElements[index];
      image.loading = index === 0 ? "eager" : "lazy";
      if ("fetchPriority" in image) image.fetchPriority = index === 0 ? "high" : "low";
      setImage(image, product.image, "");
    });
  }

  function renderInitialShowcase() {
    const hero = productByCode.get(INITIAL_HERO_CODE) || CAFE_PRODUCTS[0];
    const supportingProducts = randomProducts(3).filter(product => product.code !== hero.code).slice(0, 2);
    setImage(elements.menuCoverImages[0], hero.image, "");
    supportingProducts.forEach((product, index) => setImage(elements.menuCoverImages[index + 1], product.image, ""));
  }

  function deferNonCriticalWork(callback) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout: 1800 });
      return;
    }
    window.setTimeout(callback, 800);
  }

  function initMotionBudget() {
    if (state.reducedMotion || !("IntersectionObserver" in window)) return;
    const motionRegions = [elements.homeBackdrop, elements.quizScene, elements.menuCoverGallery].filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle("is-motion-paused", !entry.isIntersecting));
    }, { rootMargin: "80px" });
    motionRegions.forEach(region => observer.observe(region));
    document.addEventListener("visibilitychange", () => {
      document.documentElement.classList.toggle("is-document-hidden", document.hidden);
    }, { passive: true });
  }

  function announce(message) {
    window.clearTimeout(announceTimer);
    elements.screenReaderStatus.textContent = "";
    announceTimer = window.setTimeout(() => { elements.screenReaderStatus.textContent = message; }, 20);
  }

  function cancelPendingFlow() {
    window.clearTimeout(transitionTimer);
    window.clearTimeout(revealTimer);
    transitionTimer = 0;
    revealTimer = 0;
    state.transitioning = false;
  }

  function scheduleTransition(callback, delay) {
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      callback();
    }, delay);
  }

  function showScreen(screenId, focusTarget, { forceTransition = false } = {}) {
    const nextScreen = elements.screens.find(screen => screen.id === screenId);
    const currentScreen = elements.screens.find(screen => !screen.hidden);
    if (!nextScreen) return;

    const focusNextScreen = () => {
      if (focusTarget) window.setTimeout(() => focusTarget.focus({ preventScroll: true }), state.reducedMotion ? 0 : 80);
    };

    const activateNextScreen = () => {
      elements.screens.forEach(screen => {
        const active = screen === nextScreen;
        screen.hidden = !active;
        screen.classList.remove("is-active", "is-leaving");
        screen.setAttribute("aria-hidden", String(!active));
      });
      window.scrollTo({ top: 0, behavior: "auto" });
      nextScreen.hidden = false;
      void nextScreen.offsetWidth;
      nextScreen.classList.add("is-active");
      state.currentScreen = screenId;
      focusNextScreen();

      window.clearTimeout(screenUnlockTimer);
      screenUnlockTimer = window.setTimeout(() => {
        screenUnlockTimer = 0;
        state.screenTransitioning = false;
        document.documentElement.classList.remove("is-screen-transitioning");
      }, state.reducedMotion ? 0 : SCREEN_ENTER_DURATION);
    };

    window.clearTimeout(screenExitTimer);
    window.clearTimeout(screenUnlockTimer);

    if (!currentScreen || state.reducedMotion) {
      activateNextScreen();
      return;
    }

    if (currentScreen === nextScreen && !forceTransition) {
      activateNextScreen();
      return;
    }

    state.screenTransitioning = true;
    document.documentElement.classList.add("is-screen-transitioning");
    currentScreen.classList.remove("is-active");
    currentScreen.classList.add("is-leaving");
    screenExitTimer = window.setTimeout(() => {
      screenExitTimer = 0;
      activateNextScreen();
    }, SCREEN_EXIT_DURATION);
  }

  function renderQuizStep(withTransition = false) {
    state.transitioning = false;
    const firstStep = state.quizStep === 1;
    const content = firstStep ? QUIZ_CONTENT.first : QUIZ_CONTENT.second[state.selectedLine];
    elements.questionCaption.textContent = content.caption;
    elements.questionTitle.textContent = content.question;
    elements.stepCurrent.textContent = firstStep ? "01" : "02";
    elements.stepIndicator.setAttribute("aria-valuenow", String(state.quizStep));
    elements.quizBackButton.setAttribute("aria-label", firstStep ? "بازگشت به صفحه اول" : "بازگشت به سؤال اول");
    elements.answerList.replaceChildren();

    content.answers.forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";
      button.innerHTML = `<span class="answer-number" aria-hidden="true">0${index + 1}</span><span class="answer-label">${answer.label}</span><span class="answer-arrow" aria-hidden="true">←</span>`;
      button.addEventListener("click", () => selectAnswer(answer, button));
      elements.answerList.append(button);
    });

    updateQuizScene();
    showScreen("quizScreen", elements.questionTitle, { forceTransition: withTransition });
    announce(`مرحله ${toPersianDigits(state.quizStep)} از ۲. ${content.question}`);
  }

  function updateQuizScene() {
    if (state.quizStep === 1) {
      const [firstProduct, secondProduct] = randomProducts(2);
      setImage(elements.quizSceneImageA, firstProduct.image, "");
      setImage(elements.quizSceneImageB, secondProduct.image, "");
      return;
    }
    const lineProducts = productsByLine[state.selectedLine];
    setImage(elements.quizSceneImageA, lineProducts[0].image, "");
    setImage(elements.quizSceneImageB, lineProducts[1].image, "");
  }

  function selectAnswer(answer, button) {
    if (state.transitioning) return;
    state.transitioning = true;
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
    if (state.quizStep === 1) {
      state.selectedLine = answer.line;
      state.quizStep = 2;
      productsByLine[answer.line].forEach(product => warmImage(product.image));
      scheduleTransition(() => renderQuizStep(true), state.reducedMotion ? 0 : 170);
      return;
    }
    state.resultCode = answer.resultCode;
    warmImage(productByCode.get(answer.resultCode)?.image);
    scheduleTransition(() => revealResult(answer.resultCode), state.reducedMotion ? 0 : 170);
  }

  function startQuiz() {
    if (state.screenTransitioning) return;
    cancelPendingFlow();
    state.quizStep = 1;
    state.selectedLine = null;
    state.resultCode = null;
    renderQuizStep();
  }

  function goBackFromQuiz() {
    if (state.screenTransitioning) return;
    cancelPendingFlow();
    if (state.quizStep === 2) {
      state.quizStep = 1;
      state.selectedLine = null;
      renderQuizStep();
    } else {
      showMenuHome();
    }
  }

  function randomEncore(mainCode) {
    const mainProduct = productByCode.get(mainCode);
    const mainLine = mainProduct ? mainProduct.line : null;
    const alternatives = CAFE_PRODUCTS.filter(product => product.code !== mainCode && product.line !== mainLine);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  function revealResult(code) {
    const product = productByCode.get(code);
    if (!product) {
      state.transitioning = false;
      return;
    }
    setImage(elements.revealImage, product.image, "");
    showScreen("revealScreen", elements.revealTitle);
    announce("در حال نمایش نتیجه شما");
    const revealDuration = state.reducedMotion ? 80 : 760;
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      revealTimer = 0;
      renderResult(product);
    }, revealDuration);
  }

  function renderResult(product) {
    state.transitioning = false;
    const line = CAFE_LINES[product.line];
    const encore = randomEncore(product.code);
    const encoreLine = CAFE_LINES[encore.line];

    document.documentElement.style.setProperty("--result-accent", line.accent);
    document.documentElement.style.setProperty("--result-ink", line.ink);
    elements.resultScreen.dataset.line = product.line;
    elements.resultScreen.dataset.productCode = product.code;
    setImage(elements.resultImage, product.image, `تصویر ${product.name}`);
    elements.resultLineEn.textContent = line.name;
    elements.resultName.textContent = product.name;
    elements.resultNameEn.textContent = product.en;
    elements.resultPrice.textContent = formatPrice(product.price);
    elements.resultDescription.textContent = product.description;
    elements.resultMood.textContent = product.mood;
    elements.resultTags.replaceChildren(...product.tags.map(tag => {
      const item = document.createElement("li");
      item.textContent = tag;
      return item;
    }));

    elements.encoreImage.dataset.productCode = encore.code;
    setImage(elements.encoreImage, encore.image, `تصویر ${encore.name}`);
    elements.encoreLine.textContent = encoreLine.fa;
    elements.encoreName.textContent = encore.name;
    elements.encoreNameEn.textContent = encore.en;
    elements.encorePrice.textContent = formatPrice(encore.price);

    showScreen("resultScreen", elements.resultName);
    announce(`نتیجه شما: ${product.name}. پیشنهاد دوم تصادفی: ${encore.name}.`);
  }

  function buildMenu() {
    const fragment = document.createDocumentFragment();
    Object.values(CAFE_LINES).forEach(line => {
      const chapter = document.createElement("section");
      chapter.className = `menu-chapter menu-chapter--${line.key}`;
      chapter.id = `chapter-${line.key}`;
      chapter.dataset.line = line.key;
      chapter.style.setProperty("--chapter-accent", line.accent);
      chapter.style.setProperty("--chapter-ink", line.ink);
      const chapterTitle = document.createElement("h2");
      chapterTitle.className = "menu-chapter-title";
      chapterTitle.id = `chapter-title-${line.key}`;
      chapterTitle.textContent = line.fa;
      chapter.setAttribute("aria-labelledby", chapterTitle.id);
      const chapterHead = document.createElement("header");
      chapterHead.className = "menu-chapter-head";
      const chapterHeading = document.createElement("div");
      chapterHeading.className = "menu-chapter-heading";
      const chapterKicker = document.createElement("span");
      chapterKicker.className = "menu-chapter-kicker";
      chapterKicker.dir = "ltr";
      chapterKicker.textContent = line.name;
      chapterHeading.append(chapterKicker, chapterTitle);
      const chapterIntro = document.createElement("p");
      chapterIntro.textContent = line.intro;
      chapterHead.append(chapterHeading, chapterIntro);
      if (line.claim) {
        const chapterClaim = document.createElement("p");
        chapterClaim.className = "menu-chapter-claim";
        chapterClaim.textContent = line.claim;
        chapterHead.append(chapterClaim);
      }
      const productsWrap = document.createElement("div");
      productsWrap.className = "chapter-products";
      productsByLine[line.key].forEach((product, productIndex) => {
        productsWrap.append(createMenuProduct(product, productIndex));
      });
      chapter.append(chapterHead, productsWrap);
      fragment.append(chapter);
    });

    elements.menuChapters.replaceChildren(fragment);
  }

  function createMenuProduct(product, index) {
    const article = document.createElement("article");
    article.className = `menu-product${index % 2 ? " menu-product--reverse" : ""}`;
    article.dataset.code = product.code;

    const frame = document.createElement("div");
    frame.className = "menu-product-frame";

    const figure = document.createElement("figure");
    figure.className = "menu-product-image";
    const image = document.createElement("img");
    image.width = 1254;
    image.height = 1254;
    image.sizes = "(max-width: 480px) calc(100vw - 34px), 446px";
    image.loading = "lazy";
    if ("fetchPriority" in image) image.fetchPriority = "low";
    image.decoding = "async";
    setImage(image, product.image, `تصویر ${product.name}`);
    figure.append(image);

    const price = document.createElement("strong");
    price.className = "menu-product-price";
    price.textContent = formatPrice(product.price);
    frame.append(figure);

    const content = document.createElement("div");
    content.className = "menu-product-copy";
    content.innerHTML = `<h3>${product.name}</h3><p class="menu-product-en" dir="ltr">${product.en}</p><p class="menu-product-description">${product.description}</p><ul class="menu-product-tags">${product.tags.map(tag => `<li>${tag}</li>`).join("")}</ul>`;

    const heading = document.createElement("div");
    heading.className = "menu-product-heading";
    const title = content.querySelector("h3");
    title.before(heading);
    heading.append(title);

    const meta = document.createElement("div");
    meta.className = "menu-product-meta";
    const tags = content.querySelector(".menu-product-tags");
    tags.before(meta);
    meta.append(tags, price);

    article.append(frame, content);
    return article;
  }

  function ensureMenuBuilt() {
    if (menuBuilt) return;
    buildMenu();
    menuBuilt = true;
  }

  function openMenu(origin = state.currentScreen) {
    if (state.screenTransitioning) return;
    ensureMenuBuilt();
    renderRandomShowcase(elements.menuCoverImages);
    state.previousScreenBeforeMenu = origin === "resultScreen" ? "resultScreen" : "menuScreen";
    elements.closeMenuButton.hidden = origin !== "resultScreen";
    showScreen("menuScreen", elements.menuTitle);
    announce("منوی کامل نوشیدنی‌های تابستانی");
  }

  function closeMenu() {
    if (state.screenTransitioning) return;
    if (state.previousScreenBeforeMenu !== "resultScreen") return;
    showScreen("resultScreen", elements.resultMenuButton);
    announce(`بازگشت به نتیجه ${elements.resultName.textContent}`);
  }

  function showMenuHome() {
    if (state.screenTransitioning) return;
    ensureMenuBuilt();
    state.previousScreenBeforeMenu = "menuScreen";
    elements.closeMenuButton.hidden = true;
    renderRandomShowcase(elements.menuCoverImages);
    showScreen("menuScreen", elements.menuTitle);
    announce("منوی کامل نوشیدنی‌های تابستانی");
  }

  function goHome() {
    if (state.screenTransitioning) return;
    cancelPendingFlow();
    showMenuHome();
  }

  function bindEvents() {
    elements.startQuizButton.addEventListener("click", startQuiz);
    elements.openMenuButton.addEventListener("click", () => openMenu("homeScreen"));
    elements.quizBackButton.addEventListener("click", goBackFromQuiz);
    elements.resultHomeButton.addEventListener("click", goHome);
    elements.restartQuizButton.addEventListener("click", startQuiz);
    elements.resultMenuButton.addEventListener("click", () => openMenu("resultScreen"));
    elements.closeMenuButton.addEventListener("click", closeMenu);
    elements.menuQuizButtonTop.addEventListener("click", startQuiz);
    elements.menuQuizButton.addEventListener("click", startQuiz);
    window.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (state.screenTransitioning) return;
      if (state.currentScreen === "menuScreen" && !elements.closeMenuButton.hidden) closeMenu();
      else if (state.currentScreen === "quizScreen") goBackFromQuiz();
      else if (state.currentScreen === "resultScreen") goHome();
    });
  }

  initMotionBudget();
  renderInitialShowcase();
  ensureMenuBuilt();
  bindEvents();
})();
