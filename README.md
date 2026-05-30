# 진로연계 탐색

중학생 진로·고교 연계 웹 프로토타입입니다. 진로심리검사, 진로목표 설정, 고교 탐색, 교사·학부모 상담 공유 기능을 제공합니다.

## 실행 방법

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
# .env 파일에 CAREERNET_API_KEY 입력 (선택 — API 검사 목록용)
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 주요 화면

| 역할 | 경로 |
|------|------|
| 홈 | `#/` |
| 학생 | `#/student` |
| 교사 | `#/teacher` |
| 학부모 | `#/family` |

## 기술 구성

- **프론트**: HTML / CSS / JavaScript (정적 파일)
- **서버**: Express — 정적 서빙 + 커리어넷 API 프록시
- **데이터**: localStorage (프로토타입)

## 참고

- API 키는 `.env`에만 저장하며 Git에 올리지 마세요.
- 실제 입학·지원은 학교 안내를 따르세요.
