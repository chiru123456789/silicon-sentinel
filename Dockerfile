FROM node:20-bookworm

WORKDIR /app

# Install Python, Verilator and build tools
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    verilator \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy repository
COPY . .

# Install and build Next.js application
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Return to repository root because the verification engine lives here
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Railway/Render supplies PORT
CMD ["sh", "-c", "cd /app/frontend && npm start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]