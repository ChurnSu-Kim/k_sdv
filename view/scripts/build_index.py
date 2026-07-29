#!/usr/bin/env python3
"""주식시황 뷰어 빌드 — fetch 기반 (본문 임베디드 폐기).
크론이 data/report_YYYYMMDD.md 저장만 하면 reports.json 자동 갱신.
GitHub Pages URL만 열면 목록+본문 자동 반영 (빌드 불필요).
"""
import json, os, re, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "data")

def main():
    files = sorted(glob.glob(os.path.join(SRC, "report_*.md")), reverse=True)
    reports = []
    for f in files:
        base = os.path.basename(f)
        m = re.search(r"report_(\d{8})\\.md", base)
        if not m:
            continue
        ymd = m.group(1)
        date = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
        title = "시황 분석 보고서"
        try:
            with open(f, encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
        except Exception:
            pass
        reports.append({"date": date, "file": base, "title": title})
    out = os.path.join(SRC, "reports.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"reports": reports}, fh, ensure_ascii=False, indent=2)
    print(f"목록 빌드 완료: {len(reports)}건 → data/reports.json")

if __name__ == "__main__":
    main()
