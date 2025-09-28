from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ingestion.converters import convert_to_markdown  # type: ignore
from agent.proposal_analyzer import analyze_example_text


def main() -> None:
    path = Path('docs/example/Example.pdf')
    text, _ = convert_to_markdown(str(path))
    analysis = analyze_example_text(text or '')

    # Trim large content payloads so output is manageable
    sections = []
    for entry in analysis.get('sections', [])[:20]:
        sections.append({
            'title': entry.get('title', '').strip(),
            'preview': ' '.join((entry.get('content') or '').split())[:240]
        })

    tasks = []
    for task in analysis.get('task_sections', [])[:10]:
        tasks.append({
            'task_id': task.get('task_id'),
            'title': task.get('title'),
            'preview': task.get('preview')
        })

    result = {
        'letter_structure': analysis.get('letter_structure'),
        'section_outline': analysis.get('section_outline'),
        'sections_preview': sections,
        'task_sections': tasks,
    }

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
