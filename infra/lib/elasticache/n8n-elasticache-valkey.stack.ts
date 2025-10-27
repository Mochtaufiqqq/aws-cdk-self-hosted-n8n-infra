import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { getAppEnv, getConfig } from '../config';

export class N8NElasticacheValkeyStack extends Stack {
  public readonly valkeyCache: elasticache.CfnServerlessCache;

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

    const valkeySg = new ec2.SecurityGroup(this, 'N8NElasticacheValkeySg', {
      securityGroupName: `n8n-valkey-sg-${appEnv}`,
      vpc,
      description: 'Security group for N8N Valkey cache',
    });

    valkeySg.addIngressRule(
      ec2.Peer.ipv4(config.vpc.cidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    new CfnOutput(this, 'N8NValkeyCacheSgId', {
      value: valkeySg.securityGroupId,
      exportName: `N8NValkeyCacheSgId-${appEnv}`,
    });

    const cacheUserSecret = new secretsmanager.Secret(this, 'N8nValkeyCachePassword', {
      secretName: `valkey-cache-n8n-user-password-${appEnv}`,
      generateSecretString: { excludePunctuation: true, passwordLength: 32 }
    });

    const cacheUser = new elasticache.CfnUser(this, 'N8nValkeyCacheUser', {
      engine: 'valkey',
      userId: 'n8n',
      userName: 'n8n',
      accessString: `on ~* +@all`,
      authenticationMode: {
        'Type': 'password',
        'Passwords': [cacheUserSecret.secretValue.unsafeUnwrap()]
      }
    });

    const cacheUserGroup = new elasticache.CfnUserGroup(this, 'N8nUserGroup', {
      engine: 'valkey',
      userGroupId: 'n8n-group',
      userIds: [cacheUser.userId]
    });
    cacheUserGroup.addDependency(cacheUser);

    this.valkeyCache = new elasticache.CfnServerlessCache(this, 'N8NElasticacheValkeyCache', {
      serverlessCacheName: `n8n-valkey-cache-${appEnv}`,
      engine: 'valkey',
      subnetIds: config.vpc.privateSubnetIds,
      securityGroupIds: [valkeySg.securityGroupId],
      userGroupId: cacheUserGroup.userGroupId,
    });

    this.valkeyCache.addDependency(cacheUserGroup);

    new CfnOutput(this, 'N8NValkeyCacheEndpointAddress', {
      value: this.valkeyCache.attrEndpointAddress,
      exportName: `N8NValkeyCacheEndpointAddress-${appEnv}`,
    });
  }
}