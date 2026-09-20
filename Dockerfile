FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    verilator \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY . .

WORKDIR /app/frontend

RUN npm install
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port $PORT"]