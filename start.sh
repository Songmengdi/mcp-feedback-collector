#!/bin/bash

pkill -f "smd-mcp-feedback-collector" || true

nohup npx smd-mcp-feedback-collector@1.2.0 > /tmp/smd-mcp.log 2>&1 &