#!/bin/bash
# This is for cloud deployment
# Script to deploy to Ubuntu (or rather just listed steps)
sudo apt-get update
sudo apt-get install -y gnupg curl git ttf-mscorefonts-installer fontconfig jq nano redis-server ffmpeg python3-pip
pip install -U yt-dlp # install yt-dlp
# TODO: add command to permanently update PATH to include $HOME/.local/bin

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
sudo apt-get install mongodb-org -y

sudo systemctl enable redis-server && sudo systemctl start redis-server
sudo systemctl enable mongod && sudo systemctl start mongod
sudo systemctl enable ssh && sudo systemctl start ssh
# sudo systemctl status mongod

# Set up repo and bare repo for hook
mkdir aigis
git init --bare bare.git
git clone https://github.com/mdwelker10/discord-bot-aigis.git aigis
cd aigis
mkdir temp
npm install
npm install -g pm2
npx playwright install-deps
npx playwright install

# Transfer files from prod directory to aigis directory (run locally from prod directory or whatever directory has these files)
# scp -i ~/.ssh/aigis-key.pem post-receive <username>@<ip>:~/bare.git/hooks/post-receive
# scp -i ~/.ssh/aigis-key.pem .ene <username>@<ip>:~/aigis/.env
# scp -i ~/.ssh/aigis-key.pem main.pee <username>@<ip>:~/aigis/main.pem
# scp -i ~/.ssh/aigis-key.pem -r imagese <username>@<ip>:~/aigis/images/
