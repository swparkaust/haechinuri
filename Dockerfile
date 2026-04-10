FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY haechinuri/ ./haechinuri/
COPY sites/ ./sites/

RUN mkdir -p dist

ARG SITE_NAME=example
ENV SITE_NAME=${SITE_NAME}
ENV PORT=3000
ENV ADMIN_PASSWORD=changeme

RUN node haechinuri/bin/cli.js build ${SITE_NAME}

EXPOSE ${PORT}

CMD node haechinuri/bin/cli.js build ${SITE_NAME} && node haechinuri/bin/cli.js serve ${SITE_NAME}
