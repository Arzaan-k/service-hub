#!/usr/bin/env python3

"""
Setup Chroma DB Locally (No Docker Required)
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and provide feedback"""
    print(f"\n🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"   Error: {e.stderr}")
        return False

def main():
    print("🚀 Setting up Chroma DB locally (No Docker required)\n")

    # Check Python version
    python_version = sys.version_info
    print(f"🐍 Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")

    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("❌ Python 3.8 or higher is required for Chroma")
        return

    # Check if pip is available
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], check=True, capture_output=True)
        print("✅ pip is available")
    except subprocess.CalledProcessError:
        print("❌ pip is not available. Please install pip first.")
        return

    # Install ChromaDB
    if not run_command(f"{sys.executable} -m pip install chromadb", "Installing ChromaDB"):
        return

    # Verify installation
    try:
        result = subprocess.run([sys.executable, "-c", "import chromadb; print('ChromaDB version:', chromadb.__version__)"], check=True, capture_output=True, text=True)
        print(f"✅ ChromaDB installed: {result.stdout.strip()}")
    except subprocess.CalledProcessError:
        print("❌ ChromaDB installation verification failed")
        return

    print("\n🎉 ChromaDB setup complete!")
    print("\n🚀 To start Chroma server, run:")
    print("   chroma run --host 0.0.0.0 --port 8000")
    print("\n📝 In another terminal, start your Node.js application:")
    print("   npm run dev")
    print("\n💡 Tips:")
    print("   - The Chroma server will run on http://localhost:8000")
    print("   - Your RAG system will automatically connect to it")
    print("   - Data is stored locally in ./chroma directory")
    print("   - Stop the server with Ctrl+C")

if __name__ == "__main__":
    main()




