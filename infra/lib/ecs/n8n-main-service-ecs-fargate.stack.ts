import {
  Stack,
  StackProps,
  Fn,
  aws_ec2,
  aws_ecs,
  aws_ecr,
  aws_iam,
  aws_logs,
  aws_s3,
  aws_certificatemanager as acm,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getAppEnv, getConfig } from '../config';

export class N8NMainServiceECSFargateStack extends Stack {
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

    const ecrRepo = aws_ecr.Repository.fromRepositoryAttributes(this, 'N8NMainServiceECRRepo', {
      repositoryArn: Fn.importValue('N8NMainServiceECRRepoARN'),
      repositoryName: Fn.importValue('N8NMainServiceECRRepoName')
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

    const taskDef = new aws_ecs.FargateTaskDefinition(this, 'N8NMainServiceFargateTaskDef', {
      memoryLimitMiB: config.n8nMainServiceSpecs.taskDefmemoryLimitMiB,
      cpu: config.n8nMainServiceSpecs.taskDefCpu,
      family: `N8NMainServiceFargateTaskDef-${appEnv}`
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

    const logGroup = new aws_logs.LogGroup(this, 'N8NMainServiceFargateContainerLogGroup', {
      logGroupName: `/ecs/n8n-main-service-${appEnv}-logs`,
      retention: appEnv === 'prod' ? aws_logs.RetentionDays.ONE_WEEK : aws_logs.RetentionDays.ONE_WEEK
    });

    const container = taskDef.addContainer('N8NMainServiceFargateContainer', {
      containerName: 'n8n-main-service',
      image: serviceImage,
      memoryReservationMiB: config.n8nMainServiceSpecs.containerMemoryLimitMiB,
      cpu: config.n8nMainServiceSpecs.containerCpu,
      environmentFiles: [aws_ecs.EnvironmentFile.fromBucket(environmentBucket, `n8n-main-service/${appEnv}.env`)],
      logging: new aws_ecs.AwsLogDriver({
        logGroup,
        streamPrefix: 'ecs'
      })
    });

    container.addPortMappings({
      containerPort: 5678,
      protocol: aws_ecs.Protocol.TCP
    });

    const serviceSg = new aws_ec2.SecurityGroup(this, 'N8NMainServiceSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: `n8n-main-service-sg-${appEnv}`,
      description: `N8N Main Service ${appEnv} security group`
    });

    const privateSubnetsOnePerAz = vpc.selectSubnets({
      onePerAz: true,
      subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS
    });

    const service = new aws_ecs.FargateService(this, 'N8NMainServiceECSService', {
      cluster,
      serviceName: 'n8n-main-service',
      taskDefinition: taskDef,
      desiredCount: config.n8nMainServiceSpecs.desiredCount,
      securityGroups: [serviceSg],
      vpcSubnets: privateSubnetsOnePerAz,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // Service Task Auto Scale
    const serviceAutoScaleTaskCount = service.autoScaleTaskCount({
      minCapacity: config.n8nMainServiceSpecs.minCapacity,
      maxCapacity: config.n8nMainServiceSpecs.maxCapacity
    });

    serviceAutoScaleTaskCount.scaleOnCpuUtilization('N8NMainServiceECSServiceTaskAutoScaleCpu', {
      targetUtilizationPercent: 70
    });

    serviceAutoScaleTaskCount.scaleOnMemoryUtilization('N8NMainServiceECSServiceTaskAutoScaleMemory', {
      targetUtilizationPercent: 70
    });

    // Application Load Balancer
    const applicationLoadBalancerSg = new aws_ec2.SecurityGroup(this, 'N8NMainServiceAlbSg', {
      vpc,
      allowAllOutbound: true,
      securityGroupName: `n8n-main-service-alb-sg-${appEnv}`,
      description: `N8N Main Service ALB sg ${appEnv}`
    });

    serviceSg.addIngressRule(
      applicationLoadBalancerSg,
      aws_ec2.Port.tcp(5678),
      'allow n8n main service access from n8n main service alb'
    );

    applicationLoadBalancerSg.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80),
      'allow http connection from anywhere'
    );
    applicationLoadBalancerSg.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(443),
      'allow https connection from anywhere'
    );

    const applicationLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'N8NMainServiceALB', {
      vpc,
      internetFacing: false,
      vpcSubnets: privateSubnetsOnePerAz,
      securityGroup: applicationLoadBalancerSg,
      loadBalancerName: `n8n-main-service-alb-${appEnv}`
    });

    const serviceTargetGroup = new elbv2.ApplicationTargetGroup(this, 'N8NMainServiceTargetGroup', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetGroupName: `n8n-main-service-${appEnv}-tg`,
      targets: [service],
      vpc: vpc,
      healthCheck: {
        enabled: true,
        path: '/healthz'
      }
    });
    const httpListenerAction = elbv2.ListenerAction.redirect({
      host: '#{host}',
      path: '/#{path}',
      port: '443',
      protocol: 'HTTPS',
      permanent: true
    });

    const httpListener = new elbv2.ApplicationListener(this, 'httpListener', {
      loadBalancer: applicationLoadBalancer,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP
    });
    httpListener.addAction('httpListenerAction', {
      action: httpListenerAction
    });

    // custom cert
    const sslCert = acm.Certificate.fromCertificateArn(this, 'ACMCert', config.acm.imported.platformCertificateArn);

    const httpsListener = new elbv2.ApplicationListener(this, 'HttpsListener', {
      loadBalancer: applicationLoadBalancer,
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultTargetGroups: [serviceTargetGroup],
      certificates: [sslCert],
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS
    });
  }
}
