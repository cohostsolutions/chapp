#!/bin/bash
# Warning Analysis Script
# Run this to see detailed warning breakdown

echo "=== ESLint Warning Analysis ==="
echo ""
echo "By Category:"
echo "--------"
npm run lint 2>&1 | grep -o "@[a-z-]*" | sort | uniq -c | sort -rn
echo ""
echo "By Rule:"
echo "--------"
npm run lint 2>&1 | grep -oP "(?<=\()\S+(?=\))" | sort | uniq -c | sort -rn | head -20
echo ""
echo "By File (Top 20):"
echo "--------"
npm run lint 2>&1 | grep "src/" | cut -d: -f1 | sort | uniq -c | sort -rn | head -20
echo ""
echo "Full Output:"
echo "--------"
npm run lint 2>&1 | tail -100
