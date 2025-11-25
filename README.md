# 🌟 DreamWish CS Platform

> AI 기반 옴니채널 고객 상담 플랫폼 - 카카오톡, 인스타그램, 페이스북, 웹 위젯을 하나의 대시보드에서 관리

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 주요 기능

### 🤖 AI 자동 응답
- **Ollama 통합**: llama3.2 모델 기반 자연어 처리
- **지식 베이스**: PDF 문서 학습 및 컨텍스트 기반 답변
- **자동 응답 트리거**: 운영시간 외 또는 상담원 부재 시 자동 활성화

### 👥 상담원 관리
- **자동 배정**: Round-robin 알고리즘으로 공평한 업무 분배
- **상태 관리**: online/offline/away/busy 4단계 상태
- **동시 채팅 제한**: 상담원별 최대 동시 처리 건수 설정
- **실시간 통계**: 활성 채팅, 완료 건수, 총 메시지 수

### 📱 멀티채널 지원
- **카카오톡**: 챗봇 시나리오 연동 (Fallback 블록)
- **인스타그램**: Meta Business Suite 웹훅 연동
- **페이스북 메신저**: Graph API 연동
- **웹 위젯**: 임베드 가능한 채팅 위젯 제공

### ⏰ 운영시간 관리
- **시간대별 설정**: 요일별 운영시간 커스터마이징
- **타임존 지원**: pytz 기반 정확한 시간 계산
- **자동 메시지**: 운영시간 외 자동 안내 메시지

### 📎 파일 업로드
- **다양한 형식 지원**: 이미지(10MB), 문서(50MB), 비디오(50MB)
- **자동 타입 감지**: MIME 타입 기반 메시지 타입 분류
- **외부 채널 전송**: 업로드 후 즉시 외부 플랫폼으로 전송

### 💬 실시간 통신
- **WebSocket**: 양방향 실시간 메시지 전송
- **읽음 상태**: 메시지 전송/수신/읽음 타임스탬프
- **미읽음 카운트**: 대화별 미읽음 메시지 자동 집계

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/gremmy126/dreamwish-chat.git
cd dreamwish-chat

# 가상환경 생성 및 활성화 (Windows)
python -m venv venv
.\venv\Scripts\Activate.ps1

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
copy .env.example .env
# .env 파일을 열어 필요한 값 입력
```

### 2. 초기 설정 및 마이그레이션

```bash
# 환경 검증 및 디렉토리 생성
python setup.py

# 데이터베이스 테이블 생성 및 기본 데이터 설정
python migrate_db.py
# 옵션 4 선택: 테이블 생성 + 기본 운영시간 설정
```

### 3. Ollama 설치 및 모델 다운로드

```bash
# Ollama 설치 (https://ollama.com/download)
# Windows: 설치 프로그램 실행

# 모델 다운로드
ollama pull llama3.2:1b
```

### 4. 서버 실행

```bash
# FastAPI 서버 시작
uvicorn backend.main:app --reload

# 또는 PowerShell 스크립트 사용
.\start-all-services.ps1
```

### 5. 대시보드 접속

브라우저에서 http://localhost:8000/dashboard/index.html 접속

**기본 계정:**
- 이메일: `admin@dreamwish.com`
- 비밀번호: `admin123`

## 📚 상세 가이드

- [AI 챗봇 설정](AI_SETUP_GUIDE.md) - Ollama 및 지식 베이스 구성
- [외부 채널 연동](EXTERNAL_CONNECTION_TEST.md) - 카카오/인스타/페이스북 설정
- [Google Cloud SQL 마이그레이션](GOOGLE_CLOUD_SQL_SETUP.md) - 프로덕션 DB 배포
- [카카오톡 시나리오](KAKAO_SCENARIO_GUIDE.md) - 챗봇 Fallback 설정
- [빠른 시작](QUICK_START.md) - 전체 기능 개요

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    External Channels                    │
│  Kakao Talk │ Instagram │ Facebook │ Web Widget         │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│                   Webhook Handler                       │
│  /webhook/kakao │ /webhook/instagram │ /webhook/facebook│
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              Business Logic Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Agent        │  │ Business     │  │ File         │  │
│  │ Assignment   │  │ Hours        │  │ Upload       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│                    AI Processing                        │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ Ollama (llama3.2)    │  │ Knowledge Base       │    │
│  │ - Response Generation│  │ - FAISS Vector Store │    │
│  └──────────────────────┘  │ - ChromaDB           │    │
│                             └──────────────────────┘    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
│  SQLite (dev) / PostgreSQL (prod)                       │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              Real-time Communication                    │
│  WebSocket ↔ Dashboard (Agent UI)                       │
└─────────────────────────────────────────────────────────┘
```

## 📦 주요 구성 요소

### Backend (FastAPI)
```
backend/
├── routers/          # API 엔드포인트
│   ├── webhook.py    # 외부 채널 수신
│   ├── agent.py      # 상담원 관리
│   ├── upload.py     # 파일 업로드
│   └── chat.py       # 채팅 메시지
├── services/         # 비즈니스 로직
│   ├── agent_assignment.py   # 자동 배정
│   ├── business_hours.py     # 운영시간
│   ├── file_upload.py        # 파일 처리
│   ├── ollama_chatbot.py     # AI 챗봇
│   └── kakao_service.py      # 채널 연동
└── models.py         # 데이터베이스 모델
```

### Frontend (Vanilla JS)
```
frontend/
├── dashboard/        # 상담원 대시보드
│   ├── index.html    # 메인 채팅 화면
│   ├── invite.html   # 팀원 초대
│   └── app.js        # WebSocket 통신
└── widget/           # 웹 위젯
    └── chat-widget.js
```

## 🔧 환경 변수

`.env` 파일 필수 설정:

```env
# 데이터베이스
DATABASE_URL=sqlite:///./dreamwish_cs.db

# JWT 인증
SECRET_KEY=your-secret-key-here

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b

# 카카오톡 (선택)
KAKAO_REST_API_KEY=your-key

# 인스타그램/페이스북 (선택)
INSTAGRAM_ACCESS_TOKEN=your-token
FACEBOOK_PAGE_ACCESS_TOKEN=your-token
FACEBOOK_VERIFY_TOKEN=dreamwish_verify_token
```

## 📊 API 엔드포인트

### 상담원 관리
- `POST /api/agent/status` - 상태 변경 (online/offline/away/busy)
- `GET /api/agent/available` - 사용 가능한 상담원 목록
- `POST /api/agent/assign` - 수동 배정
- `GET /api/agent/statistics` - 통계 조회
- `GET /api/agent/my-conversations` - 내 대화 목록

### 파일 업로드
- `POST /api/upload/file` - 파일 업로드
- `POST /api/upload/message-with-file` - 메시지+파일 전송
- `DELETE /api/upload/file/{file_id}` - 파일 삭제

### 외부 채널 웹훅
- `POST /webhook/kakao` - 카카오톡 메시지 수신
- `POST /webhook/instagram` - 인스타그램 메시지 수신
- `POST /webhook/facebook` - 페이스북 메시지 수신
- `POST /webhook/email` - 이메일 문의 수신

## 🧪 테스트

### 웹훅 테스트
```powershell
# Localtunnel 실행
npx localtunnel --port 8000

# 웹훅 테스트 스크립트 실행
.\test-external-webhooks.ps1
```

### 수동 테스트
```bash
# 카카오 웹훅 테스트
curl -X POST http://localhost:8000/webhook/kakao \
  -H "Content-Type: application/json" \
  -d '{"userRequest": {"utterance": "안녕하세요", "user": {"id": "test123"}}}'
```

## 🌐 프로덕션 배포

### Google Cloud SQL 마이그레이션

1. **Cloud SQL 인스턴스 생성**
   ```bash
   # GOOGLE_CLOUD_SQL_SETUP.md 참고
   ```

2. **데이터 마이그레이션**
   ```bash
   python migrate_db.py
   # 옵션 2 선택: SQLite → PostgreSQL 마이그레이션
   ```

3. **환경 변수 업데이트**
   ```env
   DATABASE_URL=postgresql://user:pass@host:5432/dreamwish_db
   ```

### 외부 채널 배포

1. **공개 URL 설정** (Localtunnel, ngrok, 또는 고정 도메인)
2. **각 플랫폼에 웹훅 URL 등록**
   - 카카오: https://i.kakao.com
   - 인스타그램: https://developers.facebook.com
   - 페이스북: 동일 포털

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

- **Issues**: [GitHub Issues](https://github.com/gremmy126/dreamwish-chat/issues)
- **Documentation**: 프로젝트 내 마크다운 파일 참조
- **Email**: gremmy126@gmail.com

## 🎯 로드맵

- [ ] 다국어 지원 (i18n)
- [ ] 음성 메시지 처리
- [ ] 고급 분석 대시보드
- [ ] 모바일 앱 (React Native)
- [ ] 챗봇 성능 모니터링
- [ ] A/B 테스트 기능

---

Made with ❤️ by DreamWish Team
