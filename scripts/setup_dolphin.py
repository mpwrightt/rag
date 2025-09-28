#!/usr/bin/env python3
"""
Setup script for Dolphin multimodal document parser.

This script handles the initial setup and model download for the Dolphin parser.
"""

import os
import sys
import logging
import argparse
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if required dependencies are installed."""
    required_packages = [
        'transformers',
        'torch',
        'torchvision',
        'pdf2image',
        'PIL'
    ]

    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
            logger.info(f"✓ {package} is installed")
        except ImportError:
            missing_packages.append(package)
            logger.error(f"✗ {package} is missing")

    if missing_packages:
        logger.error(f"Missing packages: {missing_packages}")
        logger.error("Install with: pip install " + " ".join(missing_packages))
        return False

    return True

def download_dolphin_model(model_path: str = "./hf_model", force: bool = False):
    """Download the Dolphin model from Hugging Face."""
    try:
        from huggingface_hub import snapshot_download
        import torch

        model_path = Path(model_path)

        if model_path.exists() and not force:
            logger.info(f"Model already exists at {model_path}")
            return True

        logger.info(f"Downloading Dolphin model to {model_path}")

        # Download model
        snapshot_download(
            repo_id="ByteDance/Dolphin",
            local_dir=str(model_path),
            local_dir_use_symlinks=False
        )

        logger.info("Model downloaded successfully")
        return True

    except ImportError:
        logger.error("huggingface_hub not installed. Install with: pip install huggingface_hub")
        return False
    except Exception as e:
        logger.error(f"Failed to download model: {e}")
        return False

def setup_environment():
    """Setup environment variables for Dolphin."""
    env_vars = {
        "DOLPHIN_MODEL_PATH": "./hf_model",
        "USE_DOLPHIN": "1",
        "DOLPHIN_PARSING_MODE": "page",
        "DOLPHIN_OUTPUT_FORMAT": "markdown",
        "DOLPHIN_CONFIDENCE_THRESHOLD": "0.7"
    }

    # Update .env file if it exists
    env_file = Path(".env")
    if env_file.exists():
        with open(env_file, "r") as f:
            content = f.read()

        # Add Dolphin config section if not present
        if "# Dolphin Configuration" not in content:
            with open(env_file, "a") as f:
                f.write("\n# Dolphin Configuration\n")
                for key, value in env_vars.items():
                    if key not in content:
                        f.write(f"{key}={value}\n")

            logger.info("Added Dolphin configuration to .env file")
    else:
        logger.warning(".env file not found. Please set environment variables manually:")
        for key, value in env_vars.items():
            logger.info(f"  {key}={value}")

def verify_setup():
    """Verify that Dolphin setup is working."""
    try:
        # Test import
        sys.path.append(str(Path(__file__).parent.parent))
        from ingestion.dolphin_parser import get_dolphin_parser, is_dolphin_available

        if not is_dolphin_available():
            logger.error("Dolphin dependencies not available")
            return False

        # Test model loading (without actually loading)
        parser = get_dolphin_parser()
        logger.info("✓ Dolphin parser initialized successfully")

        return True

    except Exception as e:
        logger.error(f"Setup verification failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Setup Dolphin document parser")
    parser.add_argument("--model-path", default="./hf_model", help="Path to store the model")
    parser.add_argument("--force-download", action="store_true", help="Force re-download of model")
    parser.add_argument("--skip-download", action="store_true", help="Skip model download")
    parser.add_argument("--verify-only", action="store_true", help="Only verify setup")

    args = parser.parse_args()

    if args.verify_only:
        success = verify_setup()
        sys.exit(0 if success else 1)

    logger.info("Setting up Dolphin document parser...")

    # Check dependencies
    if not check_dependencies():
        logger.error("Please install missing dependencies first")
        sys.exit(1)

    # Download model
    if not args.skip_download:
        if not download_dolphin_model(args.model_path, args.force_download):
            logger.error("Model download failed")
            sys.exit(1)

    # Setup environment
    setup_environment()

    # Verify setup
    if verify_setup():
        logger.info("✅ Dolphin setup completed successfully!")
        logger.info("You can now use Dolphin for document parsing")
    else:
        logger.error("❌ Setup verification failed")
        sys.exit(1)

if __name__ == "__main__":
    main()