#!/usr/bin/env python3
"""Read the approved V4 workbook using only Python's standard library."""
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REL = "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"


def col_number(address):
    n = 0
    for ch in re.match(r"[A-Z]+", address).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def workbook_sheets(archive):
    wb = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    paths = {}
    for relation in rels.findall(REL):
        target = relation.attrib["Target"].lstrip("/")
        paths[relation.attrib["Id"]] = target if target.startswith("xl/") else posixpath.normpath("xl/" + target)
    return {s.attrib["name"]: paths[s.attrib["{" + NS["r"] + "}id"]]
            for s in wb.findall("m:sheets/m:sheet", NS)}


def shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in item.findall(".//m:t", NS))
            for item in root.findall("m:si", NS)]


def read_sheet(archive, sheet_path, strings):
    root = ET.fromstring(archive.read(sheet_path))
    result = {}
    for row in root.findall(".//m:sheetData/m:row", NS):
        cells = {}
        for cell in row.findall("m:c", NS):
            ctype = cell.attrib.get("t", "")
            v = cell.find("m:v", NS)
            if ctype == "inlineStr":
                val = "".join(t.text or "" for t in cell.findall(".//m:t", NS))
            elif v is None:
                val = None
            elif ctype == "s":
                val = strings[int(v.text)]
            elif ctype in ("str", "e"):
                val = v.text
            else:
                val = v.text
            cells[col_number(cell.attrib["r"])] = val
        if cells:
            result[int(row.attrib["r"])] = [cells.get(i) for i in range(max(cells) + 1)]
    return result


def get(row, index):
    return row[index] if index < len(row) and row[index] is not None else ""


def normalize_kp(value):
    return re.sub(r"\s+", "", str(value or "").replace("Khu phố", "KP"))


def main(path):
    with zipfile.ZipFile(path) as archive:
        names = workbook_sheets(archive)
        strings = shared_strings(archive)
        required = ["Master Data", "Quy đổi địa bàn V4", "Liên hệ và SĐT", "Tên đường và alias V4", "Cần kiểm tra"]
        missing = [s for s in required if s not in names]
        if missing:
            raise ValueError("Thiếu sheet: " + ", ".join(missing))
        sheets = {name: read_sheet(archive, names[name], strings) for name in required}

    contacts = {}
    phones = {}
    for i, r in sheets["Liên hệ và SĐT"].items():
        key = str(get(r, 0))
        if i < 5 or not re.fullmatch(r"TDP\d+", key):
            continue
        if key in contacts:
            raise ValueError("TDP liên hệ bị trùng: " + key)
        contacts[key] = get(r, 1)
        phones[key] = str(get(r, 2))
    if len(contacts) != 22 or any(not number for number in phones.values()):
        raise ValueError("Cần đủ liên hệ và SĐT cho 22 TDP.")

    area_by_old = {}
    history = {str(i): {"tdp": i, "contact": contacts["TDP" + str(i)], "rows": []}
               for i in range(1, 23)}
    for i, r in sheets["Quy đổi địa bàn V4"].items():
        if i < 5 or not re.fullmatch(r"TDP\d+", str(get(r, 1))):
            continue
        tdp = str(get(r, 1))
        before_kp, before_ward = get(r, 2), get(r, 3)
        middle_kp, middle_ward = get(r, 4), get(r, 5)
        now_kp, now_ward = get(r, 6), get(r, 7)
        area_by_old[(str(middle_ward), normalize_kp(middle_kp))] = (before_kp, before_ward)
        def label(kp, ward):
            return f"{kp}, phường {ward}" if kp else ""
        history[tdp[3:]]["rows"].append({
            "before": label(before_kp, before_ward),
            "middle": label(middle_kp, middle_ward),
            "current": label(now_kp, now_ward),
        })

    # Rename a street in one canonical-name cell without editing every address row.
    canonical = {}
    aliases = {}
    for i, r in sheets["Tên đường và alias V4"].items():
        if i < 5:
            continue
        old, current, alternatives = str(get(r, 1)), str(get(r, 2)), str(get(r, 4))
        if not old or not current:
            continue
        canonical[old] = current
        for alt in [old, *re.split(r"[,;]", alternatives)]:
            if alt.strip() and alt.strip() != current:
                aliases[alt.strip()] = current

    records = []
    for i, r in sheets["Master Data"].items():
        if i < 5 or not str(get(r, 0)).isdigit():
            continue
        ward, old_kp, street = str(get(r, 1)), str(get(r, 2)), str(get(r, 3))
        before_kp, before_ward = area_by_old.get((ward, normalize_kp(old_kp)), ("", ""))
        records.append({
            "id": int(get(r, 0)), "ward": ward, "oldKp": old_kp,
            "street": canonical.get(street, street), "parity": get(r, 4),
            "range": get(r, 5), "newKp": get(r, 7), "tdp": get(r, 8),
            "status": get(r, 9), "issue": get(r, 10),
            "note": get(r, 11), "update": get(r, 14),
            "history": {"beforeKp": before_kp, "beforeWard": before_ward,
                        "middleKp": old_kp, "middleWard": ward,
                        "quyNhonKp": get(r, 7), "quyNhonWard": "Quy Nhơn"},
        })
    if not records or len({r["id"] for r in records}) != len(records):
        raise ValueError("Master Data thiếu bản ghi hoặc bị trùng STT.")
    issues = [get(r, 0) for i, r in sheets["Cần kiểm tra"].items()
              if i >= 5 and str(get(r, 0)).isdigit()]
    if any(issue not in {"7", "12", "17", "23", "26", "27"} for issue in issues):
        raise ValueError("Danh sách vấn đề chưa xác minh thay đổi: " + str(issues))
    print(json.dumps({"records": records, "contacts": contacts, "phones": phones,
                      "history": history, "aliases": aliases, "issues": issues}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
