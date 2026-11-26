FROM node:22-bookworm

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && apt-get clean

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"]
