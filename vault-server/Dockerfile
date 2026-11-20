FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs init-vault.sql ./

EXPOSE 8787

CMD ["node", "server.mjs"]
