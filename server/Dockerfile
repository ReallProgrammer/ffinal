FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 libassimp5 util-linux && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
EXPOSE 8787
CMD ["node", "src/index.mjs"]
