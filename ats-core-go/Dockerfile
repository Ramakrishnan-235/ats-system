# Multi-stage build for ultra-small container footprint
FROM golang:1.27-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o ats-core-server ./cmd/server

# Final minimal stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/ats-core-server .
RUN addgroup -S ats && adduser -S -G ats ats \
    && mkdir -p /app/uploads && chown ats:ats /app/uploads

USER ats

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["./ats-core-server"]
