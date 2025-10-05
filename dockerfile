FROM arm64v8/node:22-bookworm-slim

WORKDIR /app
RUN mkdir temp
COPY package*.json ./

RUN apt-get update && apt-get install -y curl nano ffmpeg python3 python3-pip \
    fonts-liberation build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install
RUN npm install pm2 -g

COPY . ./

ENTRYPOINT [ "npm", "run", "start" ]