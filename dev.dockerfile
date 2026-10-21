FROM node:22.23.4-bookworm-slim

WORKDIR /app
RUN mkdir temp
COPY package*.json ./

RUN apt-get update && apt-get install -y curl nano ffmpeg \
    fonts-liberation build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod +x /usr/local/bin/yt-dlp

RUN npm ci
RUN npm install pm2 -g

COPY . ./

ENV DEV=1

CMD [ "pm2-runtime", "start", "ecosystem.dev.config.js" ]
# CMD ["tail", "-f", "/dev/null"]