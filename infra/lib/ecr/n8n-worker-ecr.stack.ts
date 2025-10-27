import { Stack, StackProps, CfnOutput, aws_ecr } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class N8NWorkerServiceECRStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const serviceECR = new aws_ecr.Repository(this, 'N8NWorkerServiceECRRepository', {
      repositoryName: 'n8n-worker-service',
      imageTagMutability: aws_ecr.TagMutability.IMMUTABLE
    });

    new CfnOutput(this, 'N8NWorkerServiceECRRepoARN', {
      value: serviceECR.repositoryArn,
      exportName: 'N8NWorkerServiceECRRepoARN'
    });

    new CfnOutput(this, 'N8NWorkerServiceECRRepoName', {
      value: serviceECR.repositoryName,
      exportName: 'N8NWorkerServiceECRRepoName'
    });
  }
}
