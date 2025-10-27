## N8N Elasticache Redis Cache Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheRedisStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheRedisStack-dev

## N8N Elasticache Valkey Cache Stack deployment scripts
APP_ENV=dev cdk synth --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheValkeyStack-dev
APP_ENV=dev cdk deploy --app "npx ts-node bin/elasticache/n8n-redis.ts" N8NElasticacheValkeyStack-dev
