# 🏢 데이터센터 자산 및 재고 관리 시스템 (DC Asset Management)
[English](./README.md)

> Node.js와 PostgreSQL을 활용하여 데이터센터(IDC) 지점별 자산 현황 모니터링, 입출고 관리, 월간 실사 및 이력 추적을 제공하는 풀스택 웹 애플리케이션입니다.

### 대시보드
![대시보드](./docs/DAM2.png)

### DC별 재고 현황
![DC별 재고 현황](./docs/DAM4.png)

### 정기 자산실사
![정기 자산실사](./docs/DAM3.png)

### 로그인
![로그인](./docs/login.png)

### 회원가입
![회원가입](./docs/signup.png)

---

## 🛠️ Tech Stack

- **Backend:** Node.js (Express)
- **Database:** PostgreSQL (pg Driver)
- **Authentication:** Express-Session, Bcrypt (비밀번호 암호화)
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS)

---

## ✨ 핵심 구현 기능 (Key Features)

### 1. 지점별 자산 및 재고 현황 조회
- `LEFT JOIN` 및 `COALESCE` 구문을 활용해 IDC 지점 및 카테고리별 자산 수량을 누락 없이 조회
- 대시보드를 통해 지점별 총 재고 통계 데이터 제공

### 2. 동시성을 고려한 안전한 입출고(사용/반납) 처리
- **PostgreSQL Transaction (`BEGIN`/`COMMIT`/`ROLLBACK`)** 적용으로 처리 중 오류 발생 시 자동 롤백
- **Upsert (`ON CONFLICT DO UPDATE`)** 구문을 활용해 재고 레코드의 생성 및 업데이트 처리 자동화
- `stock_logs` 테이블을 통해 모든 재고 변동 내역(일시, 사용자, 변동 수량)을 이력으로 기록

### 3. 일괄 자산실사(Batch Inspection) 시스템
- 월간 자산 실사 진행 현황(`monthly_inspections`) 관리
- 실사 결과와 실제 재고 수량 비교 후 차이 발생 시 일괄 업데이트 및 로그 자동 생성

### 4. 보안 및 세션 관리
- `bcrypt` 기반 비밀번호 단방향 암호화 저장
- `express-session`을 이용한 로그인 세션 검증 및 미들웨어 기반 API 권한 제어

---

## 📐 DB 테이블 구조 (ERD Summary)

- **`users`**: 사용자 계정 및 암호화된 비밀번호
- **`locations`**: IDC 지점 정보
- **`items`**: 자산 카테고리, 제조사, 스펙 정보
- **`stock`**: 지점별 자산 재고 수량 (Composite Key: `location_id`, `item_id`)
- **`stock_logs`**: 자산 입출고/실사 변경 이력 데이터
- **`monthly_inspections`**: 지점별 월간 실사 완료 여부 및 담당자 정보

## 🚀 시작하기

```bash
# 1. 저장소 클론
git clone https://github.com/Jo00ow-1/DC-Asset-Manager-v2.git
cd DC-Asset-Manager-v2

# 2. 패키지 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env 파일에 DB 정보와 세션 시크릿 입력

# 4. DB 스키마 적용
psql -U your_username -d your_dbname -f schema.sql

# 5. 서버 실행
npm start
```
