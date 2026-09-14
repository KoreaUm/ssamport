(function (root) {
  'use strict';

  const manual = {
    title: '쌤포트 기능 설명서',
    version: '2026.05',
    summary: [
      '쌤포트는 학급 운영, 학생 기록, 평가, 일정, 공문, AI 보조 기능을 한 곳에서 관리하는 교사용 데스크톱 앱입니다.',
      '학생 정보와 상담 내용처럼 민감한 자료는 로컬 AI를 우선 사용하고, 클라우드 AI를 쓸 때는 외부 전송 여부를 확인하세요.'
    ],
    sections: [
      {
        key: 'dashboard',
        title: '대시보드',
        aliases: ['홈', '첫 화면', '위젯', '대시보드'],
        description: '오늘 업무를 카드형 위젯으로 모아 보는 시작 화면입니다.',
        features: [
          '달력, 시계/날씨, 할일, 학사일정, 급식, D-Day, 개인 시간표, 학급 시간표, 연락처, 바로가기, AI 할일 추출 위젯을 제공합니다.',
          '배열 편집을 켜면 위젯 위치와 크기를 조정할 수 있습니다.',
          '할일은 날짜별로 묶어 보고, 완료/수정/삭제/드래그 정렬을 할 수 있습니다.',
          'AI 할일 추출은 카카오톡, 문자, 공문 문장에서 해야 할 일을 뽑아 할일 목록에 추가합니다.'
        ],
        tips: [
          '자주 쓰는 위젯을 위쪽에 배치하면 매일 확인 시간이 줄어듭니다.',
          '민감한 문장을 AI 할일 추출에 넣을 때는 로컬 AI 사용을 우선 권장합니다.'
        ]
      },
      {
        key: 'students',
        title: '학생 명단',
        aliases: ['학생', '명단', '학생 정보', 'CSV'],
        description: '학급 학생 기본 정보를 등록하고 관리합니다.',
        features: [
          '학생 이름, 번호, 연락처, 보호자 연락처, 특이사항 등 기본 정보를 저장합니다.',
          'CSV 양식을 내려받아 학생 명단을 한 번에 가져올 수 있습니다.',
          '다른 기록 페이지에서 학생 선택 목록의 기준 데이터로 사용됩니다.'
        ],
        tips: [
          '학생 정보는 상담, 출석, 관찰, 평가와 연결되는 핵심 데이터이므로 먼저 정리해 두는 것이 좋습니다.'
        ]
      },
      {
        key: 'attendance',
        title: '출석 관리',
        aliases: ['출석', '결석', '지각', '조퇴'],
        description: '일자별 학생 출결 상태를 기록하고 확인합니다.',
        features: [
          '날짜를 선택해 학생별 출석 상태를 입력합니다.',
          '출석, 결석, 지각, 조퇴 등 상태를 관리합니다.',
          '출석 통계와 학생 기록 확인에 활용됩니다.'
        ],
        tips: [
          '상담 전 출결 변화가 있는지 함께 보면 생활 지도 근거를 잡기 쉽습니다.'
        ]
      },
      {
        key: 'daily_memo',
        title: '학급 메모',
        aliases: ['메모', '일일 메모', '학급 기록'],
        description: '날짜별 학급 운영 메모를 빠르게 남기는 공간입니다.',
        features: [
          '하루 동안 기억해야 할 학급 상황, 전달 사항, 특이사항을 기록합니다.',
          '나중에 상담 기록이나 생활 지도 자료로 참고할 수 있습니다.'
        ],
        tips: [
          '짧게라도 날짜별로 남기면 학기 말 기록 정리에 큰 도움이 됩니다.'
        ]
      },
      {
        key: 'timetable',
        title: '시간표 관리',
        aliases: ['시간표', '수업 시간표', 'AI 시간표', '시간표 사진'],
        description: '개인 시간표를 직접 입력하거나 AI로 구조화해 채웁니다.',
        features: [
          '요일과 교시별 수업명을 직접 입력하고 자동 저장합니다.',
          '시간표 텍스트 메모를 AI로 분석해 표에 채울 수 있습니다.',
          '시간표 사진 분석은 이미지 인식이 가능한 클라우드 AI가 필요할 수 있습니다.',
          '학급 시간표 엑셀은 설정에서 업로드하고 대시보드 학급 시간표 위젯에 표시합니다.'
        ],
        tips: [
          '텍스트 시간표는 로컬 AI로도 처리할 수 있지만, 사진 분석은 별도 이미지 인식 기능이 필요합니다.'
        ]
      },
      {
        key: 'counseling',
        title: '상담 일지',
        aliases: ['상담', '상담 기록', '후속 조치'],
        description: '학생 상담 내용을 구조화해 기록하고 후속 조치를 관리합니다.',
        features: [
          '상담 날짜, 학생, 주제, 요약, 상세 내용, 결과, 후속 조치, 위험도 등을 기록합니다.',
          '교우관계, 학습, 진로, 생활지도 등 상담 유형을 정리할 수 있습니다.',
          'AI 도우미에게 후속 조치 문장이나 상담 기록 표현을 물어볼 수 있습니다.'
        ],
        tips: [
          '학생 발화, 교사 관찰, 합의한 행동, 후속 확인일을 나누어 쓰면 기록 품질이 좋아집니다.',
          '위험 신호가 있으면 앱 기록과 별개로 학교 절차에 따른 보고와 연계를 우선하세요.'
        ]
      },
      {
        key: 'observations',
        title: '관찰 기록',
        aliases: ['관찰', '행동 기록', '생활 기록'],
        description: '수업과 생활 속 학생 행동 관찰을 누적합니다.',
        features: [
          '학생별 관찰 내용을 날짜와 함께 저장합니다.',
          '긍정 행동, 변화, 지도 필요 사항을 생활기록이나 상담 근거로 정리할 수 있습니다.'
        ],
        tips: [
          '평가적 표현보다 관찰 가능한 사실 중심으로 남기는 것이 좋습니다.'
        ]
      },
      {
        key: 'lessons',
        title: '수업 지도',
        aliases: ['수업', '지도', '수업 기록'],
        description: '수업 운영 기록과 지도 내용을 관리합니다.',
        features: [
          '수업 내용, 학생 반응, 보완할 점 등을 기록합니다.',
          '추후 평가, 상담, 수업 개선 자료로 활용할 수 있습니다.'
        ],
        tips: [
          '수업 후 바로 한두 줄이라도 남기면 다음 수업 준비가 쉬워집니다.'
        ]
      },
      {
        key: 'assessments',
        title: '수행평가',
        aliases: ['평가', '수행', '점수'],
        description: '평가 항목과 학생별 점수를 관리합니다.',
        features: [
          '평가명, 교과, 유형, 날짜, 만점을 설정합니다.',
          '학생별 점수를 입력하고 저장합니다.',
          '평가 자료는 통계와 학생 분석에 활용됩니다.'
        ],
        tips: [
          '평가 기준과 날짜를 함께 남겨두면 나중에 점수 확인이 빨라집니다.'
        ]
      },
      {
        key: 'submissions',
        title: '제출물 관리',
        aliases: ['제출', '과제', '미제출'],
        description: '과제와 제출 여부를 학생별로 확인합니다.',
        features: [
          '제출물 이름, 교과, 마감일, 비고를 등록합니다.',
          '학생별 제출 여부를 체크하고 미제출 학생을 확인합니다.'
        ],
        tips: [
          '마감일이 있는 제출물은 대시보드 할일과 함께 관리하면 누락을 줄일 수 있습니다.'
        ]
      },
      {
        key: 'statistics',
        title: '통계와 출력',
        aliases: ['통계', '출력', '보고'],
        description: '저장된 기록을 요약하고 확인하는 페이지입니다.',
        features: [
          '출석, 평가, 기록 데이터를 바탕으로 업무 확인용 통계를 제공합니다.',
          '필요한 기록을 출력이나 보고 자료로 정리할 때 활용합니다.'
        ],
        tips: [
          '기초 데이터가 충분히 쌓일수록 통계 활용도가 높아집니다.'
        ]
      },
      {
        key: 'ai_analysis',
        title: 'AI 분석',
        aliases: ['AI 분석', '분석', '로컬 AI'],
        description: '저장된 자료를 바탕으로 AI가 요약과 분석을 돕는 영역입니다.',
        features: [
          '학생, 상담, 성적 등 민감한 자료는 로컬 AI 사용을 우선합니다.',
          '분석 결과는 교사의 판단을 돕는 참고 자료로 사용합니다.'
        ],
        tips: [
          'AI 결과는 최종 판단이 아니므로 실제 기록과 학교 절차를 함께 확인하세요.'
        ]
      },
      {
        key: 'meal',
        title: '급식 메뉴',
        aliases: ['급식', '식단', '메뉴'],
        description: 'NEIS 급식 정보를 불러와 날짜별 메뉴를 확인합니다.',
        features: [
          '설정에 입력된 교육청 코드와 학교 코드를 기준으로 급식을 조회합니다.',
          '조식, 중식, 석식과 열량 정보를 표시합니다.'
        ],
        tips: [
          '급식이 보이지 않으면 설정에서 학교 코드가 맞는지 먼저 확인하세요.'
        ]
      },
      {
        key: 'school_calendar',
        title: '학사 일정',
        aliases: ['학사', '일정', 'NEIS', '학교 일정'],
        description: 'NEIS 학사 일정을 조회하고 학교 주요 일정을 확인합니다.',
        features: [
          '월별 학교 일정을 불러옵니다.',
          '대시보드 일정 위젯과 함께 오늘/이번 주 업무 확인에 활용합니다.'
        ],
        tips: [
          '행사 전 준비물이 필요한 일정은 할일로 함께 등록해 두면 좋습니다.'
        ]
      },
      {
        key: 'calculator',
        title: '계산기',
        aliases: ['계산', '계산기'],
        description: '간단한 계산을 앱 안에서 처리합니다.',
        features: [
          '업무 중 필요한 산술 계산을 빠르게 할 수 있습니다.'
        ],
        tips: [
          '성적이나 예산을 임시로 계산할 때 보조 도구로 쓰면 편합니다.'
        ]
      },
      {
        key: 'lesson_materials',
        title: '수업자료제작',
        aliases: ['수업자료', '수업 콘텐츠', 'Gemini', '제미나이', 'Canvas', '캔버스', '프롬프트', '슬라이드', '지도안', '학습지'],
        description: '수업 주제와 조건을 선택해 Gemini Canvas에 붙여넣을 수 있는 수업자료 제작 프롬프트를 만듭니다.',
        features: [
          '학교급, 학년, 난이도, 과목, 교육과정, 결과물 형태를 선택할 수 있습니다.',
          '구글 슬라이드 기획안, 수업 지도안, 학생용 학습지, 핵심 요약노트용 프롬프트를 생성합니다.',
          '차시, 도입 방식, 교수법, 시각화 요소, 유튜브 링크, PDF 수업자료, 디자인 스타일, 어조를 반영합니다.',
          'PDF 수업자료가 있으면 Gemini Canvas에 PDF를 첨부한 뒤, 생성된 프롬프트를 붙여넣어 PDF 기반 수업자료를 만들 수 있습니다.',
          '생성된 프롬프트를 복사한 뒤 Gemini 로그인 → Canvas 선택 → PDF 첨부 → 프롬프트 붙여넣기 순서로 사용합니다.'
        ],
        tips: [
          '학생 개인정보나 상담·성적 내용은 넣지 말고, 단원명과 수업 활동 조건 중심으로 입력하세요.',
          '상업고 수업은 회계, 금융, 사무, 창업, IT 계열 과목을 함께 선택해 맥락을 구체화하면 좋습니다.'
        ]
      },
      {
        key: 'official_document',
        title: '공문서 작성',
        aliases: ['공문', '문서', '품의', '견적서'],
        description: '학교 공문과 품의 문서 작성을 돕습니다.',
        features: [
          '공문 초안 작성, 검토, 문장 정리를 지원합니다.',
          '공공언어 기준에 맞춰 제목, 관련, 본문, 붙임, 끝. 형식을 확인합니다.',
          '견적서 이미지나 PDF에서 품목 정보를 추출하는 기능을 제공합니다.'
        ],
        tips: [
          '공문에 개인정보나 민감정보가 들어가면 외부 AI 사용 전에 반드시 내용을 줄이거나 익명화하세요.'
        ]
      },
      {
        key: 'todos',
        title: '할일 목록',
        aliases: ['할일', 'TODO', '업무', '기한'],
        description: '해야 할 일을 등록하고 기한과 우선순위를 관리합니다.',
        features: [
          '제목, 마감일, 우선순위, 카테고리를 저장합니다.',
          '대시보드에서 빠르게 확인하고 완료 처리할 수 있습니다.',
          'Google 캘린더 연동 설정이 되어 있으면 할일을 캘린더 일정으로 보낼 수 있습니다.'
        ],
        tips: [
          '문자나 공문에서 받은 업무는 AI 할일 추출로 빠르게 등록할 수 있습니다.'
        ]
      },
      {
        key: 'settings',
        title: '설정',
        aliases: ['설정', '환경설정', 'AI 설정', '백업', '메뉴'],
        description: '앱 기본 정보, 계정, 학급, 메뉴, AI, 백업을 관리합니다.',
        features: [
          '학년, 반, 교사명, 날씨 지역, 학교 코드를 설정합니다.',
          '상단 메뉴 구성과 대시보드 바로가기를 조정합니다.',
          '로컬 AI와 클라우드 AI를 선택하고 API 키, 모델, Ollama 상태를 확인합니다.',
          '백업 내보내기와 가져오기로 데이터를 보관하거나 옮길 수 있습니다.'
        ],
        tips: [
          '맥북에서 로컬 AI를 쓰려면 Ollama와 qwen2.5:3b 모델 상태를 먼저 확인하세요.'
        ]
      },
      {
        key: 'ai_helper',
        title: 'AI 도우미',
        aliases: ['AI 도우미', '챗봇', '도움말', '사용법'],
        description: '모든 페이지에서 열 수 있는 업무 보조 채팅입니다.',
        features: [
          '현재 페이지 맥락을 바탕으로 사용법, 기록 문장, 후속 조치 예시를 안내합니다.',
          '로컬 AI 선택 시 Ollama 모델이 내 PC에서 답변합니다.',
          '클라우드 AI 선택 시 입력 내용이 외부 AI 서버로 전송될 수 있습니다.',
          '이 설명서의 내용을 참고해 앱 기능 질문에 답할 수 있습니다.'
        ],
        tips: [
          '학생 실명, 연락처, 민감 상담 내용은 로컬 AI로 처리하는 것을 권장합니다.',
          '설명서 PDF가 필요하면 상단의 설명서 버튼이나 AI 도우미의 PDF 버튼을 사용하세요.'
        ]
      },
      {
        key: 'user_management',
        title: '회원 관리',
        aliases: ['회원', '관리자', '공지', '사용자'],
        description: '관리자 계정에서 사용자와 공지를 관리합니다.',
        features: [
          '사용자 목록을 확인하고 관리합니다.',
          '앱 공지나 버전 안내를 등록할 수 있습니다.',
          '관리자 권한이 있는 계정에서만 표시됩니다.'
        ],
        tips: [
          '일반 사용자는 이 메뉴가 보이지 않을 수 있습니다.'
        ]
      }
    ]
  };

  function sectionToText(section) {
    return [
      `## ${section.title}`,
      section.description,
      '',
      '주요 기능:',
      ...(section.features || []).map((item) => `- ${item}`),
      section.tips && section.tips.length ? '' : '',
      section.tips && section.tips.length ? '사용 팁:' : '',
      ...((section.tips || []).map((item) => `- ${item}`))
    ].filter(Boolean).join('\n');
  }

  manual.toPlainText = function () {
    return [
      `# ${manual.title}`,
      `버전: ${manual.version}`,
      '',
      ...manual.summary,
      '',
      ...manual.sections.map(sectionToText)
    ].join('\n\n');
  };

  manual.findRelevantSections = function (question, pageKey, limit) {
    const q = String(question || '').toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = manual.sections.map((section) => {
      let score = section.key === pageKey ? 6 : 0;
      const haystack = [
        section.key,
        section.title,
        section.description,
        ...(section.aliases || []),
        ...(section.features || []),
        ...(section.tips || [])
      ].join(' ').toLowerCase();
      terms.forEach((term) => {
        if (haystack.includes(term)) score += 2;
      });
      (section.aliases || []).forEach((alias) => {
        if (q.includes(String(alias).toLowerCase())) score += 4;
      });
      return { section, score };
    }).filter((item) => item.score > 0);

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || 4)
      .map((item) => item.section);
  };

  manual.buildAiContext = function (question, pageKey) {
    const q = String(question || '');
    if (/전체.*(기능|설명서|도움말)|모든.*기능|앱.*사용법|설명서.*전체/.test(q)) {
      return [
        '[앱 전체 기능 설명서]',
        ...manual.sections.map(sectionToText)
      ].join('\n\n');
    }
    const sections = manual.findRelevantSections(question, pageKey, 4);
    if (!sections.length) return '';
    return [
      '[앱 기능 설명서]',
      ...sections.map(sectionToText)
    ].join('\n\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = manual;
  root.APP_MANUAL = manual;
})(typeof window !== 'undefined' ? window : global);
