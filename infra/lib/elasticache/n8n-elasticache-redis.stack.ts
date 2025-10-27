import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { getAppEnv, getConfig } from '../config';

export class N8NElasticacheRedisStack extends Stack {
  public readonly redisCluster: elasticache.CfnCacheCluster;

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

    const redisSg = new ec2.SecurityGroup(this, 'N8NElasticacheRedisSg', {
      securityGroupName: `n8n-redis-sg-${appEnv}`,
      vpc,
      description: 'Security group for N8N Redis cache',
    });

    redisSg.addIngressRule(
      ec2.Peer.ipv4(config.vpc.cidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    new CfnOutput(this, 'N8NRedisSgId', {
      value: redisSg.securityGroupId,
      exportName: `N8NRedisSgId-${appEnv}`,
    });

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'N8NElasticacheRedisSubnetGroup', {
      cacheSubnetGroupName: `n8n-redis-subnet-group-${appEnv}`,
      description: 'Subnet group for N8N Redis cache',
      subnetIds: config.vpc.privateSubnetIds,
    });

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'N8NElasticacheRedisCluster', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: 1,
      clusterName: `n8n-redis-${appEnv}`,
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [redisSg.securityGroupId],
      port: 6379,

    });

    this.redisCluster.addDependency(redisSubnetGroup);
  }
}