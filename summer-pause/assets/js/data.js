"use strict";

const CAFE_LINES = {
  herbaltea: {
    key: "herbaltea",
    name: "HERBAL TEA",
    fa: "هربال‌تی",
    number: "01",
    caption: "CLEAR · AROMATIC · TEA-LED",
    intro: "شفاف، خوش‌عطر و روشن؛ برای مکث‌هایی که باید سبک بمانند.",
    claim: "بدون هرگونه سیروپ و طعم‌دهندهٔ مصنوعی",
    accent: "#e2a13b",
    ink: "#4a0b18"
  },
  refresher: {
    key: "refresher",
    name: "REFRESHER",
    fa: "رفرشر",
    number: "02",
    caption: "FRUITY · BRIGHT · SPARKLING",
    intro: "میوه‌ای، گازدار و سرزنده؛ برای لحظه‌هایی که انرژی تازه می‌خواهند.",
    claim: "بدون هرگونه سیروپ و طعم‌دهندهٔ مصنوعی",
    accent: "#b44c5b",
    ink: "#45101a"
  },
  cloudy: {
    key: "cloudy",
    name: "CLOUDY",
    fa: "کلودی",
    number: "03",
    caption: "SOFT · CREAMY · LAYERED",
    intro: "ابری، کرمی و آرام؛ با لایه‌هایی که آهسته خودشان را نشان می‌دهند.",
    accent: "#a9aa62",
    ink: "#3a251f"
  },
  frappe: {
    key: "frappe",
    name: "FRAPPE",
    fa: "فراپه",
    number: "04",
    caption: "ICY · RICH · COFFEE DESSERT",
    intro: "برفی، غلیظ و لذت‌بخش؛ یک دسر سرد برای مکث‌های طولانی‌تر.",
    accent: "#ba8764",
    ink: "#351a16"
  }
};

const CAFE_PRODUCTS = [
  {
    code: "IT-01", line: "herbaltea", name: "هربال‌تی اپل پارادایس", en: "Apple Paradise Herbal Tea",
    image: "assets/images/it-01.webp", price: 350000, mood: "Clean · Crisp · Tea-led",
    description: "چای سرد شفاف با حس سیب تازه؛ انتخابی سبک، روشن و خوش‌عطر برای وقتی که نوشیدنی‌ای خنک و ساده می‌خوای.",
    tags: ["سیب", "شفاف", "باغ تابستانی"]
  },
  {
    code: "IT-02", line: "herbaltea", name: "هربال‌تی پیچ بلک", en: "Peach Black Herbal Tea",
    image: "assets/images/it-02.webp", price: 350000, mood: "Fruity · Balanced · Tea-led",
    description: "ترکیب چای سرد سیاه و هلو با بافتی خنک و طعمی آشنا؛ انتخابی خوش‌عطر، متعادل و تابستانی برای کسانی که نوشیدنی‌ای امن و دلنشین می‌خواهند.",
    tags: ["هلویی", "تابستان گرم", "متعادل"]
  },
  {
    code: "RF-01", line: "refresher", name: "رفرشر توت‌فرنگی و گیلاس", en: "Strawberry & Cherry Refresher",
    image: "assets/images/rf-01.webp", price: 320000, mood: "Berry · Tart · Sparkling",
    description: "ترکیب توت‌فرنگی و گیلاس با سودا؛ نوشیدنی‌ای ملس، میوه‌ای و پرطراوت با رنگی درخشان، برای روزهای گرم و لحظه‌هایی که یک خنکی شاد و سرزنده می‌خواهی.",
    tags: ["توت‌فرنگی", "گیلاس", "ملس"]
  },
  {
    code: "RF-02", line: "refresher", name: "رفرشر انبه و شاهتوت", en: "Mango & Blackberry Refresher",
    image: "assets/images/rf-02.webp", price: 320000, mood: "Tropical · Fruity · Sparkling",
    description: "ترکیب انبه و شاهتوت با سودا؛ نوشیدنی‌ای ملس، خنک و سرزنده با طعمی میوه‌ای، مناسب روزهای گرم و لحظه‌هایی که دنبال یک انتخاب شادتر هستی.",
    tags: ["ملس", "انبه", "استوایی"]
  },
  {
    code: "RF-03", line: "refresher", name: "رفرشر جینجر بیزل", en: "Ginger Basil Refresher",
    image: "assets/images/rf-03.webp", price: 320000, mood: "Refresh · Ginger · Sparkling",
    description: "ترکیب زنجبیل و ریحان ایتالیایی با سودا؛ ترکیبی تازه، طبیعی و متفاوت با تندی ملایم و طعمی سرزنده، برای کسانی که دنبال نوشیدنی‌ای خاص‌تر و خنک‌تر هستند.",
    tags: ["ریحان", "زنجبیل", "تازه"]
  },
  {
    code: "CL-01", line: "cloudy", name: "کلودی پسته", en: "Pistachio Cloudy",
    image: "assets/images/cl-01.webp", price: 430000, mood: "Soft · Creamy · Gentle Espresso",
    description: "کلودی پسته با بافتی نرم و کرمی؛ ترکیبی از طعم اصیل پسته و حضور ملایم اسپرسو که به نوشیدنی عمق، تعادل و لطافتی آرام می‌دهد.",
    tags: ["پسته", "کرمی", "اسپرسو آرام"]
  },
  {
    code: "CL-02", line: "cloudy", name: "کلودی زعفران", en: "Saffron Cloudy",
    image: "assets/images/cl-02.webp", price: 430000, mood: "Golden · Creamy · Gentle Espresso",
    description: "کلودی زعفران با لایه‌ای نرم و کرمی از زعفران؛ ترکیبی لوکس و طلایی با حضور ملایم اسپرسو که طعمی گرم، لطیف و متعادل می‌سازد.",
    tags: ["زعفران", "کرمی", "اسپرسو آرام"]
  },
  {
    code: "CL-03", line: "cloudy", name: "کلودی کوکی", en: "Cookie Cloudy",
    image: "assets/images/cl-03.webp", price: 430000, mood: "Sweet · Creamy · Espresso Dessert",
    description: "انتخابی نرم، شیرین و کرمی، با طعم کوکی در مرکز و اسپرسویی ملایم در پس‌زمینه که به نوشیدنی عمق می‌دهد.",
    tags: ["کوکی", "کرمی", "اسپرسو آرام"]
  },
  {
    code: "FR-01", line: "frappe", name: "فراپه کارامل نمکی", en: "Salted Caramel Frappe",
    image: "assets/images/fr-01.webp", price: 370000, mood: "Rich · Icy · Coffee Caramel",
    description: "نوشیدنی‌ای کرمی و یخی با ترکیب کارامل شیرین‌وشور و پایه قهوه، انتخابی کلاسیک، هارمونیک و لذت‌بخش.",
    tags: ["کارامل نمکی", "شیرین", "کلاسیک"]
  },
  {
    code: "FR-02", line: "frappe", name: "فراپه ارده", en: "Tahini Frappe",
    image: "assets/images/fr-02.webp", price: 370000, mood: "Nutty · Deep · Coffee Dessert",
    description: "با شخصیتی متناقض میان یخ و آتش، ترکیبی از بافت یخی و طعم گرم و عمیق ارده است؛ متفاوت و مناسب کسانی که دنبال انتخابی خاص‌تر از طعم‌های کلاسیک هستند.",
    tags: ["ارده", "اسپرسو", "ژلاتو"]
  }
];

const QUIZ_CONTENT = {
  first: {
    caption: "CHOOSE THE FEELING",
    question: "الان از نوشیدنی‌ات چه جور حسی می‌خوای؟",
    answers: [
      { label: "متفاوت و شفاف", line: "herbaltea" },
      { label: "میوه‌ای و سرزنده", line: "refresher" },
      { label: "ابری و لطیف", line: "cloudy" },
      { label: "برفی و شیرین", line: "frappe" }
    ]
  },
  second: {
    herbaltea: {
      caption: "CHOOSE THE NOTE",
      question: "این حس خوش‌عطر چه نوتی داشته باشه؟",
      answers: [
        { label: "آرام و شیرین", resultCode: "IT-01" },
        { label: "پرانرژی و گس", resultCode: "IT-02" }
      ]
    },
    refresher: {
      caption: "CHOOSE THE NOTE",
      question: "این حس میوه‌ای چه نوتی داشته باشه؟",
      answers: [
        { label: "ترش‌وشیرین و درخشان", resultCode: "RF-01" },
        { label: "پرطراوت و استوایی", resultCode: "RF-02" },
        { label: "معطر و متفاوت", resultCode: "RF-03" }
      ]
    },
    cloudy: {
      caption: "CHOOSE THE NOTE",
      question: "این حس ابری چه نوتی داشته باشه؟",
      answers: [
        { label: "لوکس و اصیل", resultCode: "CL-01" },
        { label: "ایرانی و طلایی", resultCode: "CL-02" },
        { label: "تضاد لطافت و تردی", resultCode: "CL-03" }
      ]
    },
    frappe: {
      caption: "CHOOSE THE NOTE",
      question: "این حس برفی چه نوتی داشته باشه؟",
      answers: [
        { label: "هارمونیک و آشنا", resultCode: "FR-01" },
        { label: "گرم و جنوبی", resultCode: "FR-02" }
      ]
    }
  }
};

const DEFAULT_PRODUCT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 720'%3E%3Crect width='720' height='720' fill='%234a0b18'/%3E%3Ccircle cx='360' cy='330' r='214' fill='%23efe8dc'/%3E%3Cpath d='M250 260h220l-32 230c-4 28-28 50-56 50h-44c-28 0-52-22-56-50l-32-230Z' fill='%23d8c7b8'/%3E%3Cpath d='M286 332c45 23 103 23 148 0' fill='none' stroke='%234a0b18' stroke-width='14' stroke-linecap='round'/%3E%3Ctext x='360' y='635' text-anchor='middle' font-family='Arial,sans-serif' font-size='34' letter-spacing='6' fill='%23efe8dc'%3EL CAFE%3C/text%3E%3C/svg%3E";
const DEFAULT_PRODUCT_PRICE = 220000;
