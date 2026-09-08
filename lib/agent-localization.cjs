"use strict";

const ARABIC_SCRIPT = /[\u0600-\u06ff]/g;

function detectLanguage(value) {
  const text = String(value || "");
  const arabicCount = (text.match(ARABIC_SCRIPT) || []).length;
  const letterCount = (text.match(/[A-Za-z\u0600-\u06ff]/g) || []).length;
  return arabicCount >= 2 && arabicCount / Math.max(1, letterCount) >= 0.2 ? "ar" : "en";
}

const NON_FIT_REASONS_AR = {
  careers: "قناة استفسارات دخول السوق لدى Vested KSA ليست مخصصة لطلبات التوظيف.",
  internships: "طلبات التدريب والتدريب التعاوني لا تُوجَّه إلى مسار استفسارات المشاريع.",
  "vendor-sales": "عروض الموردين وبيع الخدمات إلى Vested KSA لا تُوجَّه عبر مسار استفسارات دخول السوق.",
  "spam-or-seo-schemes": "الرسائل المزعجة وعروض الروابط المدفوعة والطلبات غير المرتبطة لا تُوجَّه إلى مسار الاستفسارات.",
  "retail-shopping": "Vested KSA ليست جهة بيع بالتجزئة أو خدمة تسوق للمستهلكين.",
  "consumer-visa": "تركز Vested KSA على دخول الشركات إلى السوق والعمليات، وليس خدمات التأشيرات الشخصية.",
  unrelated: "يقتصر مسار الاستفسارات على دخول الشركات إلى السوق السعودي وتشغيل أعمالها.",
};

function nonFitReasonArabic(id) {
  return NON_FIT_REASONS_AR[id] || "هذا الطلب خارج نطاق خدمات دخول السوق والعمليات لدى Vested KSA.";
}

const COMMON_MISSING_AR = [
  "دولة المقر والنشاط التجاري المستهدف في السعودية",
  "القطاع والعملاء المستهدفون",
  "الوضع الحالي للكيان والترخيص والتوظيف والضرائب في السعودية",
  "تاريخ الإطلاق المستهدف وأهم موعد تجاري",
  "حجم الفريق المتوقع في السنة الأولى واحتياجات تسجيل الموردين",
];

const COMMON_RISKS_AR = [
  "يجب التحقق من أهلية النشاط والملكية والترخيص والضرائب ومتطلبات القوى العاملة وفق الأنظمة والمصادر الرسمية الحالية.",
  "التسلسل المقترح إرشادي وليس استشارة قانونية أو ضريبية أو تنظيمية، ولا يضمن الموافقات أو المدد.",
];

function arabicSkillContent(skillId, fit) {
  if (skillId === "explain_non_fit_routing") {
    return {
      summary: fit.reason,
      recommendations: [
        "لا تستخدم مسار استفسارات المشاريع لدى Vested KSA لهذا الطلب.",
        "أوقف مسار المبيعات ما لم يقدّم المستخدم احتياجاً حقيقياً لشركة تدخل السوق السعودي أو تطور عملياتها فيه.",
      ],
      assumptions: ["تم التصنيف اعتماداً على نص الرسالة العامة المقدمة فقط."],
      missingInformation: [],
      risks: ["إدخال الطلبات غير المناسبة في مسار المشاريع يؤخر متابعة فرص دخول السوق الجادة."],
      nextSteps: ["إنهاء مسار الاستفسار أو طلب توضيح احتياج الشركة التجاري في السعودية."],
      sourceKeys: ["routing"],
    };
  }

  if (skillId === "explain_vested_services") {
    return {
      summary: "Vested KSA شريك لدخول السوق والعمليات في السعودية للشركات الدولية التي تحتاج إلى تنسيق التأسيس والموارد البشرية والمالية والامتثال والمرافق والجاهزية للمشتريات.",
      recommendations: [
        "ابدأ بتخطيط دخول السوق إذا لم يُحسم النشاط أو الهيكل أو الاعتماديات أو تسلسل أول 90 يوماً.",
        "استخدم مسار تشغيل متكامل عندما يجب تحريك التأسيس والموارد البشرية والمالية وجاهزية الموردين معاً.",
        "اربط نطاق العمل بالعائق التجاري الحالي بدلاً من افتراض أن كل شركة تحتاج إلى جميع الخدمات.",
      ],
      assumptions: ["الطلب يستفسر عن نطاق خدمات Vested KSA العامة ولا يطلب ضمان نتيجة تنظيمية."],
      missingInformation: COMMON_MISSING_AR,
      risks: COMMON_RISKS_AR,
      nextSteps: ["حدد مسارات الخدمة ذات الأولوية ثم قيّم الملاءمة قبل إعداد مسودة استفسار."],
      sourceKeys: ["company", "services", "capabilities"],
    };
  }

  if (skillId === "compare_entry_paths") {
    return {
      summary: "يعتمد مسار الدخول المناسب إلى السعودية على أهلية النشاط والملكية والعملاء والتوظيف المحلي والتعرض الضريبي ومتطلبات المشتريات ومستوى التحكم التشغيلي المطلوب.",
      recommendations: [
        "قارن نماذج الدخول بالنشاط المقصود ونموذج الإيراد قبل اختيار تسلسل تأسيس الكيان.",
        "اربط التأسيس والبنوك والقوى العاملة والضرائب والفوترة الإلكترونية واعتماد الموردين في قرار واحد.",
        "استخدم إطلاقاً مرحلياً عند استمرار التحقق التجاري، مع تحديد متى يصبح الوجود المحلي إلزامياً.",
      ],
      assumptions: ["لم يتم اختيار نموذج الكيان ولم يتم التحقق المستقل من أهلية النشاط."],
      missingInformation: COMMON_MISSING_AR,
      risks: COMMON_RISKS_AR,
      nextSteps: ["أنشئ جدول قرار يغطي النشاط والملكية والعملاء والقوى العاملة والضرائب والمدة والتحكم."],
      sourceKeys: ["marketEntryGuide", "decisionTrees", "misa"],
    };
  }

  if (skillId === "build_90_day_launch_brief") {
    return {
      summary: "تربط خطة أول 90 يوماً القوية قرار الدخول واعتماديات التأسيس والضوابط المالية وجاهزية الموارد البشرية وملكية التشغيل وأدلة العملاء أو تسجيل الموردين.",
      recommendations: [
        "الأيام 1-30: تأكيد النشاط ونموذج الدخول والملكية واعتماديات الترخيص وحوكمة الإطلاق وفجوات الأدلة.",
        "الأيام 31-60: تقدم التأسيس والتسجيلات بالتوازي مع تصميم الرواتب والمالية والضرائب وضبط المستندات.",
        "الأيام 61-90: تفعيل الضوابط والتقارير وجاهزية التوظيف والمرافق وحزم تأهيل العملاء أو المشتريات.",
      ],
      assumptions: ["الخطة إطار تشغيلي إرشادي ويجب تكييفها مع المسار التنظيمي المتحقق للشركة."],
      missingInformation: COMMON_MISSING_AR,
      risks: COMMON_RISKS_AR,
      nextSteps: ["عيّن مسؤولاً وموعداً واعتمادية ودليلاً وقاعدة تصعيد لكل مسار عمل."],
      sourceKeys: ["launchPlan", "capabilities", "marketEntryGuide"],
    };
  }

  if (skillId === "identify_misa_hr_tax_requirements") {
    return {
      summary: "تتطلب جاهزية الإطلاق عادة ربط الاستثمار الأجنبي والسجل التجاري بمنصات القوى العاملة والسعودة والتسجيلات الضريبية وضريبة القيمة المضافة والزكاة والفوترة الإلكترونية والضوابط المالية.",
      recommendations: [
        "أكد النشاط التجاري المقصود ووضع ترخيص وزارة الاستثمار والسجل التجاري أولاً.",
        "اربط قوى والتأمينات والرواتب والسجلات الوظيفية والسعودة قبل الالتزام بمواعيد التوظيف.",
        "حدد ملكية التقويم الضريبي وضوابط الفوترة الإلكترونية والموافقات وحفظ الأدلة قبل إصدار الفواتير.",
      ],
      assumptions: ["لم يتحقق الوكيل مستقلاً من النشاط القانوني أو الوضع الضريبي أو تصنيف القوى العاملة."],
      missingInformation: COMMON_MISSING_AR,
      risks: COMMON_RISKS_AR,
      nextSteps: ["أنشئ سجل اعتماديات وتحقق من كل متطلب من المصادر الرسمية الحالية أو مستشار مؤهل."],
      sourceKeys: ["misa", "nitaqat", "vatZakat", "eInvoicing"],
    };
  }

  if (skillId === "prepare_vendor_readiness_plan") {
    return {
      summary: "جاهزية تسجيل الموردين في السعودية تعتمد على اكتمال الأدلة ووضوح الملكية: التسجيلات والسجلات المالية والضريبية والمصرفية والامتثال والقدرات وملكية البوابة.",
      recommendations: [
        "حدد العميل المستهدف وبوابة المشتريات والفئة والموعد والأدلة الإلزامية قبل تجميع الحزمة.",
        "أنشئ فهرس أدلة مضبوطاً يتضمن المالك وتاريخ الإصدار والانتهاء ومحفزات التحديث.",
        "طابق ملف القدرات والحقائق التشغيلية المحلية مع متطلبات المشتري دون الإيحاء باكتمال تسجيل أو موافقة غير متحققة.",
      ],
      assumptions: ["لم يتم التحقق بعد من بوابة المشتري أو قائمة الأدلة الخاصة به."],
      missingInformation: ["العميل والبوابة والفئة المستهدفة", "موعد المناقصة أو التأهيل", "وضع الكيان والتسجيلات", "الأدلة المالية والضريبية والمصرفية والامتثال", "مسؤول تحديث البوابة والمستندات"],
      risks: ["قد تؤخر الأدلة الناقصة أو المنتهية أو المتعارضة تأهيل المورد.", "تختلف متطلبات العملاء ولا تضمن الحزمة العامة القبول."],
      nextSteps: ["أنشئ مصفوفة فجوات وفهرس أدلة وتقويم تحديث خاصاً بالمشتري."],
      sourceKeys: ["vendorGuide", "vendorPack", "services"],
    };
  }

  if (skillId === "prepare_project_inquiry") {
    const notFit = fit.classification === "not_fit";
    return {
      summary: notFit ? fit.reason : "يمكن للمساعد إعداد مسودة منظمة لاستفسار دخول السوق، لكنه لا يرسلها ولا يتواصل مع Vested KSA.",
      recommendations: notFit
        ? ["لا تُعِد أو ترسل استفسار مشروع لهذا الطلب."]
        : ["أكد سياق الشركة ومسارات الخدمة قبل صياغة النص النهائي.", "لا تضع هويات أو جوازات أو بيانات بنكية أو عقوداً سرية في الاستفسار الأول.", "اعرض المسودة والوجهة على المستخدم واحصل على موافقة صريحة قبل أي تواصل منفصل."],
      assumptions: ["لم يتم إرسال نموذج أو بريد أو واتساب أو حجز اجتماع أو تحديث نظام إدارة العملاء."],
      missingInformation: notFit ? [] : COMMON_MISSING_AR,
      risks: notFit ? ["يجب أن تبقى الطلبات غير المناسبة خارج مسار المشاريع."] : COMMON_RISKS_AR,
      nextSteps: notFit ? ["إنهاء مسار الاستفسار."] : ["اجمع سياق العمل الناقص ثم اعرض المسودة للموافقة الصريحة."],
      sourceKeys: ["inquiry", "routing"],
    };
  }

  return {
    summary: fit.reason,
    recommendations: fit.classification === "good_fit"
      ? ["ابدأ بمسارات Vested KSA المطابقة وتحقق من اعتماديات الإطلاق المرتبطة بها.", "استخدم الأدلة العامة للبحث الأولي ثم أعد مسودة استفسار موجزة عند اكتمال سياق الشركة."]
      : ["وضح ما إذا كان الطلب يخص دخول شركة دولية إلى السعودية أو التأسيس أو العمليات أو القوى العاملة أو المالية أو الامتثال أو المشتريات.", "استخدم دليل دخول السوق العام قبل إعداد الاستفسار."],
    assumptions: ["يعتمد تقييم الملاءمة على النص المقدم ولا يثبت الأهلية التنظيمية."],
    missingInformation: COMMON_MISSING_AR,
    risks: COMMON_RISKS_AR,
    nextSteps: fit.classification === "good_fit" ? ["حدد مسارات الأولوية ثم اطلب خطة 90 يوماً أو مسودة استفسار عند الحاجة."] : ["قدم سياق الشركة وهدفها في السعودية قبل المتابعة."],
    sourceKeys: ["company", "services", "routing", "marketEntryGuide"],
  };
}

function buildArabicResponseText(result) {
  const fitLabels = { good_fit: "ملائم", maybe_fit: "يحتاج توضيحاً", not_fit: "غير ملائم" };
  const confidenceLabels = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };
  const lines = [
    `مساعد Vested KSA: ${result.response.summary}`,
    "",
    `الملاءمة: ${fitLabels[result.fit.classification] || result.fit.classification} (ثقة ${confidenceLabels[result.fit.confidence] || result.fit.confidence})`,
    `المهارة المختارة: ${result.skillId}`,
  ];
  if (result.response.recommendations.length) {
    lines.push("", "التوصيات:", ...result.response.recommendations.map((item) => `- ${item}`));
  }
  if (result.response.missingInformation.length) {
    lines.push("", "المعلومات المطلوبة:", ...result.response.missingInformation.map((item) => `- ${item}`));
  }
  lines.push(
    "",
    "حدود الأمان: هذه إجابة إرشادية للقراءة فقط. لم يتم إرسال أي طلب أو تنفيذ أي تواصل.",
    "المصادر:",
    ...result.sources.map((source) => `- ${source.title}: ${source.url}`),
  );
  return lines.join("\n");
}

module.exports = {
  arabicSkillContent,
  buildArabicResponseText,
  detectLanguage,
  nonFitReasonArabic,
};
