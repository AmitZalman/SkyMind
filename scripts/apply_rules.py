import json
import re
from pathlib import Path
from copy import deepcopy

SRC = Path("data/questions.source.json")
OUT = Path("data/questions.json")
RULES = Path("rules.json")

def load_json(p: Path):
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)

def save_json(p: Path, data):
    with p.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def match(q: dict, cond: dict) -> bool:
    for k, v in cond.items():
        if k == "questionText_contains":
            if v not in q.get("questionText", ""):
                return False
        elif k == "questionText_regex":
            if not re.search(v, q.get("questionText", "")):
                return False
        else:
            if q.get(k) != v:
                return False
    return True

def apply_text_replace(q: dict, action: dict):
    targets = action.get("target", ["questionText", "explanation"])
    reps = action.get("replacements", [])

    def repl(s: str) -> str:
        out = s
        for r in reps:
            if r.get("regex"):
                out = re.sub(r["from"], r["to"], out)
            else:
                out = out.replace(r["from"], r["to"])
        return out

    if "questionText" in targets and isinstance(q.get("questionText"), str):
        q["questionText"] = repl(q["questionText"])
    if "explanation" in targets and isinstance(q.get("explanation"), str):
        q["explanation"] = repl(q["explanation"])
    if "choices" in targets and isinstance(q.get("choices"), list):
        q["choices"] = [repl(c) if isinstance(c, str) else c for c in q["choices"]]

def apply_set_fields(q: dict, action: dict):
    for k, v in action.get("fields", {}).items():
        q[k] = v

def apply_structure_migration(q: dict, migration: dict) -> dict:
    q2 = deepcopy(q)

    # rename keys
    for old, new in migration.get("rename", {}).items():
        if old in q2 and old != new:
            q2[new] = q2.pop(old)

    # drop keys
    for k in migration.get("drop", []):
        q2.pop(k, None)

    # add defaults
    for k, v in migration.get("add", {}).items():
        if k not in q2:
            q2[k] = v

    return q2

def main():
    questions = load_json(SRC)
    rules = load_json(RULES)

    if not isinstance(questions, list):
        raise ValueError("data/questions.source.json must be a JSON array")

    actions = rules.get("actions", [])
    migration = rules.get("structureMigration")

    # 1) delete
    for a in actions:
        if a.get("type") == "delete":
            cond = a.get("where", {})
            questions = [q for q in questions if not match(q, cond)]

    # 2) edit
    for a in actions:
        t = a.get("type")
        where = a.get("where", {})
        if t in ("text_replace", "set_fields"):
            for q in questions:
                if match(q, where):
                    if t == "text_replace":
                        apply_text_replace(q, a)
                    elif t == "set_fields":
                        apply_set_fields(q, a)

    # 3) add
    for a in actions:
        if a.get("type") == "add":
            questions.extend(a.get("questions", []))

    # 4) structure migration (optional)
    if migration:
        questions = [apply_structure_migration(q, migration) for q in questions]

    save_json(OUT, questions)
    print("Updated:", OUT)

if __name__ == "__main__":
    main()
