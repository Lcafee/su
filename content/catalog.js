/*
 * Canonical runtime content for the Summer Pause website.
 * Product names, descriptions, prices, tags, images and quiz mappings live here.
 */
window.LCAFE_CATALOG = {
  defaults: {
    image: 'assets/fallback-product.svg',
    price: '۲۲۰٬۰۰۰ تومان'
  },
  lines: {
    icedtea: {
      name: 'ICED TEA',
      fa: 'آیس‌تی',
      mood: 'Clean · Aromatic · Tea-led',
      accent: '#667168',
      wash: '#dde2d7',
      ink: '#354139',
      intro: 'شفاف، خوش‌عطر و آرام؛ برای مکث‌های سبک‌تر تابستان.'
    },
    refresher: {
      name: 'REFRESHER',
      fa: 'رفرشر',
      mood: 'Fresh · Fruity · Sparkling',
      accent: '#8a3142',
      wash: '#ead4d5',
      ink: '#5f1f2d',
      intro: 'میوه‌ای، پرطراوت و سرزنده؛ برای لحظه‌های روشن‌تر روز.'
    },
    cloudy: {
      name: 'CLOUDY',
      fa: 'کلودی',
      mood: 'Soft · Creamy · Gentle Espresso',
      accent: '#705964',
      wash: '#e5dadd',
      ink: '#4f3b44',
      intro: 'نرم، کرمی و لایه‌ای؛ یک مکث آرام با عمق اسپرسو.'
    },
    frappe: {
      name: 'FRAPPE',
      fa: 'فراپه',
      mood: 'Rich · Icy · Coffee Dessert',
      accent: '#654237',
      wash: '#dfcec2',
      ink: '#422a23',
      intro: 'یخی، غلیظ و شیرین؛ برای مکث‌هایی که کمی طولانی‌ترند.'
    }
  },
  products: {
    icedtea: [
      {
        name: 'آیس‌تی اپل پارادایس',
        en: 'Apple Paradise Iced Tea',
        code: 'IT-01',
        image: 'assets/products/it-01.jpg',
        price: '350000 تومان',
        sense: 'Clean · Crisp · Tea-led',
        moodEn: 'Clean · Crisp · Tea-led',
        desc: 'چای سرد شفاف با حس سیب تازه؛ انتخابی سبک، روشن و خوش‌عطر برای وقتی که نوشیدنی‌ای خنک و ساده می‌خوای.',
        tags: ['سیب', 'شفاف', 'باغ تابستانی']
      },
      {
        name: 'آیس‌تی پیچ بلک',
        en: 'Peach Black Tea Iced',
        code: 'IT-02',
        image: 'assets/products/it-02.jpg',
        price: '350000 تومان',
        sense: 'Fruity · Balanced · Tea-led',
        moodEn: 'Fruity · Balanced · Tea-led',
        desc: 'ترکیب چای سرد سیاه و هلو با بافتی خنک و طعمی آشنا؛ انتخابی خوش‌عطر، متعادل و تابستانی برای کسانی که نوشیدنی‌ای امن و دلنشین میخواهند.',
        tags: ['هلویی', 'تابستان گرم', 'متعادل']
      }
    ],
    refresher: [
      {
        name: 'رفرشر انبه و شاهتوت',
        en: 'Mango & Blackberry Refresher',
        code: 'RF-02',
        image: 'assets/products/rf-02.jpg',
        price: '320000 تومان',
        sense: 'Tropical · Fruity · Sparkling',
        moodEn: 'Tropical · Fruity · Sparkling',
        desc: 'ترکیب انبه و شاهتوت با سودا؛ نوشیدنی‌ای ملس، خنک و سرزنده با طعمی میوه‌ای، مناسب روزهای گرم و لحظه‌هایی که دنبال یک انتخاب شاد تر هستی.',
        tags: ['ملس', 'انبه', 'استوایی']
      },
      {
        name: 'رفرشر جینجر بیزل',
        en: 'Ginger Basil Refresher',
        code: 'RF-03',
        image: 'assets/products/rf-03.jpg',
        price: '320000 تومان',
        sense: 'Refresh · Ginger · Sparkling',
        moodEn: 'Refresh · Ginger · Sparkling',
        desc: 'ترکیب زنجبیل و ریحان ایتالیایی با سودا؛ ترکیبی تازه، طبیعی و متفاوت با تندی ملایم و طعمی سرزنده، برای کسانی که دنبال نوشیدنی‌ای خاص‌تر و خنک‌تر هستند.',
        tags: ['ریحان', 'زنجبیل', 'تازه']
      }
    ],
    cloudy: [
      {
        name: 'کلودی پسته',
        en: 'Pistachio Cloudy',
        code: 'CL-01',
        image: 'assets/products/cl-01.jpg',
        price: '430000 تومان',
        sense: 'Soft · Creamy · Gentle Espresso',
        moodEn: 'Soft · Creamy · Gentle Espresso',
        desc: 'کلودی پسته با بافتی نرم و کرمی؛ ترکیبی از طعم اصیل پسته و حضور ملایم اسپرسو که به نوشیدنی عمق، تعادل و لطافتی آرام می‌دهد.',
        tags: ['پسته', 'کرمی', 'اسپرسو آرام']
      },
      {
        name: 'کلودی کوکی',
        en: 'Cookie Cloudy',
        code: 'CL-03',
        image: 'assets/products/cl-03.jpg',
        price: '430000 تومان',
        sense: 'Sweet · Creamy · Espresso Dessert',
        moodEn: 'Sweet · Creamy · Espresso Dessert',
        desc: 'انتخابی نرم، شیرین و کرمی، با طعم کوکی در مرکز و اسپرسویی ملایم در پس‌زمینه که به نوشیدنی عمق می‌دهد.',
        tags: ['کوکی', 'کرمی', 'اسپرسو آرام']
      }
    ],
    frappe: [
      {
        name: 'فراپه کارامل نمکی',
        en: 'Salted Caramel Frappe',
        code: 'FR-01',
        image: 'assets/products/fr-01.jpg',
        price: '370000 تومان',
        sense: 'Rich · Icy · Coffee Caramel',
        moodEn: 'Rich · Icy · Coffee Caramel',
        desc: 'نوشیدنی ای کرمی و یخی با ترکیب کارامل شیرین‌وشور و پایه قهوه، انتخابی کلاسیک، هارمونیک و لذت‌بخش.',
        tags: ['کارامل نمکی', 'شیرین', 'کلاسیک']
      },
      {
        name: 'فراپه ارده',
        en: 'Tahini Frappe',
        code: 'FR-02',
        image: 'assets/products/fr-02.jpg',
        price: '370000 تومان',
        sense: 'Nutty · Deep · Coffee Dessert',
        moodEn: 'Nutty · Deep · Coffee Dessert',
        desc: 'با شخصیتی متناقض میان یخ و آتش، ترکیبی از بافت یخی و طعم گرم و عمیق ارده است؛ متفاوت و مناسب کسانی که دنبال انتخابی خاص‌تر از طعم ‌های کلاسیک هستند.',
        tags: ['ارده', 'اسپرسو', 'ژلاتو']
      }
    ]
  },
  quiz: {
    lineQuestion: {
      text: 'الان از نوشیدنی‌ات چه جور حسی می‌خوای؟',
      answers: [
        { sub: 'خوش عطر و شفاف', line: 'icedtea' },
        { sub: 'میوه ای و سرزنده', line: 'refresher' },
        { sub: 'ابری و لطیف', line: 'cloudy' },
        { sub: 'برفی و شیرین', line: 'frappe' }
      ]
    },
    flavorQuestions: {
      icedtea: {
        text: 'این حس خوش عطر چه نوتی داشته باشه؟',
        answers: [
          { sub: ' آرام و گرم', line: 'icedtea', main: 'IT-01', alt: 'IT-02' },
          { sub: 'پرانرژی و ملس', line: 'icedtea', main: 'IT-02', alt: 'IT-01' }
        ]
      },
      refresher: {
        text: 'این حس میوه ای چه نوتی داشته باشه؟',
        answers: [
          { sub: 'پرطراوت و استوایی ', line: 'refresher', main: 'RF-02', alt: 'RF-03' },
          { sub: 'معطر و متفاوت', line: 'refresher', main: 'RF-03', alt: 'RF-02' }
        ]
      },
      cloudy: {
        text: 'این حس ابری چه نوتی داشته باشه؟',
        answers: [
          { sub: 'لوکس و اصیل', line: 'cloudy', main: 'CL-01', alt: 'CL-03' },
          { sub: 'تضاد لطافت و تردی ', line: 'cloudy', main: 'CL-03', alt: 'CL-01' }
        ]
      },
      frappe: {
        text: 'این حس برفی چه نوتی داشته باشه؟',
        answers: [
          { sub: ' هارمونیک و آشنا', line: 'frappe', main: 'FR-01', alt: 'FR-02' },
          { sub: 'گرم و جنوبی', line: 'frappe', main: 'FR-02', alt: 'FR-01' }
        ]
      }
    }
  }
};
