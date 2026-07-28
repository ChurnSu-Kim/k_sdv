# 주식시황 뷰어 — README (인수인계서)

> 작성: 토니 / 2026-07-28
> 목적: 매일 작성되는 주식시황_YYYYMMDD.md 를 파일리스트→클릭→preview 로 열람

## 구조
```
주식시황뷰어/
├── index.html          # 2단 레이아웃(사이드바+메인)
├── assets/
│   ├── css/style.css    # 디자인팀 프리미엄 CSS (화이트/다크)
│   └── js/viewer.js     # 개발팀: 리스트로드+마크다운렌더
├── data/reports.json   # reports 인덱스 (build 스크립트 생성)
└── scripts/build_index.py  # data/주식시황_*.md 스캔→reports.json
```

## 데이터 소스
- 원본: ../company-brain/data/주식시황_YYYYMMDD.md (13개 보유)
- 인덱스: scripts/build_index.py 가 data/reports.json 생성
- (대시보드 프로젝트의 build_reports_index.py 와 동일 로직 재활용)

## 검증
- 파일리스트 13건 표시, 클릭 시 마크다운 preview 렌더
- 화이트/다크 토글
