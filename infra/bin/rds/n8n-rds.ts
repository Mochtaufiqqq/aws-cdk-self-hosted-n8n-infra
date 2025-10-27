#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  getAppEnv,
  getConfig,
} from '../../lib/config';
import {
  N8NRDSPostgresStack,
  N8NRDSAuroraPostgresStack,
} from '../../lib/rds';

const app = new cdk.App();
const appEnv = getAppEnv();
const conf = getConfig(app, appEnv);
const cdkEnv: cdk.Environment = { account: conf.account, region: conf.region };

new N8NRDSPostgresStack(app, `N8NRDSPostgresStack-${appEnv}`, { env: cdkEnv });
new N8NRDSAuroraPostgresStack(app, `N8NRDSAuroraPostgresStack-${appEnv}`, { env: cdkEnv });