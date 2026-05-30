# 진로연계 탐색

중학생 진로·고교 연계 웹 프로토타입입니다. 진로심리검사, 진로목표 설정, 고교 탐색, 교사·학부모 상담 공유 기능을 제공합니다.

> **커리어넷 API**는 서버 프록시를 통해서만 호출됩니다. GitHub Pages만으로는 API가 동작하지 않으므로 **Vercel 또는 Render**에 서버를 함께 배포해야 합니다.

## 공유 URL (권장)

1. [Vercel](https://vercel.com) 또는 [Render](https://render.com)에 이 저장소를 연결합니다.
2. 환경 변수 **`CAREERNET_API_KEY`** 에 커리어넷 인증키를 입력합니다.
3. 배포가 끝나면 나온 주소(예: `https://2026-contest.vercel.app`)를 **공유 URL**로 사용합니다.

→ UI + 커리어넷 API가 **같은 주소**에서 모두 동작합니다.

## GitHub Pages + API 서버 (선택)

GitHub Pages 주소를 계속 쓰려면, Vercel/Render에 배포한 뒤 `public/js/config.js` 를 수정하세요.

```javascript
window.APP_CONFIG = {
  apiOrigin: "https://여기에-배포-주소.vercel.app",
};
```

수정 후 push하면 [GitHub Pages](https://realhoonjang.github.io/2026_contest/)에서도 API가 연결됩니다.

## 로컬 실행

```bash
npm install
copy .env.example .env   # CAREERNET_API_KEY 입력
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## Vercel 배포 (상세)

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub 저장소 `2026_contest` 선택
2. **Environment Variables** → `CAREERNET_API_KEY` = 커리어넷 인증키
3. **Deploy** 클릭

저장소에 `vercel.json`과 `api/backend/` 프록시가 포함되어 있습니다.

## Render 배포 (상세)

1. [render.com](https://render.com) → **New Web Service** → GitHub 저장소 연결
2. `render.yaml` 이 자동 적용됩니다.
3. **Environment** → `CAREERNET_API_KEY` 입력 후 배포

## 주요 화면

| 역할 | 경로 |
|------|------|
| 홈 | `#/` |
| 학생 | `#/student` |
| 교사 | `#/teacher` |
| 학부모 | `#/family` |

## 기술 구성

- **프론트**: HTML / CSS / JavaScript
- **서버**: Express 또는 Vercel Serverless — 커리어넷 API 프록시
- **데이터**: localStorage (프로토타입)

## 참고

- API 키는 `.env` 또는 Vercel/Render 환경 변수에만 저장하세요.
- 실제 입학·지원은 학교 안내를 따르세요.
