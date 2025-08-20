import json
import os
import requests

DATA_DIR = "citenova_web/public/data"

# Only McMaster and Queen's, matching your filenames
UNI_MAP = {
    "McMaster_University": "McMaster University",
    "Queens_University": "Queen's University"
}

def fetch_work(work_id: str):
    """Fetch full work metadata from OpenAlex"""
    url = f"https://api.openalex.org/works/{work_id.split('/')[-1]}"
    resp = requests.get(url, timeout=30)
    if resp.status_code == 200:
        return resp.json()
    else:
        print(f"❌ Failed to fetch {work_id}: {resp.status_code}")
        return None

def process_limitations_file(file_path, institution_name):
    """Read limitations, fetch authors, and save contacts"""
    with open(file_path, "r", encoding="utf-8") as f:
        limitations_data = json.load(f)

    contacts = {}

    for work_id, details in limitations_data.items():
        if not details.get("bullets"):
            continue

        work_data = fetch_work(work_id)
        if not work_data:
            continue

        title = work_data.get("title", "Unknown Title")
        authors_list = []

        for author in work_data.get("authorships", []):
            insts = [i.get("display_name") for i in author.get("institutions", [])]
            if institution_name in insts:
                authors_list.append({
                    "name": author.get("author", {}).get("display_name", "Unknown"),
                    "institution": institution_name
                })

        if authors_list:
            contacts[work_id] = {
                "title": title,
                "authors": authors_list
            }

    out_path = file_path.replace("_limitations.json", "_contacts.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(contacts, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {out_path} with {len(contacts)} entries")

def main():
    for uni_key, inst_name in UNI_MAP.items():
        file_name = f"{uni_key}_limitations.json"
        file_path = os.path.join(DATA_DIR, file_name)
        if os.path.exists(file_path):
            print(f"🔎 Processing {file_name} ...")
            process_limitations_file(file_path, inst_name)
        else:
            print(f"⚠️ File not found: {file_name}")

if __name__ == "__main__":
    main()
