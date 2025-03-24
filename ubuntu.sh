#!/bin/bash
# Script to deploy to Ubuntu (or rather just listed steps)
sudo apt-get update
sudo apt-get install -y gnupg curl git ttf-mscorefonts-installer fontconfig jq nano redis-server

# Install Arial font
sudo fc-cache -f
# fc-match Arial

# Node and NVM
wget -q -O- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
. ~/.bashrc
nvm install node

# MongoDB (For Ubuntu 24.04)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
# sudo systemctl status mongod
sudo systemctl enable mongod

# Set up repo and bare repo for hook
mkdir aigis
git init --bare bare.git
git clone https://github.com/mdwelker10/discord-bot-aigis.git aigis
cd aigis
mkdir temp
npm install
npm install -g pm2

# Transfer files from prod directory to aigis directory (run locally from prod directory or whatever directory has these files)
# scp -i ~/.ssh/aigis-key.pem post-receive ubuntu@44.203.173.177:~/bare.git/hooks/post-receive
# scp -i ~/.ssh/aigis-key.pem .env ubuntu@44.203.173.177:~/aigis/.env
# scp -i ~/.ssh/aigis-key.pem main.pem ubuntu@44.203.173.177:~/aigis/main.pem
# scp -i ~/.ssh/aigis-key.pem -r images/ ubuntu@44.203.173.177:~/aigis/images/
