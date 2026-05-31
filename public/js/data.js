const TAG_LABELS = {
  stem: "STEM·공학", health: "보건·의료", art: "예술·디자인",
  social: "사회·교육", biz: "경영·경제", default: "다양한 분야",
};

function tagLabel(t) { return TAG_LABELS[t] || t; }

const REGIONS = ["전체","서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];

/** 커리어넷 학교 API 지역 코드 (career.go.kr) */
const REGION_TO_CODE = {
  전체: "전체", 서울: "100260", 부산: "100267", 인천: "100269", 대전: "100271",
  대구: "100272", 울산: "100273", 광주: "100275", 경기: "100276", 강원: "100278",
  충북: "100280", 충남: "100281", 전북: "100282", 전남: "100283", 경북: "100285",
  경남: "100291", 제주: "100292", 세종: "100276",
};

const REGION_FULL = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
  광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
  경기: "경기도", 강원: "강원", 충북: "충청북도", 충남: "충청남도",
  전북: "전북", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주",
};

/** 검사 태그 → 추천 고교 유형·키워드 */
const TAG_SCHOOL_HINTS = {
  stem: { sch1: ["100364", "100363", "100362"], keywords: ["과학", "공업", "공고", "마이스터", "SW", "로봇", "정보", "전자", "기계", "특목", "과고"] },
  health: { sch1: ["100362", "100363"], keywords: ["보건", "보호", "간호", "의료", "생명", "약학"] },
  art: { sch1: ["100364", "100362", "100365"], keywords: ["예술", "미술", "공연", "디자인", "문화", "영상", "음악"] },
  social: { sch1: ["100362", "100365"], keywords: ["인문", "사회", "교육", "국제", "외국어", "자율"] },
  biz: { sch1: ["100362", "100365", "100363"], keywords: ["상업", "경영", "국제", "외국어", "자율", "경제"] },
  default: { sch1: ["100362"], keywords: ["일반", "종합"] },
};

/** API 미응답 시 참고용 샘플 고교 (지역·진로 태그 포함) */
const FALLBACK_HIGH_SCHOOLS = [
  { id: "fb_s1", name: "서울과학고등학교", region: "서울", address: "서울특별시 종로구 혜화로 136", schoolType: "특수목적고", tags: ["stem"], lat: 37.589, lng: 126.997 },
  { id: "fb_s2", name: "경기과학고등학교", region: "경기", address: "경기도 수원시 영통구", schoolType: "특수목적고", tags: ["stem"], lat: 37.289, lng: 127.046 },
  { id: "fb_s3", name: "한국과학영재학교", region: "경기", address: "경기도 수원시 장안구", schoolType: "특수목적고", tags: ["stem"], lat: 37.298, lng: 127.010 },
  { id: "fb_s4", name: "선린인터넷고등학교", region: "서울", address: "서울특별시 강남구", schoolType: "특수목적고", tags: ["stem"], lat: 37.497, lng: 127.028 },
  { id: "fb_s5", name: "서울예술고등학교", region: "서울", address: "서울특별시 서초구", schoolType: "특수목적고", tags: ["art"], lat: 37.483, lng: 127.032 },
  { id: "fb_s6", name: "보인고등학교", region: "서울", address: "서울특별시 중구", schoolType: "일반고", tags: ["social", "biz"], lat: 37.558, lng: 126.991 },
  { id: "fb_s7", name: "대구과학고등학교", region: "대구", address: "대구광역시 북구", schoolType: "특수목적고", tags: ["stem"], lat: 35.886, lng: 128.582 },
  { id: "fb_s8", name: "부산과학고등학교", region: "부산", address: "부산광역시 남구", schoolType: "특수목적고", tags: ["stem"], lat: 35.136, lng: 129.084 },
  { id: "fb_s9", name: "인천전자마이스터고등학교", region: "인천", address: "인천광역시 연수구", schoolType: "특성화고", tags: ["stem"], lat: 37.410, lng: 126.678 },
  { id: "fb_s10", name: "광주과학고등학교", region: "광주", address: "광주광역시 북구", schoolType: "특수목적고", tags: ["stem"], lat: 35.174, lng: 126.912 },
  { id: "fb_s11", name: "대전외국어고등학교", region: "대전", address: "대전광역시 유성구", schoolType: "특수목적고", tags: ["social", "biz"], lat: 36.362, lng: 127.356 },
  { id: "fb_s12", name: "울산마이스터고등학교", region: "울산", address: "울산광역시 남구", schoolType: "마이스터고", tags: ["stem"], lat: 35.538, lng: 129.311 },
  { id: "fb_s13", name: "세종고등학교", region: "세종", address: "세종특별자치시", schoolType: "일반고", tags: ["default"], lat: 36.480, lng: 127.289 },
  { id: "fb_s14", name: "춘천고등학교", region: "강원", address: "강원특별자치도 춘천시", schoolType: "일반고", tags: ["default"], lat: 37.882, lng: 127.729 },
  { id: "fb_s15", name: "청주고등학교", region: "충북", address: "충청북도 청주시", schoolType: "일반고", tags: ["default"], lat: 36.635, lng: 127.491 },
  { id: "fb_s16", name: "천안고등학교", region: "충남", address: "충청남도 천안시", schoolType: "일반고", tags: ["default"], lat: 36.815, lng: 127.147 },
  { id: "fb_s17", name: "전주고등학교", region: "전북", address: "전북특별자치도 전주시", schoolType: "일반고", tags: ["default"], lat: 35.824, lng: 127.148 },
  { id: "fb_s18", name: "목포고등학교", region: "전남", address: "전라남도 목포시", schoolType: "일반고", tags: ["default"], lat: 34.812, lng: 126.392 },
  { id: "fb_s19", name: "포항고등학교", region: "경북", address: "경상북도 포항시", schoolType: "일반고", tags: ["default"], lat: 36.019, lng: 129.343 },
  { id: "fb_s20", name: "창원고등학교", region: "경남", address: "경상남도 창원시", schoolType: "일반고", tags: ["default"], lat: 35.228, lng: 128.681 },
  { id: "fb_s21", name: "제주고등학교", region: "제주", address: "제주특별자치도 제주시", schoolType: "일반고", tags: ["default"], lat: 33.499, lng: 126.531 },
  { id: "fb_s22", name: "서울보건고등학교", region: "서울", address: "서울특별시 동대문구", schoolType: "특성화고", tags: ["health"], lat: 37.574, lng: 127.039 },
  { id: "fb_s23", name: "경기상업고등학교", region: "경기", address: "경기도 수원시", schoolType: "특성화고", tags: ["biz"], lat: 37.263, lng: 127.029 },
  { id: "fb_s24", name: "부산예술고등학교", region: "부산", address: "부산광역시 해운대구", schoolType: "특수목적고", tags: ["art"], lat: 35.163, lng: 129.160 },
];

function regionFromLabel(label) {
  if (!label) return "전체";
  for (const [shortName, full] of Object.entries(REGION_FULL)) {
    if (label.includes(shortName) || label.includes(full)) return shortName;
  }
  if (label.includes("서울")) return "서울";
  if (label.includes("부산")) return "부산";
  if (label.includes("경기")) return "경기";
  return "전체";
}

const V1_CATALOG = [{ q: "1", title: "진로흥미탐색", summary: "어떤 활동·직업에 끌리는지 넓게 살펴봅니다.", detail: "교과·동아리·활동 속에서 흥미가 드러나는 패턴을 정리하는 데 도움이 됩니다." }];

const CAREER_CARDS = [
  { tag: "stem", label: TAG_LABELS.stem, jobs: ["소프트웨어 개발자","로봇·기계 엔지니어","데이터 분석가"], majors: ["컴퓨터공학","기계공학","AI·데이터과학"], certs: ["정보처리기능사","빅데이터분석기사"], resources: ["SW·AI 체험","메이커 스페이스","과학 진로 체험"] },
  { tag: "health", label: TAG_LABELS.health, jobs: ["의사·간호사","물리치료사","임상병리사"], majors: ["간호학","물리치료학","생명과학"], certs: ["응급처치","건강운동관리사"], resources: ["병원 견학","생명과학 동아리","보건 특강"] },
  { tag: "art", label: TAG_LABELS.art, jobs: ["그래픽·UI 디자이너","영상·애니 제작","콘텐츠 크리에이터"], majors: ["시각디자인","영상·애니메이션","미디어콘텐츠"], certs: ["GTQ","컴퓨터그래픽스운용기능사"], resources: ["포트폴리오 워크숍","미술 동아리","영상 체험"] },
  { tag: "social", label: TAG_LABELS.social, jobs: ["교사·상담사","사회복지사","공무원"], majors: ["교육학","사회복지학","행정학"], certs: ["사회복지사","청소년상담사"], resources: ["봉사·멘토링","토론 동아리","상담 체험"] },
  { tag: "biz", label: TAG_LABELS.biz, jobs: ["마케터·기획자","회계·재무","창업·스타트업"], majors: ["경영학","경제학","회계·세무"], certs: ["전산회계","전자상거래관리사"], resources: ["창업 캠프","경제 동아리","기업 견학"] },
];

const HIGH_SCHOOL_TYPES = [
  { value: "전체", label: "전체 종류" },
  { value: "100362", label: "일반고" },
  { value: "100363", label: "특성화·전문계" },
  { value: "100364", label: "특목고" },
  { value: "100365", label: "자율고" },
];

const SCHOOL_TYPE_GUIDES = [
  { id: "general", title: "일반고등학교", shortTitle: "일반고", forCareer: "여러 분야를 넓게 탐색하고 내신·수능 기반으로 대학·전공을 선택", summary: "교과 중심 교육과 동아리·자율 활동을 통해 진로를 점진적으로 구체화", bullets: ["다양한 진로와 연결 가능","자유학기·진로연계로 흥미 검증","고교학점제로 대학 학과 연계"] },
  { id: "specialized", title: "특성화고·전문계", shortTitle: "특성화·전문계", forCareer: "특정 산업 분야에 빠르게 몰입하고 싶은 경우", summary: "현장 중심 실습과 자격·기능 습득", bullets: ["직무 체험으로 '내가 맞는 일' 확인","학과·자격 연계 로드맵"] },
  { id: "meister", title: "마이스터고", shortTitle: "마이스터고", forCareer: "첨단·제조·산업 현장의 기술 인재", summary: "기업 참여형 교육과 현장 맞춤 훈련", bullets: ["산업 수요 맞춤 커리큘럼","취업·기술대학 등 다양한 출로"] },
  { id: "gifted", title: "과학고·영재학교 등", shortTitle: "특목고", forCareer: "학문·연구·STEM 등 특정 영역을 깊이 파고들고 싶은 경우", summary: "심화 교과·연구 활동", bullets: ["탐구·프로젝트 경험 축적","지역·학업 부담 함께 고려"] },
];

const UNIVERSITY_GUIDES = [
  { tag: "stem", label: TAG_LABELS.stem, majors: ["컴퓨터공학","전자공학","AI·데이터과학"], fromHighSchool: ["수학·과학·정보 심화","코딩·메이커 동아리","자유학기 STEM 프로젝트"], atUniversity: ["전공 기초 + 팀 프로젝트","인턴·공모전","포트폴리오"], admissionTips: ["고교 유형별 입시 요건 비교","목표 학과 2~3학년 때 확인"] },
  { tag: "health", label: TAG_LABELS.health, majors: ["의예·의학","약학","간호","생명과학"], fromHighSchool: ["생명·화학·보건 심화","봉사·의료 견학"], atUniversity: ["전공 기초 + 임상·실습","자격·대학원 경로"], admissionTips: ["학과별 입시 차이 큼"] },
  { tag: "art", label: TAG_LABELS.art, majors: ["시각·산업디자인","영상·애니메이션","실용음악"], fromHighSchool: ["미술·음악·영상 동아리","포트폴리오"], atUniversity: ["실기·작품 중심","졸업작·공모전"], admissionTips: ["실기·포트폴리오 전형 비중"] },
  { tag: "social", label: TAG_LABELS.social, majors: ["교육학","행정학","사회복지","법학"], fromHighSchool: ["국어·사회·영어 심화","봉사·토론·멘토링"], atUniversity: ["전공 + 현장실습","교원·사회복지 자격"], admissionTips: ["목표 직업별 자격 요건 확인"] },
  { tag: "biz", label: TAG_LABELS.biz, majors: ["경영학","경제학","회계·세무","마케팅"], fromHighSchool: ["수학·사회(경제) 심화","창업·경제 동아리"], atUniversity: ["이론 + 사례·프로젝트","인턴·창업"], admissionTips: ["상경 계열 수학·영어 비중 확인"] },
  { tag: "default", label: TAG_LABELS.default, majors: ["융합전공","자유전공"], fromHighSchool: ["자유학기 다양한 체험","진로검사·직업 조사"], atUniversity: ["1~2학년 전공 탐색","다양한 동아리·인턴"], admissionTips: ["탐색에 집중","자유학기 포트폴리오가 핵심"] },
];

const FREE_SEMESTER = {
  title: "자유학기·진로연계학기란?",
  summary: "진로·예술·체육·동아리 중심으로 교과 부담을 줄이고, 진로 탐색·체험·프로젝트에 집중할 수 있는 시기입니다.",
  pillars: [
    { title: "진로 탐색", body: "직업 체험, 견학, 멘토링으로 '일의 세계'를 경험합니다." },
    { title: "프로젝트·포트폴리오", body: "관심 분야 주제로 프로젝트를 완성하고 성찰일지를 남깁니다." },
    { title: "진로목표 구체화", body: "검사·체험 결과로 꿈 직업과 고교·대학 방향을 좁혀 갑니다." },
    { title: "상담·기록", body: "담임·진로교사와 정기 상담하며 목표와 성찰을 기록합니다." },
  ],
};

const MIDDLE_JOURNEY = [
  { grade: "자유학기", focus: "나를 알아가기", desc: "진로·예술·체육·동아리 중심 탐색·체험" },
  { grade: "심화·정리", focus: "관심 구체화", desc: "자유학기 성찰 바탕 동아리·교과 심화" },
  { grade: "고교·목표", focus: "진학 설계", desc: "고교 유형·학교 선택, 진로목표 확정" },
];

const TAG_META = {
  stem: { interest: "공학·기술·발명", goalExample: "소프트웨어·로봇 분야 개발자가 되기" },
  health: { interest: "보건·의료·생명", goalExample: "환자를 돕는 의료·보건 전문가가 되기" },
  art: { interest: "예술·디자인·창작", goalExample: "시각·영상 분야 크리에이터가 되기" },
  social: { interest: "사회·교육·공공", goalExample: "사람을 돕고 사회에 기여하는 일을 하기" },
  biz: { interest: "경영·경제·창업", goalExample: "기획·창업으로 새로운 가치를 만드는 일" },
  default: { interest: "다양한 분야", goalExample: "자유학기 체험 후 구체적인 진로목표 세우기" },
};

const PATH_STEPS = {
  middlePrep: { period: "입학 전·개학 전", label: "자유학기 준비", detail: "학교 자유학기·진로연계 운영 계획을 확인하고 체험 주제를 조사합니다.", actions: ["학교 자유학기 운영 계획 확인","희망 체험 주제 2~3개 조사","지역 진로·문화 체험 프로그램 알아보기"] },
  freeSemester: { period: "자유학기", label: "집중 탐색·체험", detail: "진로·예술·체육·동아리 중심으로 다양한 분야를 체험합니다.", actions: ["서로 다른 분야 체험 2회 이상","매주 성찰일지 작성","진로 포트폴리오 정리","담임·진로교사와 상담"] },
  middleEarly: { period: "심화·정리", label: "탐색 심화", detail: "자유학기에서 찾은 흥미를 바탕으로 동아리·교과 활동을 이어 갑니다.", actions: ["포트폴리오·성찰 다시 읽기","1순위 분야 관련 동아리·교과 심화","진로검사·직업 조사"] },
  highSchool: { period: "고등학교 진학", label: "고교 유형·학교 선택", detail: "일반·특성화·특목고 등 관심에 맞는 유형을 비교·지원합니다.", actions: ["고교 유형 2~3개 비교","학교 탐색으로 후보 정하기","관련 학과·동아리·대회 조사"] },
  beyondHighSchool: { period: "대학·진로", label: "대학·그 이후", detail: "관심 분야별 학과·직업 정보로 세부 탐색을 이어 갑니다.", actions: ["관심 학과·직업 3개 조사","선배·현직자 이야기 듣기","장기 목표를 한 문장으로 적기"] },
};

function pathForTags(tags) {
  const key = (tags || []).find(t => TAG_META[t]) || "default";
  const meta = TAG_META[key] || TAG_META.default;
  return { tag: key, ...meta, ...PATH_STEPS };
}

function pathStepsInOrder(plan) {
  return [plan.middlePrep, plan.freeSemester, plan.middleEarly, plan.highSchool, plan.beyondHighSchool];
}

function universityGuidesForTags(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of (tags && tags.length ? tags : ["default"])) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    const g = UNIVERSITY_GUIDES.find(x => x.tag === tag) || UNIVERSITY_GUIDES.find(x => x.tag === "default");
    if (g) out.push(g);
  }
  return out;
}

function careerCardsForTags(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of (tags && tags.length ? tags : ["default"])) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    const c = CAREER_CARDS.find(x => x.tag === tag);
    if (c) out.push(c);
  }
  return out.length ? out : [CAREER_CARDS[0]];
}

const INFER_RULES = [
  { re: /코딩|프로그램|로봇|공학|발명|과학|기술|IT|데이터|소프트웨어|전자|기계/i, tag: "stem" },
  { re: /의료|보건|간호|생명|약|의학|치료|건강/i, tag: "health" },
  { re: /미술|디자인|영상|만화|예술|음악|공연|창작|시각/i, tag: "art" },
  { re: /사회|교육|상담|토론|행정|법|정책|봉사|공공/i, tag: "social" },
  { re: /경제|경영|창업|마케팅|회계|유통|무역|사업/i, tag: "biz" },
];

function inferTagsFromLabels(labels) {
  const text = labels.join(" ");
  const out = new Set();
  for (const { re, tag } of INFER_RULES) { if (re.test(text)) out.add(tag); }
  if (!out.size) out.add("default");
  return [...out];
}
