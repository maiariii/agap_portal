import sys
import json
import re
import os
import pdfplumber

def detect_position_from_items(items):
    # For now, every item number should result in the fixed position "SCA I"
    return "SCA I"

def scan_nosca(pdf_path):
    # Base fallback results
    results = {
        "serial_no": "UNKNOWN",
        "division": "",
        "school_name": "",
        "items": [],
        "position": "SCA I",
        "category": "ELEMENTARY",
        "count": 0,
        "category_breakdown": {
            "ELEMENTARY": [],
            "JHS": [],
            "SHS": [],
            "ALS": []
        },
        "raw_text": "",
        "ai_powered": False
    }

    full_text = ""
    category_items_map = {
        "ELEMENTARY": [],
        "JHS": [],
        "SHS": [],
        "ALS": []
    }
    all_seen_items = set()

    item_pattern = r"(?:OSEC[A-Z0-9\-\s]+)?(?:TCH[0-9]|SPET[0-9]?|SST[0-9]|SP[0-9]?|ADO[0-9]?|AO[0-9]?|SCA[0-9]?|PDO[0-9]?)[A-Z0-9\-\s]+20\d\d"
    current_cat = "ELEMENTARY"

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    full_text += extracted + "\n"
                    page_lower = extracted.lower()

                    # Determine category for this specific page
                    if "senior high school" in page_lower or "- shs" in page_lower:
                        current_cat = "SHS"
                    elif "alternative learning" in page_lower or "- als" in page_lower or "als " in page_lower:
                        current_cat = "ALS"
                    elif "junior high school" in page_lower or "high school" in page_lower or "national high" in page_lower:
                        current_cat = "JHS"
                        school_match = re.search(r"([A-Za-z\s\n]+?(?:National|Memorial|Integrated|Science|Vocational|City)?\s+High\s+School)", extracted, re.IGNORECASE)
                        if school_match and not results["school_name"]:
                            raw_school = school_match.group(1)
                            clean_school = re.sub(r"\s+", " ", raw_school).strip()
                            results["school_name"] = clean_school
                    elif "elementary" in page_lower or "elem " in page_lower:
                        current_cat = "ELEMENTARY"

                    items_found = re.findall(item_pattern, extracted)
                    if not items_found:
                        items_found = re.findall(r"[A-Z0-9]{2,}\s*[\-\s]\s*[\d]{5,}\s*[\-\s]\s*20\d\d", extracted)

                    clean_items = [re.sub(r"\s+", "", i) for i in items_found]
                    for item in clean_items:
                        if item not in all_seen_items:
                            all_seen_items.add(item)
                            category_items_map[current_cat].append(item)
                            results["items"].append(item)
                            
        results["raw_text"] = full_text[:2000] # store preview
    except Exception as e:
        return {"error": f"PDF reading failed: {str(e)}"}

    # Perform Smart Regex Extraction for Serial Number & Division
    try:
        # 1. Extract Serial Number
        serial_no = "UNKNOWN"
        # Try primary highly robust pattern
        sn_match = re.search(r"N[0O]SCA\s+SER[I1L]AL\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})", full_text, re.IGNORECASE)
        if not sn_match:
            # Fallback 1: without NOSCA
            sn_match = re.search(r"SER[I1L]AL\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})", full_text, re.IGNORECASE)
        if not sn_match:
            # Fallback 2: NOSCA NO
            sn_match = re.search(r"N[0O]SCA\s+N[0O]?[A-Z]*(?:[\.\s,:-]*)\s*([0-9-oilsbzg]{3,})", full_text, re.IGNORECASE)
        if not sn_match:
            # Fallback 3: Standalone serial number pattern
            sn_match = re.search(r"([0-9oilsbzg]{6,8}-[0-9oilsbzg]{2}-[0-9oilsbzg]{3})", full_text, re.IGNORECASE)
            
        if sn_match:
            raw_sn = sn_match.group(1)
            # Clean OCR lookalike characters for the serial number
            lookalike_letters = { 'O': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6' }
            cleaned_sn = "".join(lookalike_letters.get(char, char) for char in raw_sn.upper())
            serial_no = cleaned_sn
            
        results["serial_no"] = serial_no

        results["count"] = len(results["items"])

        # 2. Detect Position using prefix rule first
        prefix_pos = detect_position_from_items(results["items"])
        if prefix_pos:
            results["position"] = prefix_pos
        else:
            pos_list = ["Teacher I", "Teacher III", "Teacher IV", "Principal I", "AO II", "SCA I", "PDO I"]
            for pos in pos_list:
                if pos.lower() in full_text.lower():
                    results["position"] = pos
                    break

        # 3. Detect Division from "Division of X"
        div_match = re.search(r"Division\s+of\s+([A-Za-z\s]+?)(?:\s*-\s*|$)", full_text, re.IGNORECASE)
        if div_match:
            div_clean = div_match.group(1).replace("Senior High School", "").replace("ALS", "").strip()
            results["division"] = div_clean

        # 4. Set Category Breakdown and primary category
        results["category_breakdown"] = category_items_map
        
        # Primary category is the one with the most items, default ELEMENTARY
        max_cat = "ELEMENTARY"
        max_count = -1
        for cat, items in category_items_map.items():
            if len(items) > max_count:
                max_count = len(items)
                max_cat = cat
        if max_count > 0:
            results["category"] = max_cat

        results["ai_powered"] = True
    except Exception as e:
        results["error"] = str(e)

    return results

if __name__ == "__main__":
    if len(sys.argv) > 1:
        path = sys.argv[1]
        print(json.dumps(scan_nosca(path)))
    else:
        print(json.dumps({"error": "Usage: python scanner.py <pdf_path>"}))
