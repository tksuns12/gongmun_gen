FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-lang-korean \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.js index.html ./

EXPOSE 3000
CMD ["node", "server.js"]
