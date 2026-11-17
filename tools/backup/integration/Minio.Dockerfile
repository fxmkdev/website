# Build pinned upstream source: MinIO no longer serves its community images
# reliably from Docker Hub/Quay. This fixture never exposes host ports.
FROM golang:1.24 AS build
RUN CGO_ENABLED=0 GOMAXPROCS=2 go install -p=2 github.com/minio/minio@RELEASE.2025-09-07T16-13-09Z

FROM scratch
COPY --from=build /go/bin/minio /minio
ENTRYPOINT ["/minio"]
