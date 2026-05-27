#!/bin/bash
set -e

echo "============================================"
echo " Face Recognition Service — Install (Linux)"
echo "============================================"
echo

if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is not installed."
    echo "Run: sudo apt install python3 python3-venv python3-pip"
    exit 1
fi

echo "Creating virtual environment..."
python3 -m venv venv

echo "Installing dependencies..."
venv/bin/pip install --upgrade pip -q
venv/bin/pip install -r requirements.txt

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

echo
echo "Pre-downloading ArcFace model (~500MB, one-time)..."
HOME=$(pwd)/data venv/bin/python -c "
from insightface.app import FaceAnalysis
a = FaceAnalysis(name='buffalo_l', root='$(pwd)/data/.insightface')
a.prepare(ctx_id=0)
print('Model ready.')
"

echo
echo "============================================"
echo " Installation complete. Run ./start.sh"
echo "============================================"
