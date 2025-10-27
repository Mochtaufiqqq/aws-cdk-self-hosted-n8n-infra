import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { getAppEnv, getConfig } from '../config';

export class N8NRDSPostgresStack extends Stack {
	public readonly database: rds.DatabaseInstance;
	public readonly databaseSecret: secretsmanager.Secret;

	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const appEnv = getAppEnv();
		const config = getConfig(this, appEnv);
	
		const vpc = ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
			vpcId: config.vpc.id,
			availabilityZones: config.vpc.availabilityZones,
			publicSubnetIds: config.vpc.publicSubnetIds,
			privateSubnetIds: config.vpc.privateSubnetIds
		});

		this.databaseSecret = new secretsmanager.Secret(this, 'N8NRDSPostgresDBSecret', {
			secretName: `n8n-postgres-credentials-${appEnv}`,
			description: 'N8N PostgreSQL database credentials',
			generateSecretString: {
				secretStringTemplate: JSON.stringify({ username: 'n8n_admin' }),
				generateStringKey: 'password',
				excludeCharacters: '"@/\\\'',
				passwordLength: 32,
			},
		});

		const postgresDBSg = new ec2.SecurityGroup(this, 'N8NRDSPostgresDBSg', {
			securityGroupName: `n8n-rds-postgres-db-sg-${appEnv}`,
			vpc,
			description: 'Security group for N8N PostgreSQL database',
		});

		postgresDBSg.addIngressRule(
			ec2.Peer.ipv4(config.vpc.cidrBlock),
			ec2.Port.tcp(5432),
			'Allow PostgreSQL access from VPC'
		);

		const dbSubnetGroup = new rds.SubnetGroup(this, 'N8nDatabaseSubnetGroup', {
			subnetGroupName: `n8n-rds-postgres-subnet-group-${appEnv}`,
			vpc,
			description: 'Subnet group for N8N PostgreSQL database',
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				onePerAz: true,
			},
		});

		this.database = new rds.DatabaseInstance(this, 'N8NRDSPostgresDatabase', {
			instanceIdentifier: `n8n-rds-postgres-${appEnv}`,
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_17,
			}),
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			vpc,
			subnetGroup: dbSubnetGroup,
			securityGroups: [postgresDBSg],
			credentials: rds.Credentials.fromSecret(this.databaseSecret),
			databaseName: 'n8n',
			allocatedStorage: 20,
			maxAllocatedStorage: 100,
			storageType: rds.StorageType.GP3,
			backupRetention: Duration.days(7),
			deleteAutomatedBackups: true,
			deletionProtection: true,
			removalPolicy: RemovalPolicy.RETAIN, // For development only
			enablePerformanceInsights: false,
			monitoringInterval: Duration.seconds(0),
			autoMinorVersionUpgrade: true,
			allowMajorVersionUpgrade: false,
			multiAz: false, // Single instance for development
			publiclyAccessible: false,
			storageEncrypted: true,
		});
	}
}