import { App } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface Config {
	account: string;
	region: string;
	vpc: Vpc;
	acm: ACM;
	n8nMainServiceSpecs: ECSFargate;
	n8nWorkerServiceSpecs: ECSFargate;
}

enum APP_ENV {
	DEV = 'dev',
	PROD = 'prod',
}

interface Vpc {
	id: string;
	cidrBlock: string;
	availabilityZones: string[];
	publicSubnetIds: string[];
	privateSubnetIds: string[];
	publicSubnetRouteTableIds: string[];
	privateSubnetRouteTableIds: string[];
}

interface ACM {
	imported: ACMImportedProps;
}

interface ACMImportedProps {
	platformCertificateArn: string;
}

interface ECSFargate {
  taskDefmemoryLimitMiB: number;
  taskDefCpu: number;
  containerCpu: number;
  containerMemoryLimitMiB: number;
  desiredCount: number;
  minCapacity: number;
  maxCapacity: number;
}

const getConfig = (scope: App | Construct, appEnv: string) => {

	const context = scope.node.tryGetContext(appEnv);

	const conf: Config = {
		account: context.account,
		region: context.region,
		vpc: context.vpc,
		acm: context.acm,
		n8nMainServiceSpecs: context.n8nMainServiceSpecs,
		n8nWorkerServiceSpecs: context.n8nWorkerServiceSpecs,
	};

	return conf;
};

const getAppEnv = (): string => {
	const appEnv = process.env.APP_ENV || 'dev';

	if (Object.values(APP_ENV).includes(appEnv as APP_ENV)) {
		return appEnv;
	} else {
		throw new Error(`
      Unrecognized application environment stage supplied. \n
      Please supply one of [${APP_ENV.DEV}, ${APP_ENV.PROD}}]
    `);
	}
};

export { getConfig, getAppEnv };
