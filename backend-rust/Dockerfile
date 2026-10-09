FROM rust:1.98-bookworm AS build
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY taxonomy-seed.json ./
RUN cargo build --release --locked -j 2 --bin ats-backend

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 ats
COPY --from=build /build/target/release/ats-backend /usr/local/bin/ats-backend
USER ats
EXPOSE 8080
ENTRYPOINT ["ats-backend"]
