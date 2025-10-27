import {
  Stack,
  StackProps,
  Fn,
  Duration,
  aws_ec2,
  aws_ecs,
  aws_ecr,
  aws_iam,
  aws_logs,
  aws_s3
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getAppEnv, getConfig } from '../config';

export class N8NWorkerServiceECSFargateStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const appEnv = getAppEnv();
    const config = getConfig(scope, appEnv);

    const IMAGE_TAG = process.env.IMAGE_TAG;
    if (!IMAGE_TAG) {
      throw new Error('Please provide an IMAGE_TAG value to start CDK process.');
    }

    const vpc = aws_ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: config.vpc.id,
      availabilityZones: config.vpc.availabilityZones,
      publicSubnetIds: config.vpc.publicSubnetIds,
      privateSubnetIds: config.vpc.privateSubnetIds
    });

    const clusterSg = aws_ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ServicesEcsClusterSg',
      Fn.importValue(`ServicesECSClusterSgId-${appEnv}`)
    );

    const cluster = aws_ecs.Cluster.fromClusterAttributes(this, 'ServicesEcsCluster', {
      clusterName: Fn.importValue(`ServicesECSClusterName-${appEnv}`),
      vpc,
      securityGroups: [clusterSg]
    });

    const ecrRepo = aws_ecr.Repository.fromRepositoryAttributes(this, 'N8NWorkerServiceECRRepo', {
      repositoryArn: Fn.importValue('N8NWorkerServiceECRRepoARN'),
      repositoryName: Fn.importValue('N8NWorkerServiceECRRepoName')
    });

    const serviceImage = aws_ecs.EcrImage.fromEcrRepository(ecrRepo, IMAGE_TAG);

    const environmentBucket = aws_s3.Bucket.fromBucketAttributes(
      this,
      'PlatformServicesEnvironmentVariablesBucket',
      {
        bucketArn: Fn.importValue('PlatformServicesEnvironmentVariablesBucketARN'),
        bucketName: Fn.importValue('PlatformServicesEnvironmentVariablesBucketName')
      }
    );

    const taskDef = new aws_ecs.FargateTaskDefinition(this, 'N8NWorkerServiceFargateTaskDef', {
      memoryLimitMiB: config.n8nWorkerServiceSpecs.taskDefmemoryLimitMiB,
      cpu: config.n8nWorkerServiceSpecs.taskDefCpu,
      family: `N8NWorkerServiceFargateTaskDef-${appEnv}`,
    });

    taskDef.addToExecutionRolePolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['s3:*']
      })
    );

    taskDef.addToTaskRolePolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['sns:*']
      })
    );

    const logGroup = new aws_logs.LogGroup(this, 'N8NWorkerServiceFargateContainerLogGroup', {
      logGroupName: `/ecs/n8n-worker-service-${appEnv}-logs`,
      retention: appEnv === 'prod' ? aws_logs.RetentionDays.ONE_WEEK : aws_logs.RetentionDays.ONE_WEEK
    });

    const container = taskDef.addContainer('N8NWorkerServiceFargateContainer', {
      containerName: 'n8n-worker-service',
      image: serviceImage,
      memoryReservationMiB: config.n8nWorkerServiceSpecs.containerMemoryLimitMiB,
      cpu: config.n8nWorkerServiceSpecs.containerCpu,
      environmentFiles: [aws_ecs.EnvironmentFile.fromBucket(environmentBucket, `n8n-worker-service/${appEnv}.env`)],
      logging: new aws_ecs.AwsLogDriver({
        logGroup,
        streamPrefix: 'ecs'
      }),
      stopTimeout: Duration.seconds(120)
    });

    container.addPortMappings({
      containerPort: 5678,
      protocol: aws_ecs.Protocol.TCP
    });

    const serviceSg = new aws_ec2.SecurityGroup(this, 'N8NWorkerServiceSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: `n8n-worker-service-sg-${appEnv}`,
      description: `N8N Worker Service ${appEnv} security group`
    });

    const privateSubnetsOnePerAz = vpc.selectSubnets({
      onePerAz: true,
      subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS
    });

    const service = new aws_ecs.FargateService(this, 'N8NWorkerServiceECSService', {
      cluster,
      serviceName: 'n8n-worker-service',
      taskDefinition: taskDef,
      desiredCount: config.n8nWorkerServiceSpecs.desiredCount,
      securityGroups: [serviceSg],
      vpcSubnets: privateSubnetsOnePerAz,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Service Task Auto Scale
    const serviceAutoScaleTaskCount = service.autoScaleTaskCount({
      minCapacity: config.n8nWorkerServiceSpecs.minCapacity,
      maxCapacity: config.n8nWorkerServiceSpecs.maxCapacity,
    });

    serviceAutoScaleTaskCount.scaleOnCpuUtilization('N8NWorkerServiceECSServiceTaskAutoScaleCpu', {
      targetUtilizationPercent: 70,
    });

    serviceAutoScaleTaskCount.scaleOnMemoryUtilization('N8NWorkerServiceECSServiceTaskAutoScaleMemory', {
      targetUtilizationPercent: 70
    });
  }
}
