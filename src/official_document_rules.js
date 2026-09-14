(function () {
  "use strict";

  var DOCUMENT_TYPES = ["협조요청", "통보", "회신", "보고", "계획", "알림", "신청", "제출", "기타"];
  var ITEM_MARKERS = ["1.", "가.", "1)", "가)", "⑴", "㈎", "①", "㉮"];
  var REQUIRED_FIELDS = [
    ["documentType", "문서 유형"],
    ["body", "본문 핵심 내용"]
  ];

  var REVIEW_PATTERNS = [
    // ── 중복 표현 ──
    { pattern: /[0-9]+월달/g, message: "'○월달'은 중복 표현입니다. '○월'로 씁니다.", replace: function (v) { return v.replace("월달", "월"); } },
    { pattern: /기간\s*동안/g, message: "'기간 동안'은 중복 표현입니다. '기간' 또는 '동안'으로 줄입니다.", replace: "기간" },
    { pattern: /매\s*([0-9]+)\s*년마다/g, message: "'매...마다'는 중복 표현입니다. '2년마다'처럼 씁니다.", replace: "$1년마다" },
    { pattern: /[월화수목금토일]요일\s*날\b/g, message: "'요일 날'은 중복 표현입니다. '월요일'처럼 씁니다.", replace: function (v) { return v.replace(/\s*날$/, ""); } },
    { pattern: /여러\s*가지\s*종류/g, message: "'여러 가지 종류'는 중복 표현입니다. '여러 가지' 또는 '여러 종류'로 씁니다.", replace: "여러 가지" },
    { pattern: /쓰이는\s*용도/g, message: "'쓰이는 용도'는 중복 표현입니다. '용도' 또는 '쓰임새'로 줄입니다.", replace: "용도" },
    { pattern: /새로\s*신설/g, message: "'새로 신설'은 중복 표현입니다. '신설'로 줄입니다.", replace: "신설" },
    { pattern: /반드시\s*필요/g, message: "'반드시 필요'는 중복 표현입니다. '필요'로 씁니다.", replace: "필요" },
    { pattern: /미리\s*예측/g, message: "'미리 예측'은 중복 표현입니다. '예측'으로 씁니다.", replace: "예측" },
    { pattern: /소급하여\s*올라가/g, message: "'소급하여 올라가다'는 중복 표현입니다. '소급하다'로 씁니다.", replace: "소급하다" },
    { pattern: /수입해서\s*들여오/g, message: "'수입해서 들여오다'는 중복 표현입니다. '수입하다'로 씁니다.", replace: "수입하다" },
    { pattern: /결론을\s*맺/g, message: "'결론을 맺다'는 어색한 표현입니다. '결론을 내리다'로 씁니다.", replace: "결론을 내리다" },
    { pattern: /피해를\s*입/g, message: "'피해를 입다'는 중복 표현입니다. '해를 입다' 또는 '피해를 보다'로 씁니다.", replace: null },
    { pattern: /가장\s*중요한\s*것\s*중의\s*하나/g, message: "비논리적 표현입니다. '중요한 것 중의 하나'로 씁니다.", replace: "중요한 것 중의 하나" },
    { pattern: /과반수\s*이상/g, message: "'과반수 이상'은 중복 표현입니다. '과반수'로 씁니다.", replace: "과반수" },
    // ── 다중(반대) 표현 ──
    { pattern: /안전선\s*밖으로\s*물러/g, message: "안전선은 '밖으로'가 아닌 '안으로' 물러나야 합니다.", replace: null },
    { pattern: /회비\s*수납/g, message: "'회비 수납'보다 '회비 납부'가 수요자 중심 표현입니다.", replace: "회비 납부" },
    // ── 지시 대상 불명확 ──
    { pattern: /담배를\s*태우/g, message: "'담배를 태우다'는 잘못된 표현입니다. '담배를 피우다'로 씁니다.", replace: "담배를 피우다" },
    // ── 고압적 표현 ──
    { pattern: /속도를\s*줄이시오/g, message: "고압적 표현입니다. '속도를 줄여 주시기 바랍니다'처럼 안내형으로 씁니다.", replace: "속도를 줄여 주시기 바랍니다" },
    { pattern: /\b필히\b/g, message: "'필히'는 고압적 표현입니다. 안내형으로 바꿉니다.", replace: null },
    { pattern: /엄금/g, message: "'엄금'은 고압적 표현입니다. '출입할 수 없습니다'처럼 안내형으로 씁니다.", replace: null },
    { pattern: /절대\s*출입|절대\s*금지|절대로\s*하지/g, message: "'절대'를 수반한 금지 표현은 고압적입니다. 안내형으로 바꿉니다.", replace: null },
    // ── 낙인·차별 표현 ──
    { pattern: /불우\s*이웃/g, message: "'불우 이웃'은 낙인감을 줄 수 있습니다. '어려운 이웃'으로 씁니다.", replace: "어려운 이웃" },
    { pattern: /소외\s*계층/g, message: "'소외 계층'은 낙인 표현입니다. '차상위 계층' 등 구체적 표현으로 씁니다.", replace: null },
    // ── 외래어 단독 사용 ──
    { pattern: /\bR&D\b(?!\()/g, message: "공문서에서 외국어는 한글 표기 후 괄호에 원어를 씁니다. '연구 개발(R&D)'처럼 씁니다.", replace: null },
    { pattern: /\bMOU\b(?!\()/g, message: "공문서에서 'MOU'는 '업무 협약(MOU)'으로 씁니다.", replace: null },
    { pattern: /\bIT\b(?!\()|\bICT\b(?!\()/g, message: "공문서에서 'IT'·'ICT'는 '정보 기술(IT)'처럼 한글과 함께 씁니다.", replace: null },
    // ── 수요자 중심 표현 ──
    { pattern: /민원을?\s*접수합니다|민원\s*접수\s*중/g, message: "'민원 접수'는 행정 주체 중심 표현입니다. '민원 신청'으로 씁니다.", replace: null },
    { pattern: /여권을?\s*교부합니다/g, message: "'여권 교부'는 행정 주체 중심 표현입니다. '여권 수령'으로 씁니다.", replace: null },
    { pattern: /고지서를?\s*발송시킬/g, message: "'발송시킬'은 사동 표현 오류입니다. '보낼'로 씁니다.", replace: null },
    // ── 사동 표현 오류 ──
    { pattern: /향상시키[자고]/g, message: "'향상시키다'는 불필요한 사동입니다. '향상하다' 또는 '기르다'로 씁니다.", replace: null },
    { pattern: /전문가의?\s*자문을\s*받아\s*시행/g, message: "'자문을 받아 시행'은 어색합니다. '전문가에게 자문하여 시행'으로 씁니다.", replace: "전문가에게 자문하여 시행" }
  ];

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function splitLines(value) {
    return trim(value).split(/\r?\n/).map(function (line) { return trim(line); }).filter(Boolean);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeDate(value) {
    var raw = trim(value);
    if (!raw) return "";
    var matched = raw.match(/^(\d{4})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})\.?일?$/);
    if (!matched) return raw;
    return Number(matched[1]) + ". " + Number(matched[2]) + ". " + Number(matched[3]) + ".";
  }

  function normalizeTime(value) {
    return trim(value).replace(/\b([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\b/g, function (_, hour, minute) {
      return String(hour).padStart(2, "0") + ":" + minute;
    });
  }

  function koreanNumberUnder10000(num) {
    var digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    var units = ["", "십", "백", "천"];
    var value = Number(num);
    var result = "";
    String(value).split("").reverse().forEach(function (digit, index) {
      var n = Number(digit);
      if (!n) return;
      result = digits[n] + units[index] + result;
    });
    return result || "영";
  }

  function koreanAmount(num) {
    var value = Number(num);
    if (!Number.isFinite(value) || value < 0) return "";
    var parts = [];
    var eok = Math.floor(value / 100000000);
    var man = Math.floor((value % 100000000) / 10000);
    var rest = value % 10000;
    if (eok) parts.push(koreanNumberUnder10000(eok) + "억");
    if (man) parts.push(koreanNumberUnder10000(man) + "만");
    if (rest) parts.push(koreanNumberUnder10000(rest));
    return parts.join("") || "영";
  }

  function normalizeAmount(value) {
    return trim(value).replace(/금?\s*([0-9][0-9,]*)\s*원(?!\()/g, function (_, amount) {
      var number = Number(amount.replace(/,/g, ""));
      if (!Number.isFinite(number)) return amount + "원";
      return "금" + number.toLocaleString("ko-KR") + "원(금" + koreanAmount(number) + "원)";
    });
  }

  function normalizeBodyText(value) {
    return normalizeAmount(normalizeTime(trim(value)))
      .replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, "$1월 $2일")
      .replace(/\s*=\s*/g, ": ")
      .replace(/\n{3,}/g, "\n\n");
  }

  function hasSentenceEnding(value) {
    return /(다\.|요\.|함\.|임\.|[.!?])$/.test(trim(value));
  }

  function stripTrailingJosa(value) {
    return trim(value).replace(/\s*(을|를|에 대하여|에 대한|관련|건)$/g, "");
  }

  function stripDocumentTypeSuffix(value, type) {
    var topic = trim(value);
    if (type === "보고") return topic.replace(/\s*보고$/g, "");
    if (type === "계획") return topic.replace(/\s*계획$/g, "");
    if (type === "협조요청") return topic.replace(/\s*협조\s*요청$/g, "");
    if (type === "통보") return topic.replace(/\s*통보$/g, "");
    if (type === "회신") return topic.replace(/\s*회신$/g, "");
    if (type === "알림") return topic.replace(/\s*알림$/g, "");
    if (type === "신청") return topic.replace(/\s*신청$/g, "");
    if (type === "제출") return topic.replace(/\s*제출$/g, "");
    return topic;
  }

  function topicWithObjectMarker(value) {
    var topic = stripTrailingJosa(value);
    if (!topic) return "";
    var last = topic.charCodeAt(topic.length - 1);
    if (last < 0xac00 || last > 0xd7a3) return topic + "을";
    return topic + (((last - 0xac00) % 28) ? "을" : "를");
  }

  function topicWithSubjectMarker(value) {
    var topic = stripTrailingJosa(value);
    if (!topic) return "";
    var last = topic.charCodeAt(topic.length - 1);
    if (last < 0xac00 || last > 0xd7a3) return topic + "을";
    return topic + (((last - 0xac00) % 28) ? "이" : "가");
  }

  // 짧은 핵심어만 입력한 경우 문서 유형에 맞는 첫 문장으로 확장합니다.
  function planBodyLines(data) {
    var rawLines = splitLines(data.body);
    if (!rawLines.length) return [];

    var type = trim(data.documentType);
    var firstTopic = stripDocumentTypeSuffix(rawLines[0] || data.title || "", type);
    if (rawLines.length > 1 && !hasSentenceEnding(rawLines[0]) && rawLines[0].length <= 60) {
      var intro = buildIntroSentence(type, firstTopic, splitLines(data.attachments).length > 0);
      return [intro].concat(rawLines.slice(1).map(normalizeBodyText));
    }
    if (rawLines.length > 1 || rawLines[0].length > 60 || hasSentenceEnding(rawLines[0])) {
      return rawLines.map(normalizeBodyText);
    }

    var topic = firstTopic;
    var objectTopic = topicWithObjectMarker(topic);
    var subjectTopic = topicWithSubjectMarker(topic);
    var attachments = splitLines(data.attachments);
    var firstSentence = buildIntroSentence(type, topic, attachments.length > 0, objectTopic, subjectTopic);

    if (attachments.length) return [normalizeBodyText(firstSentence), "세부 내용은 붙임 자료를 참고하여 주시기 바랍니다."];
    return [normalizeBodyText(firstSentence)];
  }

  function buildIntroSentence(type, topic, hasAttachments, preparedObjectTopic, preparedSubjectTopic) {
    var objectTopic = preparedObjectTopic || topicWithObjectMarker(topic);
    var subjectTopic = preparedSubjectTopic || topicWithSubjectMarker(topic);
    if (type === "보고") return objectTopic + " 아래와 같이 보고합니다.";
    if (type === "계획") return objectTopic + " 아래와 같이 계획하여 추진하고자 합니다.";
    if (type === "협조요청") return objectTopic + " 원활히 추진하고자 아래와 같이 협조를 요청하오니 적극 협조하여 주시기 바랍니다.";
    if (type === "통보") return objectTopic + " 아래와 같이 통보하오니 업무에 참고하여 주시기 바랍니다.";
    if (type === "회신") return objectTopic + " 아래와 같이 회신합니다.";
    if (type === "알림") return subjectTopic + " 아래와 같이 운영됨을 알려드립니다.";
    if (type === "신청") return objectTopic + " 아래와 같이 신청합니다.";
    if (type === "제출") return hasAttachments ? objectTopic + " 붙임과 같이 제출합니다." : objectTopic + " 아래와 같이 제출합니다.";
    return objectTopic + " 아래와 같이 안내합니다.";
  }

  // 제목이 비어 있으면 본문 핵심어와 문서 유형으로 제목을 제안합니다.
  function suggestTitle(data) {
    var explicitTitle = trim(data.title);
    if (explicitTitle) return explicitTitle;

    var type = trim(data.documentType);
    var firstLine = splitLines(data.body)[0] || "";
    var topic = stripDocumentTypeSuffix(firstLine, type)
      .replace(/[.!?。]+$/g, "")
      .replace(/\s*(아래와 같이|다음과 같이).*/g, "")
      .replace(/\s*(보고합니다|신청합니다|제출합니다|알려드립니다|통보합니다|회신합니다).*$/g, "");
    topic = stripTrailingJosa(topic);
    if (!topic) return type || "공문";
    if (type === "기타") return topic;
    if (type === "협조요청") return topic + " 협조 요청";
    return topic + " " + type;
  }

  function formatAttachments(lines) {
    if (!lines.length) return "";
    if (lines.length === 1) return "붙임  " + lines[0] + " 1부.  끝.";
    return lines.map(function (item, index) {
      var prefix = index === 0 ? "붙임  " : "      ";
      var suffix = index === lines.length - 1 ? "  끝." : "";
      return prefix + (index + 1) + ". " + item + " 1부." + suffix;
    }).join("\n");
  }

  function formatRecipientHeader(recipients, via) {
    if (!recipients.length) return "";
    var viaText = via ? "(경유  " + via + ")" : "";
    if (recipients.length > 1) return "수신  수신자 참조" + (viaText ? "\n" + viaText : "");
    return "수신  " + recipients[0] + (viaText ? " " + viaText : "");
  }

  function formatRecipientReference(recipients, references) {
    var lines = [];
    if (recipients.length > 1) lines.push("수신자  " + recipients.join(", "));
    if (references.length) lines.push("참조  " + references.join(", "));
    return lines.join("\n");
  }

  function formatBasis(lines) {
    if (!lines.length) return "";
    if (lines.length === 1) return "1. 관련: " + lines[0];
    var koreanMarkers = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"];
    return "1. 관련\n" + lines.map(function (line, index) {
      return "  " + (koreanMarkers[index] || String(index + 1)) + ". " + line;
    }).join("\n");
  }

  function formatRelatedDocument(text, date) {
    var doc = trim(text);
    var normalizedDate = normalizeDate(date);
    if (!doc) return "";
    if (!normalizedDate) return doc;
    if (doc.indexOf(normalizedDate) >= 0) return doc;
    return doc + "(" + normalizedDate + ")";
  }

  function formatBody(lines, hasBasis) {
    if (!lines.length) return "";
    if (!hasBasis && lines.length === 1) return lines[0];
    if (lines.length > 1) {
      var firstNumber = hasBasis ? 2 : 1;
      var subMarkers = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"];
      return firstNumber + ". " + lines[0] + "\n" + lines.slice(1).map(function (line, index) {
        return "  " + (subMarkers[index] || String(index + 1)) + ". " + line;
      }).join("\n");
    }
    return (hasBasis ? 2 : 1) + ". " + lines[0];
  }

  function validateDraftInput(input) {
    var missing = [];
    REQUIRED_FIELDS.forEach(function (item) {
      if (!trim(input[item[0]])) missing.push(item[1]);
    });
    return missing;
  }

  // 구조화된 입력값을 공문 초안으로 변환합니다.
  function buildDraft(input) {
    var data = input || {};
    var basis = splitLines(data.basis).map(function (line, index) {
      if (index > 0) return line;
      return formatRelatedDocument(line, data.basisDate);
    });
    var bodyLines = planBodyLines(data);
    var attachments = splitLines(data.attachments);
    var title = suggestTitle(data);
    var header = [
      "제목  " + title
    ].filter(Boolean).join("\n");
    var main = [formatBasis(basis), formatBody(bodyLines, basis.length > 0)].filter(Boolean).join("\n\n");
    if (!attachments.length) main = main ? main + "  끝." : "끝.";
    var attachmentText = formatAttachments(attachments);
    var closing = [
      attachmentText
    ].filter(Boolean).join("\n");
    return [header, main, closing].filter(Boolean).join("\n\n");
  }

  // 이미 작성한 공문을 PDF 기준 핵심 규칙으로 점검합니다.
  function reviewDocument(text) {
    var source = trim(text);
    var findings = [];
    var suggestion = source;
    if (!source) return { findings: [{ type: "누락", message: "검토할 공문 내용을 입력해 주세요." }], suggestion: "" };
    if (!/수신/.test(source)) findings.push({ type: "두문", message: "두문에 '수신' 항목이 보이지 않습니다." });
    if (!/제목/.test(source)) findings.push({ type: "두문", message: "두문에 '제목' 항목이 보이지 않습니다." });
    if (!/끝\./.test(source)) findings.push({ type: "결문", message: "본문 또는 붙임 끝에 '끝.' 표기가 필요합니다." });
    if (/붙임/.test(source) && !/붙임\s+/.test(source)) findings.push({ type: "붙임", message: "'붙임' 뒤에는 한 글자 정도 띄어 씁니다." });
    if (/\d{4}\.\d{1,2}\.\d{1,2}\.?/.test(source)) findings.push({ type: "날짜", message: "날짜는 '2025. 1. 6.'처럼 점 뒤에 한 칸을 둡니다." });
    if (/금?\s*[0-9][0-9,]*\s*원(?!\()/.test(source)) findings.push({ type: "금액", message: "금액은 '금13,500원(금일만삼천오백원)'처럼 한글 금액을 함께 적습니다." });

    REVIEW_PATTERNS.forEach(function (rule) {
      var matches = source.match(rule.pattern);
      if (!matches) return;
      findings.push({ type: "표현", message: rule.message, examples: Array.from(new Set(matches)).slice(0, 3) });
      if (rule.replace) suggestion = suggestion.replace(rule.pattern, rule.replace);
    });
    suggestion = normalizeAmount(suggestion.replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/g, function (_, y, m, d) {
      return y + ". " + Number(m) + ". " + Number(d) + ".";
    }));
    return { findings: findings, suggestion: suggestion };
  }

  window.OfficialDocumentRules = {
    DOCUMENT_TYPES: DOCUMENT_TYPES,
    ITEM_MARKERS: ITEM_MARKERS,
    validateDraftInput: validateDraftInput,
    buildDraft: buildDraft,
    reviewDocument: reviewDocument,
    normalizeDate: normalizeDate,
    normalizeAmount: normalizeAmount,
    formatRelatedDocument: formatRelatedDocument,
    planBodyLines: planBodyLines,
    suggestTitle: suggestTitle,
    splitLines: splitLines,
    escapeRegExp: escapeRegExp
  };
})();
