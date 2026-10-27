"""Render Trivy JSON findings in logs and the GitHub Actions run summary.

Trivy writes JSON artifacts, which are useful to download but do not expose
findings directly in the run summary. This shared helper keeps the presentation
consistent across the three images and the PR/preprod and main workflows,
instead of duplicating report formatting in inline YAML commands.

Python's standard library handles JSON parsing, Markdown/HTML escaping and
missing reports without additional packages on the GitHub-hosted Ubuntu runner.
Python is a convenience here, not a requirement of Trivy; jq could also format
these reports. This script only presents the already-filtered scan results:
Trivy owns vulnerability detection and the CRITICAL/fix-available failure rule.
It runs in GitHub Actions, never on the production VPS.
"""
import html
import json
import os
from pathlib import Path
import sys


def cell(value):
    return html.escape(str(value)).replace("|", "&#124;").replace("\n", " ").replace("\r", " ")


def summarize(path):
    heading = f"### {cell(path.stem)}"
    if not path.is_file():
        return f"{heading}\n\nReport unavailable; check the build and scan logs.\n"
    report = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for result in report.get("Results") or []:
        for finding in result.get("Vulnerabilities") or []:
            rows.append("| " + " | ".join(cell(value) for value in [
                result.get("Target", ""), finding.get("VulnerabilityID", ""),
                finding.get("PkgName", ""), finding.get("InstalledVersion", ""),
                finding.get("FixedVersion", ""),
            ]) + " |")
    if not rows:
        return f"{heading}\n\nNo fixable CRITICAL vulnerabilities reported.\n"
    return (f"{heading}\n\nFixable CRITICAL findings: {len(rows)}\n\n"
            "| Target | CVE | Package | Installed | Fixed |\n"
            "| --- | --- | --- | --- | --- |\n" + "\n".join(rows) + "\n")


def main(paths):
    output = "## Container vulnerability scans\n\n" + "\n".join(summarize(Path(p)) for p in paths)
    print(output)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(output + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
