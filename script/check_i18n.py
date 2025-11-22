#!/usr/bin/env python3
"""
Ensures every locale dictionary stays synchronized with the English source.
"""

import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Sequence

BASE_LOCALE = "en"
SCRIPT_DIR = Path(__file__).resolve().parent
LOCALES_DIR = (
    SCRIPT_DIR
    .parent
    / "src"
    / "utils"
    / "i18n"
    / "locales"
)

OBJECT_PATTERN = re.compile(
    r"const\s+\w+\s*=\s*(\{[\s\S]*?\})\s*as const;",
    re.MULTILINE,
)
KEY_PATTERN = re.compile(r"^\s*([A-Za-z0-9_]+):", re.MULTILINE)


def extract_keys_from_file(path: Path) -> List[str]:
    raw = path.read_text(encoding="utf-8")
    match = OBJECT_PATTERN.search(raw)
    if not match:
        raise ValueError("translation dictionary object is missing or malformed")
    block = match.group(1)
    return KEY_PATTERN.findall(block)


def duplicates_from_list(items: Sequence[str]) -> List[str]:
    return sorted({item for item, count in Counter(items).items() if count > 1})


def format_list(items: Iterable[str]) -> str:
    return ", ".join(items)


def check_i18n_keys() -> bool:
    if not LOCALES_DIR.exists():
        print(f"Error: could not locate {LOCALES_DIR}")
        return False

    locale_files = sorted(
        path
        for path in LOCALES_DIR.glob("*.ts")
        if path.is_file() and path.name != "index.ts"
    )

    if not locale_files:
        print(f"Warning: no locale files found under {LOCALES_DIR}")
        return False

    locale_map = {}
    for path in locale_files:
        try:
            locale_map[path.stem] = extract_keys_from_file(path)
        except ValueError as error:
            print(f"Error parsing {path.name}: {error}")
            return False

    base_keys = set(locale_map.get(BASE_LOCALE, []))

    if not base_keys:
        print(f"Error: base locale '{BASE_LOCALE}' is missing or empty")
        return False

    print(f"Loaded {len(locale_map)} locale dictionaries from {LOCALES_DIR}.")
    print(f"Base locale '{BASE_LOCALE}' defines {len(base_keys)} keys.")

    has_errors = False
    base_duplicates = duplicates_from_list(locale_map[BASE_LOCALE])
    if base_duplicates:
        has_errors = True
        print(
            f"[ERROR] base locale '{BASE_LOCALE}' contains duplicate keys: "
            f"{format_list(base_duplicates)}",
        )
    else:
        print(f"[OK] no duplicate keys in '{BASE_LOCALE}'.")

    for locale in sorted(locale_map):
        if locale == BASE_LOCALE:
            continue
        keys = locale_map[locale]
        locale_file = LOCALES_DIR / f"{locale}.ts"
        print(f"\nChecking locale '{locale}' ({locale_file.name})")
        locale_has_issues = False

        duplicates = duplicates_from_list(keys)
        if duplicates:
            locale_has_issues = True
            has_errors = True
            print(f"  - [ERROR] duplicate keys: {format_list(duplicates)}")

        missing = sorted(base_keys - set(keys))
        extra = sorted(set(keys) - base_keys)

        if missing:
            locale_has_issues = True
            has_errors = True
            print(f"  - [ERROR] missing {len(missing)} keys: {format_list(missing)}")

        if extra:
            locale_has_issues = True
            has_errors = True
            print(f"  - [ERROR] extra {len(extra)} keys: {format_list(extra)}")

        if not locale_has_issues:
            print("  - [OK] keys match the base locale and have no duplicates.")

    if has_errors:
        print("\nFound i18n inconsistencies. Please review the errors above.")
    else:
        print("\nAll translation dictionaries are synchronized! ✨")

    return not has_errors


if __name__ == "__main__":
    sys.exit(0 if check_i18n_keys() else 1)
