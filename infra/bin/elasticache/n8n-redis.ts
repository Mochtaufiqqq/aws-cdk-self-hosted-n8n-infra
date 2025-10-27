#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  getAppEnv,
  getConfig,
} from '../../lib/config';
import {
  N8NElasticacheRedisStack,
  N8NElasticacheValkeyStack
} from '../../lib/elasticache';

const app = new cdk.App();
const appEnv = getAppEnv();
const conf = getConfig(app, appEnv);
const cdkEnv: cdk.Environment = { account: conf.account, region: conf.region };

new N8NElasticacheRedisStack(app, `N8NElasticacheRedisStack-${appEnv}`, { env: cdkEnv });
new N8NElasticacheValkeyStack(app, `N8NElasticacheValkeyStack-${appEnv}`, { env: cdkEnv });