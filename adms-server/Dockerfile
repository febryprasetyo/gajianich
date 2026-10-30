FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY migrations ./migrations
USER node
ENV NODE_ENV=production PORT=8081 TZ=Asia/Jakarta
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]

FROM base AS test
COPY test ./test
CMD ["npm", "test"]

FROM base AS production
