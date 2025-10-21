#!/bin/bash

# Update the system
sudo apt-get update
sudo apt-get upgrade -y

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Reload the shell
source ~/.bashrc

# Install Node.js LTS
nvm install --lts

# Bun needs unzip
sudo apt-get install unzip

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload the shell
source ~/.bashrc

# Install PM2
npm install -g pm2
