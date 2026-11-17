# Local development image: runs the Next.js dev server with hot reload.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/app/data \
    WATCHPACK_POLLING=true

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
