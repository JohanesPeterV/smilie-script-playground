#!/bin/bash

git pull && \
bun install && \
pm2 reload ecosystem.config.js --update-env
