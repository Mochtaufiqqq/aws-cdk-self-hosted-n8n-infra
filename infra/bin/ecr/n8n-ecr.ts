#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  getAppEnv,
  getConfig,
} from '../../lib/config';
import {
  N8NMainServiceECRStack,
  N8NWorkerServiceECRStack
} from '../../lib/ecr';

const app = new cdk.App();
const appEnv = getAppEnv();
const conf = getConfig(app, appEnv);
const cdkEnv: cdk.Environment = { account: conf.account, region: conf.region };

new N8NMainServiceECRStack(app, `N8NMainServiceECRStack`, { env: cdkEnv });
new N8NWorkerServiceECRStack(app, `N8NWorkerServiceECRStack`, { env: cdkEnv });
