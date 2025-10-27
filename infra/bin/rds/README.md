## N8N RDS Postgres Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSPostgresStack-dev

## N8N RDS Aurora Postgres Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSAuroraPostgresStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/rds/n8n-rds.ts" N8NRDSAuroraPostgresStack-dev
