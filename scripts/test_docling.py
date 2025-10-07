"""
Test script for Docling document parser integration.
"""
import sys
import os
from pathlib import Path

# Add parent directory to path to import ingestion module
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.docling_parser import is_docling_available, get_docling_parser
from ingestion.converters import convert_to_markdown


def test_docling_availability():
    """Test if Docling is available."""
    print("Testing Docling availability...")
    if is_docling_available():
        print("✅ Docling is installed and available")
        return True
    else:
        print("❌ Docling is NOT available")
        print("Install with: pip install docling")
        return False


def test_docling_parser_init():
    """Test Docling parser initialization."""
    print("\nTesting Docling parser initialization...")
    try:
        parser = get_docling_parser()
        if parser:
            print("✅ Docling parser initialized successfully")
            return True
        else:
            print("❌ Failed to initialize Docling parser")
            return False
    except Exception as e:
        print(f"❌ Error initializing Docling parser: {e}")
        return False


def test_document_parsing(file_path: str):
    """Test parsing a specific document."""
    path = Path(file_path)
    if not path.exists():
        print(f"❌ File not found: {file_path}")
        return False

    print(f"\nTesting document parsing: {path.name}")
    print(f"File size: {path.stat().st_size / 1024:.2f} KB")

    try:
        # Set environment to enable Docling
        os.environ["USE_DOCLING"] = "1"

        # Parse the document
        content, metadata = convert_to_markdown(str(path))

        if content:
            print(f"✅ Successfully parsed document")
            print(f"   Parser used: {metadata.get('parser', 'unknown')}")
            print(f"   Content length: {len(content)} characters")
            print(f"   Content preview (first 200 chars):")
            print(f"   {content[:200]}...")
            return True
        else:
            print("❌ Parsing returned empty content")
            return False

    except Exception as e:
        print(f"❌ Error parsing document: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Docling Integration Test Suite")
    print("=" * 60)

    results = []

    # Test 1: Availability
    results.append(("Availability", test_docling_availability()))

    # Test 2: Parser initialization
    results.append(("Initialization", test_docling_parser_init()))

    # Test 3: Document parsing (if file path provided)
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        results.append(("Document Parsing", test_document_parsing(file_path)))
    else:
        print("\nℹ️  Tip: Provide a file path to test document parsing")
        print("   Example: python scripts/test_docling.py path/to/document.pdf")

    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20s}: {status}")

    print(f"\nTotal: {passed}/{total} tests passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
