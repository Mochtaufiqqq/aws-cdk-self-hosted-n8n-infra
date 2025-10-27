# 🚀 AWS CDK N8N Self-Hosted Infrastructure

This project provides a self-hosted N8N workflow automation platform deployment using AWS CDK. The architecture utilizes N8N in queue mode to create a highly performant and scalable infrastructure.

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Technologies](#-technologies)
- [Prerequisites](#-prerequisites)
- [Setup Steps](#-setup-steps)
- [Deployment](#-deployment)
- [Environment Configurations](#-environment-configurations)
- [Stack Structure](#-stack-structure)

## 🏗️ Architecture Overview

This project runs N8N in **Queue Mode**. This architecture enables workflows to run in a scalable and high-performance manner:

```
┌─────────────────────────────────────────────────────────┐
│                    AWS Cloud                            │
│                                                         │
│  ┌───────────────┐         ┌─────────────────┐        │
│  │               │         │                 │        │
│  │  Application  │◄────────│   N8N Main      │        │
│  │  Load Balancer│         │   Service       │        │
│  │  (ALB)        │         │  (ECS Fargate)  │        │
│  │               │         │                 │        │
│  └───────────────┘         └────────┬────────┘        │
│         ▲                           │                  │
│         │                           │                  │
│         │                           ▼                  │
│    HTTPS/TLS              ┌─────────────────┐         │
│         │                 │                 │         │
│         │                 │  ElastiCache    │         │
│    ┌────┴─────┐          │  Redis/Valkey   │         │
│    │  Users   │          │  (Queue)        │         │
│    └──────────┘          └────────┬────────┘         │
│                                   │                   │
│                                   │                   │
│                          ┌────────▼────────┐         │
│                          │                 │         │
│                          │  N8N Worker     │         │
│                          │  Service        │         │
│                          │ (ECS Fargate)   │         │
│                          │                 │         │
│                          └────────┬────────┘         │
│                                   │                   │
│                          ┌────────▼────────┐         │
│                          │                 │         │
│                          │  RDS PostgreSQL │         │
│                          │  (Database)     │         │
│                          │                 │         │
│                          └─────────────────┘         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Architecture Components

1. **N8N Main Service (ECS Fargate)**
   - Provides Web UI and API endpoints
   - Adds workflows to Redis queue
   - Runs behind Application Load Balancer
   - Auto-scaling with load balancing

2. **N8N Worker Service (ECS Fargate)**
   - Retrieves and processes workflows from queue
   - Runs with high concurrency (100)
   - CPU/Memory based auto-scaling
   - Scales with multiple worker instances

3. **ElastiCache Redis/Valkey**
   - Used for queue management
   - Enables communication between Main and Worker services
   - Configurable for high-availability

4. **RDS PostgreSQL**
   - Database for N8N
   - Stores workflow definitions and execution history
   - Automatic backups and encryption

5. **Application Load Balancer**
   - HTTPS/TLS termination
   - HTTP to HTTPS redirect
   - Health check monitoring

## 🛠️ Technologies

- **Infrastructure as Code**: AWS CDK (TypeScript)
- **Container Orchestration**: Amazon ECS Fargate
- **Container Registry**: Amazon ECR
- **Database**: Amazon RDS PostgreSQL 17
- **Cache/Queue**: Amazon ElastiCache (Redis 7.0 / Valkey)
- **Load Balancer**: Application Load Balancer
- **Networking**: Amazon VPC
- **Secrets Management**: AWS Secrets Manager
- **Logging**: CloudWatch Logs
- **SSL/TLS**: AWS Certificate Manager
- **N8N Version**: 1.114.4

## 📦 Prerequisites

### 1. Required Tools

```bash
# Node.js and npm
node --version  # v18.x or higher
npm --version

# AWS CLI
aws --version

# Docker (for pushing images to ECR)
docker --version

# AWS CDK
npm install -g aws-cdk
cdk --version
```

### 2. AWS Requirements

- AWS Account
- AWS CLI credentials configured
- Existing VPC
- SSL certificate in AWS Certificate Manager
- Pre-created ECS Cluster
- S3 Bucket (for environment variables)

### 3. Project Dependencies

```bash
cd infra/
npm install
```

## 🚀 Setup Steps

### 1. Configuration

Edit the `infra/cdk.context.json` file according to your AWS environment:

```json
{
  "dev": {
    "account": "123456789012",
    "region": "eu-west-1",
    "vpc": {
      "id": "vpc-xxxxx",
      "cidrBlock": "10.0.0.0/16",
      "availabilityZones": ["eu-west-1a", "eu-west-1b"],
      "publicSubnetIds": ["subnet-xxx", "subnet-yyy"],
      "privateSubnetIds": ["subnet-aaa", "subnet-bbb"]
    },
    "acm": {
      "imported": {
        "platformCertificateArn": "arn:aws:acm:..."
      }
    }
  }
}
```

### 2. Prepare Environment Variables

Create the following files via using "envs" example in your S3 bucket:

**Main Service** (`n8n-main-service/dev.env`):

**Worker Service** (`n8n-worker-service/dev.env`):

## 📦 Deployment

### Step 1: Create ECR Repositories

```bash
cd infra/

# For dev environment
APP_ENV=dev cdk synth --app "npx ts-node bin/ecr/n8n-ecr.ts"
APP_ENV=dev cdk deploy --app "npx ts-node bin/ecr/n8n-ecr.ts" --all

# For prod environment
APP_ENV=prod cdk synth --app "npx ts-node bin/ecr/n8n-ecr.ts"
APP_ENV=prod cdk deploy --app "npx ts-node bin/ecr/n8n-ecr.ts" --all
```

### Step 2: Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com

# Main Service Image
docker build -f Dockerfile.main -t n8n-main-service:dev-$(date +%Y%m%d-%H%M%S) .
docker tag n8n-main-service:dev-$(date +%Y%m%d-%H%M%S) YOUR_ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/n8n-main-service:dev-$(date +%Y%m%d-%H%M%S)
docker push YOUR_ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/n8n-main-service:dev-$(date +%Y%m%d-%H%M%S)

# Worker Service Image
docker build -f Dockerfile.worker -t n8n-worker-service:dev-$(date +%Y%m%d-%H%M%S) .
docker tag n8n-worker-service:dev-$(date +%Y%m%d-%H%M%S) YOUR_ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/n8n-worker-service:dev-$(date +%Y%m%d-%H%M%S)
docker push YOUR_ACCOUNT.dkr.ecr.eu-west-1.amazonaws.com/n8n-worker-service:dev-$(date +%Y%m%d-%H%M%S)
```

### Step 3: Create RDS PostgreSQL

```bash
# Dev environment
APP_ENV=dev cdk synth --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-dev

# Prod environment
APP_ENV=prod cdk synth --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-prod
APP_ENV=prod cdk deploy --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-prod
```

**Features:**
- PostgreSQL 17
- Dev: t3.micro (single-AZ)
- Prod: Multi-AZ deployment (recommended)
- Automatic backups (7 days retention)
- Storage encryption enabled
- Auto-scaling storage (20GB - 100GB)

### Step 4: Create ElastiCache Redis

```bash
# Dev environment
APP_ENV=dev cdk synth --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheRedisStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheRedisStack-dev

# Prod environment (Valkey recommended)
APP_ENV=prod cdk synth --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheValkeyStack-prod
APP_ENV=prod cdk deploy --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheValkeyStack-prod
```

**Features:**
- Redis 7.0 / Valkey
- Dev: cache.t3.micro (single node)
- Prod: Multi-node cluster (recommended)
- Inside VPC, in private subnets

### Step 5: Deploy ECS Services

```bash
# Replace IMAGE_TAG with your pushed image tag
IMAGE_TAG=dev-20240101-120000

# Main Service - Dev
APP_ENV=dev IMAGE_TAG=$IMAGE_TAG cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev
APP_ENV=dev IMAGE_TAG=$IMAGE_TAG cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev

# Worker Service - Dev
APP_ENV=dev IMAGE_TAG=$IMAGE_TAG cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-dev
APP_ENV=dev IMAGE_TAG=$IMAGE_TAG cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-dev
```

**Production Deployment:**

```bash
IMAGE_TAG=prod-20240101-120000

# Main Service - Prod
APP_ENV=prod IMAGE_TAG=$IMAGE_TAG cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-prod
APP_ENV=prod IMAGE_TAG=$IMAGE_TAG cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-prod

# Worker Service - Prod
APP_ENV=prod IMAGE_TAG=$IMAGE_TAG cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-prod
APP_ENV=prod IMAGE_TAG=$IMAGE_TAG cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-prod
```

## ⚙️ Environment Configurations

### Development (Dev)

| Component | Configuration |
|---------|---------------|
| **Main Service** | |
| - Task Memory | 512 MB |
| - Task CPU | 256 (0.25 vCPU) |
| - Desired Count | 1 |
| - Auto Scaling | 1 - 3 tasks |
| **Worker Service** | |
| - Task Memory | 512 MB |
| - Task CPU | 256 (0.25 vCPU) |
| - Desired Count | 1 |
| - Auto Scaling | 1 - 3 tasks |
| - Concurrency | 100 |
| **RDS** | |
| - Instance Type | db.t3.micro |
| - Multi-AZ | Disabled |
| - Storage | 20GB (auto-scale to 100GB) |
| **ElastiCache** | |
| - Node Type | cache.t3.micro |
| - Nodes | 1 |

### Production (Prod)

| Component | Configuration |
|---------|---------------|
| **Main Service** | |
| - Task Memory | 1024 MB |
| - Task CPU | 512 (0.5 vCPU) |
| - Desired Count | 2 |
| - Auto Scaling | 2 - 10 tasks |
| **Worker Service** | |
| - Task Memory | 2048 MB |
| - Task CPU | 1024 (1 vCPU) |
| - Desired Count | 2 |
| - Auto Scaling | 2 - 10 tasks |
| - Concurrency | 100 |
| **RDS** | |
| - Instance Type | db.r5.large (recommended) |
| - Multi-AZ | Enabled |
| - Storage | 100GB+ (auto-scale) |
| **ElastiCache** | |
| - Node Type | cache.r5.large (recommended) |
| - Nodes | 2+ (cluster mode) |

### Auto-Scaling Policies

Same auto-scaling targets for both environments:
- **CPU Utilization**: 70% target
- **Memory Utilization**: 70% target

## 📚 Stack Structure

### ECR Stacks

**N8NMainServiceECRStack**
- ECR repository for main service images
- Immutable image tags
- Lifecycle policies (optional)

**N8NWorkerServiceECRStack**
- ECR repository for worker service images
- Immutable image tags

### ECS Stacks

**N8NMainServiceECSFargateStack**
- Fargate task definition
- Container configuration
- Security groups
- Application Load Balancer
  - HTTP → HTTPS redirect
  - HTTPS listener with SSL/TLS
  - Target group with health checks
- Auto-scaling configuration
- CloudWatch log groups

**N8NWorkerServiceECSFargateStack**
- Fargate task definition for workers
- Container configuration (worker mode)
- Security groups
- Auto-scaling configuration
- CloudWatch log groups
- Graceful shutdown (120s timeout)

### Database Stacks

**N8NRDSPostgresStack**
- PostgreSQL 17 instance
- Automated backups
- Security groups
- Subnet groups
- Secrets Manager integration
- Storage encryption

**N8NRDSAuroraPostgresStack** (Alternative)
- Aurora PostgreSQL cluster
- Multi-AZ deployment
- Better for high-scale production

### Cache Stacks

**N8NElasticacheRedisStack**
- Redis 7.0 cluster
- Security groups
- Subnet groups

**N8NElasticacheValkeyStack** (Alternative)
- AWS Valkey (Redis fork)
- Better for production use

## 🔐 Security

### Network Security

- All services run in private subnets
- Port-level access control with security groups
- Isolated network within VPC
- ALB only accepts HTTPS traffic (HTTP → HTTPS redirect)

### Data Security

- RDS encryption at rest
- Transit encryption with TLS/SSL
- Credential management with AWS Secrets Manager
- Immutable ECR tags

### IAM Roles

- Task execution role (ECR, CloudWatch, Secrets Manager access)
- Task role (S3, SNS access)
- Least privilege principle

## 📊 Monitoring and Logging

### CloudWatch Logs

- Main Service logs: `/ecs/n8n-main-service-{env}-logs`
- Worker Service logs: `/ecs/n8n-worker-service-{env}-logs`
- Retention: 1 week (both environments)

### Health Checks

- Main Service health endpoint: `/healthz`
- ALB health check interval: 30 seconds
- Unhealthy threshold: 2 consecutive failures

### Metrics

- ECS task CPU/Memory utilization
- ALB request count, latency, errors
- RDS connections, CPU, storage
- ElastiCache CPU, memory, connections

## 🔄 Updates and Rollback

### Deploy New Image

```bash
# Build and push new image
IMAGE_TAG=dev-20240102-150000
docker build -f Dockerfile.main -t n8n-main-service:$IMAGE_TAG .
docker push YOUR_ACCOUNT.dkr.ecr.REGION.amazonaws.com/n8n-main-service:$IMAGE_TAG

# Update stack
APP_ENV=dev IMAGE_TAG=$IMAGE_TAG cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev
```

### Rolling Update

ECS Fargate automatically performs rolling updates:
- `minHealthyPercent: 100` - At least current task count of healthy tasks
- `maxHealthyPercent: 200` - Maximum 2x tasks can be started

### Rollback

```bash
# Deploy with previous image tag
APP_ENV=dev IMAGE_TAG=previous-tag cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev
```

## 🧹 Cleanup

The order of stack deletion is important:

```bash
# 1. ECS Services
APP_ENV=dev cdk destroy --app "npx ts-node bin/ecs/n8n-ecs.ts" --all

# 2. ElastiCache
APP_ENV=dev cdk destroy --app "npx ts-node bin/elasticache/n8n-redis.ts" --all

# 3. RDS (disable deletion protection first if active)
APP_ENV=dev cdk destroy --app "npx ts-node bin/rds/n8n-rds.ts" --all

# 4. ECR (delete images in repositories first)
APP_ENV=dev cdk destroy --app "npx ts-node bin/ecr/n8n-ecr.ts" --all
```

## 🐛 Troubleshooting

### Task not starting

```bash
# Check task logs
aws logs tail /ecs/n8n-main-service-dev-logs --follow

# Check task definition
aws ecs describe-task-definition --task-definition N8NMainServiceFargateTaskDef-dev
```

### Database connection error

- Check security group rules
- Verify database credentials in S3 env file
- Is the RDS endpoint correct?

### Redis connection error

- Check ElastiCache cluster endpoint
- Is port 6379 open in security group?
- Is it accessible from within VPC?

### ALB 502/503 error

- Check target group health checks
- Ensure container is listening on port 5678
- Review CloudWatch logs

## 📝 Notes

- Ensure all prerequisites are ready before first deployment
- Use Multi-AZ deployment in production environment
- Take regular backups
- Delete unused resources for cost optimization
- Enable VPC Flow Logs
- Protect ALB with AWS WAF (recommended for production)

## 🤝 Contributing

This is a personal infrastructure project. Feel free to open issues for suggestions and improvements.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⚠️ Important:** Before production use:
- Enable deletion protection (RDS)
- Define your backup strategy
- Create disaster recovery plan
- Set up cost monitoring
- Conduct security audit
