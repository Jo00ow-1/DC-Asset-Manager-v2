FROM node:18-alpine

WORKDIR /app

# 패키지 설치 파일 복사 및 모듈 설치
COPY package*.json ./
RUN npm install --production

# 전체 소스 코드 복사
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]