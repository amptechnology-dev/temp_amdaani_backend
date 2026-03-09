FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS install

COPY package.json bun.lock ./

RUN mkdir -p /temp/prod
RUN cp package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . . 

ENV NODE_ENV=production
EXPOSE 8001
CMD ["bun", "start"]
