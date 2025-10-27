## N8N Main Service Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/ecr/n8n-ecr.ts" N8NMainServiceECRStack
APP_ENV=dev cdk deploy --app "npx ts-node bin/ecr/n8n-ecr.ts" N8NMainServiceECRStack

## N8N Worker Service Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/ecr/n8n-ecr.ts" N8NWorkerServiceECRStack
APP_ENV=dev cdk deploy --app "npx ts-node bin/ecr/n8n-ecr.ts" N8NWorkerServiceECRStack
