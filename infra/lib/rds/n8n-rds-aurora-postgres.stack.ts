import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { getAppEnv, getConfig } from '../config';

export class N8NRDSAuroraPostgresStack extends Stack {
	public readonly database: rds.DatabaseCluster;
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

		this.database = new rds.DatabaseCluster(this, 'N8NRDSAuroraPostgresDatabase', {
			clusterIdentifier: `n8n-aurora-postgres-${appEnv}`,
			engine: rds.DatabaseClusterEngine.auroraPostgres({
				version: rds.AuroraPostgresEngineVersion.VER_16_6,
			}),
			credentials: rds.Credentials.fromSecret(this.databaseSecret),
			defaultDatabaseName: 'n8n',
			vpc,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				onePerAz: true,
			},
			subnetGroup: dbSubnetGroup,
			securityGroups: [postgresDBSg],
			serverlessV2MinCapacity: 0.5,
			serverlessV2MaxCapacity: 10,
			writer: rds.ClusterInstance.serverlessV2('writer', {
				instanceIdentifier: `n8n-aurora-postgres-writer-${appEnv}`,
				publiclyAccessible: false,
				enablePerformanceInsights: true,
				performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
			}),
			readers: [
				rds.ClusterInstance.serverlessV2('reader', {
					instanceIdentifier: `n8n-aurora-postgres-reader-${appEnv}`,
					publiclyAccessible: false,   
					enablePerformanceInsights: true,
					performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
				}),
			],
			clusterScalabilityType: rds.ClusterScalabilityType.STANDARD,
			storageType: rds.DBClusterStorageType.AURORA,
			backup: {
				retention: Duration.days(7),
				preferredWindow: '03:00-04:00',
			},
			preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
			cloudwatchLogsExports: ['postgresql'],
			storageEncrypted: true,
			deletionProtection: false,
			removalPolicy: RemovalPolicy.RETAIN,
			parameterGroup: new rds.ParameterGroup(this, 'N8NRDSPostgresParameterGroup', {
				engine: rds.DatabaseClusterEngine.auroraPostgres({
					version: rds.AuroraPostgresEngineVersion.VER_16_6,
				}),
				parameters: {
					'shared_preload_libraries': 'pg_stat_statements',
					'log_statement': 'ddl',
					'log_min_duration_statement': '1000',
					'timezone': 'UTC',
				},
			}),
		});

		const proxy = this.database.addProxy('PgProxy', {
			secrets: [this.databaseSecret],
			vpc,
			securityGroups: [postgresDBSg],
			requireTLS: true,
			iamAuth: false,                   
			borrowTimeout: Duration.seconds(30),
			debugLogging: false,
			idleClientTimeout: Duration.minutes(30),
			maxConnectionsPercent: 100,
			maxIdleConnectionsPercent: 50,
		});

		new CfnOutput(this, 'DatabaseClusterEndpoint', {
			value: this.database.clusterEndpoint.socketAddress,
			description: 'Aurora PostgreSQL cluster endpoint',
			exportName: `n8n-aurora-postgres-endpoint-${appEnv}`,
		});

		new CfnOutput(this, 'DatabaseClusterReadEndpoint', {
			value: this.database.clusterReadEndpoint.socketAddress,
			description: 'Aurora PostgreSQL cluster read endpoint',
			exportName: `n8n-aurora-postgres-read-endpoint-${appEnv}`,
		});

		new CfnOutput(this, 'DatabaseSecretArn', {
			value: this.databaseSecret.secretArn,
			description: 'Aurora PostgreSQL credentials secret ARN',
			exportName: `n8n-aurora-postgres-secret-arn-${appEnv}`,
		});

		new CfnOutput(this, 'DatabaseSecurityGroupId', {
			value: postgresDBSg.securityGroupId,
			description: 'Aurora PostgreSQL security group ID',
			exportName: `n8n-aurora-postgres-sg-id-${appEnv}`,
		});
	}

	// use for monitoring if needed
	private createCloudWatchAlarms(appEnv: string): void {
		new cloudwatch.Alarm(this, 'DatabaseCPUAlarm', {
			alarmName: `n8n-aurora-postgres-cpu-${appEnv}`,
			alarmDescription: 'Aurora PostgreSQL CPU utilization is high',
			metric: this.database.metricCPUUtilization({
				period: Duration.minutes(5),
			}),
			threshold: 80,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		});

		new cloudwatch.Alarm(this, 'DatabaseConnectionsAlarm', {
			alarmName: `n8n-aurora-postgres-connections-${appEnv}`,
			alarmDescription: 'Aurora PostgreSQL connection count is high',
			metric: this.database.metricDatabaseConnections({
				period: Duration.minutes(5),
			}),
			threshold: 80,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		});
	}
}