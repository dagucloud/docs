# Deployment

Choose the simplest deployment that meets the workflow's execution needs.

| Requirement | Guide |
| --- | --- |
| Run one cloud-hosted server on exe.dev, GCP, AWS, Azure, DigitalOcean, Railway, Render, or Fly.io | [Cloud Deployment](./cloud/) |
| Run one container on a machine you control | [Docker](./docker) |
| Keep configuration in a Compose file | [Docker Compose](./docker-compose) |
| Deploy into an existing Kubernetes cluster | [Kubernetes (Helm)](./kubernetes) |
| Install a native background service | [Linux systemd](./systemd), [macOS](./macos), or [Windows](./windows) |
| Isolate development, staging, and production | [Multi-Environment Deployments](./multi-environment) |

For containers, review [Docker Images](./docker-images) before choosing a tag. For execution across multiple hosts, see [Distributed Execution](/server-admin/distributed/).
