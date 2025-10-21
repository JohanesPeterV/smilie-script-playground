#!/bin/bash

# Update the system
sudo apt-get update && \
sudo apt-get upgrade -y && \

# Bun needs unzip
sudo apt-get install unzip && \

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \

# Reload the shell
source ~/.bashrc && \

# Install Node.js LTS
nvm install --lts && \

# Install Bun
curl -fsSL https://bun.sh/install | bash && \

# Reload the shell
source ~/.bashrc && \

# Install PM2
npm install -g pm2 && \

echo "Server setup complete"
