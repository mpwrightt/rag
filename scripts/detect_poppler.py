#!/usr/bin/env python3
"""
Detect and export POPPLER_PATH for Replit/Nix environments.
Run this at startup to find poppler-utils in /nix/store.
"""

import os
import glob
import sys

def find_poppler_path():
    """Find poppler-utils in Nix store and return the bin directory."""
    if not os.path.exists("/nix/store"):
        print("Not running in Nix environment", file=sys.stderr)
        return None

    # Search for poppler-utils directories
    candidates = []
    candidates += glob.glob("/nix/store/*-poppler-utils-*/bin")
    candidates += glob.glob("/nix/store/*-poppler-*/bin")

    # Sort to get highest version
    candidates.sort(reverse=True)

    for candidate in candidates:
        pdftoppm = os.path.join(candidate, "pdftoppm")
        if os.path.exists(pdftoppm) and os.access(pdftoppm, os.X_OK):
            return candidate

    return None

if __name__ == "__main__":
    poppler_path = find_poppler_path()
    if poppler_path:
        print(f"POPPLER_PATH={poppler_path}")
        print(f"Found pdftoppm at: {poppler_path}/pdftoppm", file=sys.stderr)
    else:
        print("Could not find poppler-utils", file=sys.stderr)
        sys.exit(1)