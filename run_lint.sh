#!/bin/bash
cd /workspaces/canvascapital
npm run lint 2>&1 | tee lint_results.txt
