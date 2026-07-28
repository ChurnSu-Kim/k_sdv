#!/usr/bin/env python3
"""주식시황 뷰어 빌드 — 포터블(임베디드) 방식.
원본: ../../data/주식시황_YYYYMMDD.md
대상: 이 프로젝트 data/ (reports.json + reports.js[마크다운 임베디드])
→ data/reports.js 하나만 있으면 file:// 더블클릭으로도 동작 (서버 불필요)
"""
import json, os, re, glob, shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "..", "data")   # company-brain/data
DST = os.path.join(BASE, "data")
os.makedirs(DST, exist_ok=True)


def esc(s: str) -> str:
    s = s.replace('\\', '\\\\').replace("'", "\\'").replace('\r', '')
    s = s.replace('</', '<\\/')          # </script> 인젝션 방지
    return s.replace('\n', '\\n')


def main():
    files = sorted(glob.glob(os.path.join(SRC, "주식시황_*.md")), reverse=True)
    reports, data_lines = [], []
    for f in files:
        base = os.path.basename(f)
        m = re.search(r"주식시황_(\d{8})\.md", base)
        if not m:
            continue
        ymd = m.group(1)
        date = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
        title = "시황 분석 보고서"
        try:
            head = open(f, encoding="utf-8").read(800)
            for line in head.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip()
                    break
        except Exception:
            pass
        shutil.copy2(f, os.path.join(DST, base))   # http 모드용 복사본
        reports.append({"date": date, "file": base, "title": title})
        md = open(f, encoding="utf-8").read()
        data_lines.append(f"REPORT_DATA['{base}'] = '{esc(md)}';")

    # http 모드용 인덱스
    json.dump({"reports": reports}, open(os.path.join(DST, "reports.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    # file:// 모드용 임베디드 번들
    js = "window.REPORTS = " + json.dumps(reports, ensure_ascii=False) + ";\n"
    js += "window.REPORT_DATA = {};\n"
    js += "var REPORT_DATA = window.REPORT_DATA;\n"
    js += "\n".join(data_lines) + "\n"
    open(os.path.join(DST, "reports.js"), "w", encoding="utf-8").write(js)
    print(f"뷰어 빌드 완료: {len(reports)}건 (reports.json + reports.js 임베디드)")


if __name__ == "__main__":
    main()
