FROM denoland/deno:latest
WORKDIR /app
COPY deno-server.js .
COPY public ./public
RUN deno cache deno-server.js
EXPOSE 10000
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "deno-server.js"]
