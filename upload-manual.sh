#!/bin/bash

# Script to upload a single manual using curl
# Usage: ./upload-manual.sh <path-to-pdf> [manual-name]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path-to-pdf> [manual-name]"
    exit 1
fi

PDF_PATH="$1"
MANUAL_NAME="${2:-$(basename "$PDF_PATH" .pdf)}"

echo "Uploading: $PDF_PATH"
echo "Name: $MANUAL_NAME"

curl -X POST \
  -F "file=@$PDF_PATH" \
  -F "name=$MANUAL_NAME" \
  -F "version=1.0" \
  http://localhost:5000/api/manuals/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"

echo -e "\nDone."





