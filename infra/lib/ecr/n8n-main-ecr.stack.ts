import { Stack, StackProps, CfnOutput, aws_ecr } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class N8NMainServiceECRStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const serviceECR = new aws_ecr.Repository(this, 'N8NMainServiceECRRepository', {
      repositoryName: 'n8n-main-service',
      imageTagMutability: aws_ecr.TagMutability.IMMUTABLE
    });

    new CfnOutput(this, 'N8NMainServiceECRRepoARN', {
      value: serviceECR.repositoryArn,
      exportName: 'N8NMainServiceECRRepoARN'
    });

    new CfnOutput(this, 'N8NMainServiceECRRepoName', {
      value: serviceECR.repositoryName,
      exportName: 'N8NMainServiceECRRepoName'
    });
  }
}
