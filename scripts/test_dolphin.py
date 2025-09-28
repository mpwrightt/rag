#!/usr/bin/env python3
"""
Test script for Dolphin document parser integration.

This script tests the Dolphin parser with sample documents and compares
the output with traditional parsers.
"""

import os
import sys
import logging
import argparse
import time
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_dolphin_parser(test_file: str) -> Dict[str, Any]:
    """Test Dolphin parser with a sample document."""
    try:
        from ingestion.dolphin_parser import get_dolphin_parser, is_dolphin_available

        if not is_dolphin_available():
            return {"error": "Dolphin not available"}

        parser = get_dolphin_parser()
        start_time = time.time()

        content, metadata = parser.parse_document(test_file)

        end_time = time.time()

        return {
            "success": True,
            "content_length": len(content),
            "processing_time": end_time - start_time,
            "metadata": metadata,
            "content_preview": content[:500] + "..." if len(content) > 500 else content
        }

    except Exception as e:
        return {"error": str(e)}

def test_traditional_parser(test_file: str) -> Dict[str, Any]:
    """Test traditional parser for comparison."""
    try:
        from ingestion.converters import convert_to_markdown

        # Temporarily disable Dolphin
        os.environ["USE_DOLPHIN"] = "0"

        start_time = time.time()
        content, metadata = convert_to_markdown(test_file)
        end_time = time.time()

        # Re-enable Dolphin
        os.environ["USE_DOLPHIN"] = "1"

        return {
            "success": True,
            "content_length": len(content),
            "processing_time": end_time - start_time,
            "metadata": metadata,
            "content_preview": content[:500] + "..." if len(content) > 500 else content
        }

    except Exception as e:
        return {"error": str(e)}

def test_proposal_analyzer(test_file: str) -> Dict[str, Any]:
    """Test proposal analyzer with Dolphin integration."""
    try:
        from agent.proposal_analyzer import extract_text_or_markdown, analyze_example_text

        start_time = time.time()

        # Extract text using enhanced parser
        text = extract_text_or_markdown(test_file)

        # Analyze the text
        analysis = analyze_example_text(text)

        end_time = time.time()

        return {
            "success": True,
            "text_length": len(text),
            "processing_time": end_time - start_time,
            "analysis": {
                "total_sections": analysis.get("structure_analysis", {}).get("total_sections", 0),
                "has_tables": analysis.get("structure_analysis", {}).get("has_tables", False),
                "has_formulas": analysis.get("structure_analysis", {}).get("has_formulas", False),
                "section_types": analysis.get("structure_analysis", {}).get("section_types", {}),
                "readability_grade": analysis.get("readability", {}).get("grade_level_proxy", "N/A")
            },
            "text_preview": text[:300] + "..." if len(text) > 300 else text
        }

    except Exception as e:
        return {"error": str(e)}

def compare_parsers(test_file: str) -> Dict[str, Any]:
    """Compare Dolphin and traditional parsers."""
    logger.info(f"Testing with file: {test_file}")

    # Test Dolphin parser
    logger.info("Testing Dolphin parser...")
    dolphin_result = test_dolphin_parser(test_file)

    # Test traditional parser
    logger.info("Testing traditional parser...")
    traditional_result = test_traditional_parser(test_file)

    # Test proposal analyzer
    logger.info("Testing proposal analyzer...")
    analyzer_result = test_proposal_analyzer(test_file)

    comparison = {
        "test_file": test_file,
        "dolphin": dolphin_result,
        "traditional": traditional_result,
        "proposal_analyzer": analyzer_result
    }

    # Add comparison metrics
    if dolphin_result.get("success") and traditional_result.get("success"):
        comparison["metrics"] = {
            "content_length_ratio": dolphin_result["content_length"] / max(traditional_result["content_length"], 1),
            "speed_ratio": traditional_result["processing_time"] / max(dolphin_result["processing_time"], 0.001),
            "dolphin_faster": dolphin_result["processing_time"] < traditional_result["processing_time"]
        }

    return comparison

def print_comparison_results(results: Dict[str, Any]):
    """Print formatted comparison results."""
    print("\n" + "="*80)
    print(f"DOCUMENT PARSING COMPARISON: {results['test_file']}")
    print("="*80)

    # Dolphin results
    print("\n📊 DOLPHIN PARSER RESULTS:")
    if results["dolphin"].get("success"):
        print(f"✅ Success")
        print(f"📄 Content Length: {results['dolphin']['content_length']:,} characters")
        print(f"⏱️  Processing Time: {results['dolphin']['processing_time']:.2f} seconds")
        print(f"🏷️  Parser: {results['dolphin']['metadata'].get('parser', 'unknown')}")
        print(f"📝 Preview: {results['dolphin']['content_preview'][:200]}...")
    else:
        print(f"❌ Error: {results['dolphin'].get('error')}")

    # Traditional results
    print("\n📊 TRADITIONAL PARSER RESULTS:")
    if results["traditional"].get("success"):
        print(f"✅ Success")
        print(f"📄 Content Length: {results['traditional']['content_length']:,} characters")
        print(f"⏱️  Processing Time: {results['traditional']['processing_time']:.2f} seconds")
        print(f"🏷️  Parser: {results['traditional']['metadata'].get('note', 'traditional')}")
        print(f"📝 Preview: {results['traditional']['content_preview'][:200]}...")
    else:
        print(f"❌ Error: {results['traditional'].get('error')}")

    # Proposal analyzer results
    print("\n📊 PROPOSAL ANALYZER RESULTS:")
    if results["proposal_analyzer"].get("success"):
        print(f"✅ Success")
        print(f"📄 Text Length: {results['proposal_analyzer']['text_length']:,} characters")
        print(f"⏱️  Processing Time: {results['proposal_analyzer']['processing_time']:.2f} seconds")
        analysis = results['proposal_analyzer']['analysis']
        print(f"📋 Sections Found: {analysis['total_sections']}")
        print(f"🗃️  Has Tables: {analysis['has_tables']}")
        print(f"🧮 Has Formulas: {analysis['has_formulas']}")
        print(f"📊 Section Types: {analysis['section_types']}")
        print(f"📚 Reading Level: Grade {analysis['readability_grade']}")
    else:
        print(f"❌ Error: {results['proposal_analyzer'].get('error')}")

    # Comparison metrics
    if "metrics" in results:
        print("\n📈 COMPARISON METRICS:")
        metrics = results["metrics"]
        print(f"📊 Content Length Ratio (Dolphin/Traditional): {metrics['content_length_ratio']:.2f}x")
        print(f"🚀 Speed Ratio (Traditional/Dolphin): {metrics['speed_ratio']:.2f}x")
        print(f"⚡ Dolphin Faster: {'Yes' if metrics['dolphin_faster'] else 'No'}")

        if metrics['content_length_ratio'] > 1.2:
            print("🎉 Dolphin extracted significantly more content!")
        elif metrics['content_length_ratio'] < 0.8:
            print("⚠️  Traditional parser extracted more content")
        else:
            print("📊 Similar content extraction")

def find_test_files(directory: str = ".") -> List[str]:
    """Find PDF files for testing."""
    pdf_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_files.append(os.path.join(root, file))
    return pdf_files[:5]  # Limit to 5 files for testing

def run_benchmark(test_files: List[str]) -> Dict[str, Any]:
    """Run benchmark across multiple files."""
    benchmark_results = {
        "total_files": len(test_files),
        "successful_tests": 0,
        "total_dolphin_time": 0,
        "total_traditional_time": 0,
        "dolphin_wins": 0,
        "traditional_wins": 0,
        "file_results": []
    }

    for test_file in test_files:
        try:
            results = compare_parsers(test_file)
            benchmark_results["file_results"].append(results)

            if results["dolphin"].get("success"):
                benchmark_results["total_dolphin_time"] += results["dolphin"]["processing_time"]

            if results["traditional"].get("success"):
                benchmark_results["total_traditional_time"] += results["traditional"]["processing_time"]

            if "metrics" in results:
                if results["metrics"]["dolphin_faster"]:
                    benchmark_results["dolphin_wins"] += 1
                else:
                    benchmark_results["traditional_wins"] += 1

            benchmark_results["successful_tests"] += 1

        except Exception as e:
            logger.error(f"Benchmark failed for {test_file}: {e}")

    return benchmark_results

def print_benchmark_summary(benchmark: Dict[str, Any]):
    """Print benchmark summary."""
    print("\n" + "="*80)
    print("BENCHMARK SUMMARY")
    print("="*80)

    print(f"\n📊 Files Tested: {benchmark['successful_tests']}/{benchmark['total_files']}")
    print(f"⚡ Speed Winners: Dolphin {benchmark['dolphin_wins']}, Traditional {benchmark['traditional_wins']}")

    if benchmark['total_dolphin_time'] > 0 and benchmark['total_traditional_time'] > 0:
        avg_dolphin = benchmark['total_dolphin_time'] / benchmark['successful_tests']
        avg_traditional = benchmark['total_traditional_time'] / benchmark['successful_tests']
        print(f"🕒 Average Processing Time:")
        print(f"   - Dolphin: {avg_dolphin:.2f}s")
        print(f"   - Traditional: {avg_traditional:.2f}s")
        print(f"   - Speed Ratio: {avg_traditional/avg_dolphin:.2f}x")

def main():
    parser = argparse.ArgumentParser(description="Test Dolphin document parser")
    parser.add_argument("--file", help="Specific file to test")
    parser.add_argument("--directory", default=".", help="Directory to search for test files")
    parser.add_argument("--batch", action="store_true", help="Test multiple files")
    parser.add_argument("--benchmark", action="store_true", help="Run performance benchmark")

    args = parser.parse_args()

    if args.file:
        if not os.path.exists(args.file):
            logger.error(f"File not found: {args.file}")
            sys.exit(1)

        results = compare_parsers(args.file)
        print_comparison_results(results)

    elif args.batch or args.benchmark:
        test_files = find_test_files(args.directory)
        if not test_files:
            logger.error("No PDF files found for testing")
            sys.exit(1)

        logger.info(f"Found {len(test_files)} PDF files for testing")

        if args.benchmark:
            benchmark = run_benchmark(test_files)
            print_benchmark_summary(benchmark)
        else:
            for test_file in test_files:
                try:
                    results = compare_parsers(test_file)
                    print_comparison_results(results)
                    print("\n" + "-"*80 + "\n")
                    time.sleep(1)  # Brief pause between tests
                except KeyboardInterrupt:
                    logger.info("Testing interrupted by user")
                    break
                except Exception as e:
                    logger.error(f"Error testing {test_file}: {e}")
                    continue

    else:
        logger.error("Please specify --file, --batch, or --benchmark option")
        sys.exit(1)

if __name__ == "__main__":
    main()