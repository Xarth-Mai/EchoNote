#!/usr/bin/env python3
"""CLI version manager for EchoNote artifacts (non-interactive, CI-friendly).

Targets:
- package.json
- src-tauri/Cargo.toml
- src-tauri/tauri.conf.json

It validates semver and consistency across all files. Use --set to update all
versions and --check to fail CI when versions mismatch or are invalid.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError as exc:  # pragma: no cover - defensive for older runtimes
    raise SystemExit("Python 3.11+ is required (tomllib missing)") from exc


REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = REPO_ROOT / "package.json"
CARGO_TOML = REPO_ROOT / "src-tauri" / "Cargo.toml"
TAURI_CONF = REPO_ROOT / "src-tauri" / "tauri.conf.json"

SEMVER_RE = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


def validate_version(version: str) -> bool:
    """Return True if the string looks like a semver."""
    return bool(SEMVER_RE.match(version))


def read_package_version() -> str:
    with PACKAGE_JSON.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    return str(data.get("version", ""))


def write_package_version(version: str) -> None:
    with PACKAGE_JSON.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    data["version"] = version
    with PACKAGE_JSON.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=2, ensure_ascii=False)
        fp.write("\n")


def read_tauri_version() -> str:
    with TAURI_CONF.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    return str(data.get("version", ""))


def write_tauri_version(version: str) -> None:
    with TAURI_CONF.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    data["version"] = version
    with TAURI_CONF.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=2, ensure_ascii=False)
        fp.write("\n")


def read_cargo_version() -> str:
    with CARGO_TOML.open("rb") as fp:
        data = tomllib.load(fp)
    return str(data.get("package", {}).get("version", ""))


def write_cargo_version(version: str) -> None:
    content = CARGO_TOML.read_text(encoding="utf-8")
    updated, count = re.subn(
        r'(?m)^version\s*=\s*"(.*?)"', f'version = "{version}"', content, count=1
    )
    if count == 0:
        raise ValueError("未找到 Cargo.toml 中的 version 字段")
    CARGO_TOML.write_text(updated, encoding="utf-8")


def load_versions() -> dict[str, str]:
    return {
        "package.json": read_package_version(),
        "Cargo.toml": read_cargo_version(),
        "tauri.conf.json": read_tauri_version(),
    }


def print_status(versions: dict[str, str]) -> bool:
    print("\n当前版本状态：")
    for name, ver in versions.items():
        flag = "OK" if validate_version(ver) else "非法"
        print(f"- {name:20} {ver or '[缺失]'} ({flag})")

    unique_versions = {ver for ver in versions.values() if ver}
    consistent = len(unique_versions) == 1 and all(
        validate_version(v) for v in unique_versions
    )
    if consistent:
        print("所有文件版本号一致且合法。")
    else:
        print("版本号不一致或存在非法格式，请按需更新。")
    return consistent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="管理 EchoNote 前端/后端版本号 (semver)。",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--set",
        dest="new_version",
        help="写入新的版本号到 package.json、Cargo.toml、tauri.conf.json（semver）。",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="仅验证合法性与一致性；不一致时退出码为 1，便于 CI 使用。",
    )
    return parser.parse_args()


def update_all_versions(new_version: str) -> None:
    write_package_version(new_version)
    write_cargo_version(new_version)
    write_tauri_version(new_version)


def main() -> None:
    args = parse_args()
    versions = load_versions()
    consistent = print_status(versions)

    if args.new_version:
        if not validate_version(args.new_version):
            sys.exit("提供的版本号格式非法，请输入有效的 semver（例：1.2.3、1.2.3-beta.1）。")
        update_all_versions(args.new_version)
        print(f"\n已更新版本号为 {args.new_version}。")
        versions = load_versions()
        consistent = print_status(versions)

    if args.check:
        sys.exit(0 if consistent else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\n已中断。")
