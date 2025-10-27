## N8N Main Service Stack deployment scripts
APP_ENV=dev IMAGE_TAG=dev-xxxx  cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev
APP_ENV=dev IMAGE_TAG=dev-xxxx cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NMainServiceECSFargateStack-dev

## N8N Worker Service Stack deployment scripts
APP_ENV=dev IMAGE_TAG=dev-xxxx cdk synth --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-dev
APP_ENV=dev IMAGE_TAG=dev-xxxx cdk deploy --app "npx ts-node bin/ecs/n8n-ecs.ts" N8NWorkerServiceECSFargateStack-dev
