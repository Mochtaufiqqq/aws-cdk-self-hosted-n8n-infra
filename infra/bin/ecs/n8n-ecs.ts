#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  getAppEnv,
  getConfig,
} from '../../lib/config';
import {
  N8NMainServiceECSFargateStack,
  N8NWorkerServiceECSFargateStack,
} from '../../lib/ecs';

const app = new cdk.App();
const appEnv = getAppEnv();
const conf = getConfig(app, appEnv);
const cdkEnv: cdk.Environment = { account: conf.account, region: conf.region };

new N8NMainServiceECSFargateStack(app, `N8NMainServiceECSFargateStack-${appEnv}`, { env: cdkEnv });
new N8NWorkerServiceECSFargateStack(app, `N8NWorkerServiceECSFargateStack-${appEnv}`, { env: cdkEnv });
