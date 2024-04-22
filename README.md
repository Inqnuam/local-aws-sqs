# Local AWS SQS

> Run AWS SQS locally without dependency.  
> Supports both AWS Query and JSON (x-amz-json-1.0) protocols.

## Install

```bash
npm i local-aws-sqs --save-dev
# yarn add -D local-aws-sqs
```

## Usage

```js
import { createSqsServer } from "local-aws-sqs";
// const { createSqsServer } = require("local-aws-sqs");

const server = await createSqsServer({ port: 5432 });
```

### Options

| name                          | default      | description                                                                                                                                                                                                             |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| port                          |              | port for NodeJS http createServer                                                                                                                                                                                       |
| hostname                      | localhost    | hostname for NodeJS http createServer                                                                                                                                                                                   |
| baseUrl                       | /            | base url to prefix Queue URLs                                                                                                                                                                                           |
| region                        | us-east-1    | (cosmetic) AWS Region used in Queue ARN                                                                                                                                                                                 |
| accountId                     | 123456789012 | (cosmetic) AWS Account Id used in Queue ARN and URL                                                                                                                                                                     |
| validateDlqDestination        | true         | DLQ defined in RedrivePolicy must exist.                                                                                                                                                                                |
| emulateQueueCreationLifecycle | true         | AWS behaviour: If you delete a queue, you must wait at least 60 seconds before creating a queue with the same name.                                                                                                     |
| emulateLazyQueues             | false        | AWS behaviour: After you create a queue, you must wait at least one second after the queue is created to be able to use the queue.                                                                                      |
| queues                        | [ ]          | an array of Queue to be created when the server starts. Same Schema as [CreateQueueCommandInput](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-sqs/Interface/CreateQueueCommandInput/) |

## Integration

AWS provides a feature called [Service-specific endpoints](https://docs.aws.amazon.com/sdkref/latest/guide/feature-ss-endpoints.html) which allows you to redirect all you AWS SQS API requests to a specific endoint.

If your app already runs with some AWS Credentials and Region, you can simply set the `AWS_ENDPOINT_URL_SQS` env variable to redirect all SQS requests to Local AWS SQS.

```bash
AWS_ENDPOINT_URL_SQS=http://localhost:5432 node ./myApp.js
```

Setup based on AWS Profile:
inside `~/.aws/config` file

```
[profile local]
aws_access_key_id=fake
aws_secret_access_key=fake
region=us-east-1
services = local-services

[services local-services]
sqs =
  endpoint_url = http://localhost:5432
```

### Using with AWS SDK

with `AWS_PROFILE=local` (or `AWS_ENDPOINT_URL_SQS`) env variable

```js
import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({});

const cmd = new CreateQueueCommand({ QueueName: "MyFirstLocalQueue" });

const res = await client.send(cmd);

console.log(res.QueueUrl);
// http://localhost:5432/123456789012/MyFirstLocalQueue
```

without `AWS_PROFILE=local`

```js
import { SQSClient } from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: "us-east-1",
  endpoint: `http://localhost:5432`,
  credentials: {
    accessKeyId: "fake",
    secretAccessKey: "fake",
  },
});
```

### Using with AWS CLI

with `AWS_PROFILE=local` or `aws --profile local`

```bash
aws --profile local sqs create-queue --queue-name MyFirstLocalQueue

# output
{
    "QueueUrl": "http://localhost:5432/123456789012/MyFirstLocalQueue"
}
```

without `AWS_PROFILE`

```bash
aws --region us-east-1 --endpoint-url http://localhost:5432 sqs create-queue --queue-name MyFirstLocalQueue

# output
{
    "QueueUrl": "http://localhost:5432/123456789012/MyFirstLocalQueue"
}
```

### Using with Terraform

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.46.0"
    }

  }
}

# Without AWS_PROFILE

# provider "aws" {
#   region                      = "us-east-1"
#   access_key                  = "fake"
#   secret_key                  = "fake"
#   skip_credentials_validation = true
#   skip_requesting_account_id  = true
#   endpoints {
#     sqs = "http://localhost:5432"
#   }
# }


# With AWS Profile

provider "aws" {
  profile = "local"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}


resource "aws_sqs_queue" "queue" {
  name = "MyFirstLocalQueue"
}
```

### Using with Jest

jest.config.js

```js
/** @type {import('jest').Config} */
const config = {
  globalSetup: "./setup-sqs.js",
  globalTeardown: "./teardown-sqs.js",
};

module.exports = config;
```

setup-sqs.js

```js
// @ts-check
const { createSqsServer } = require("local-aws-sqs");

module.exports = async () => {
  global.__SQS_SERVER__ = await createSqsServer({ port: 5432, queues: [{ QueueName: "MyFirstLocalQueue" }] });
};
```

teardown-sqs.js

```js
module.exports = async () => {
  global.__SQS_SERVER__.close();
};
```

### Using with Vitest

vitest.config.ts

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["sqs.config.ts"],
  },
});
```

sqs.config.ts

```ts
import { createSqsServer } from "local-aws-sqs";
import type { Server } from "http";

let server: Server;

export const setup = async () => {
  server = await createSqsServer({ port: 5432, queues: [{ QueueName: "MyFirstLocalQueue" }] });
};

export const teardown = () => {
  server.close();
};
```

## Supported Commands

| command name                 | support |
| ---------------------------- | ------- |
| AddPermission                | ✅      |
| CancelMessageMoveTask        | ✅      |
| ChangeMessageVisibility      | ✅      |
| ChangeMessageVisibilityBatch | ✅      |
| CreateQueue                  | ✅      |
| DeleteMessage                | ✅      |
| DeleteMessageBatch           | ✅      |
| DeleteQueue                  | ✅      |
| GetQueueAttributes           | ✅      |
| GetQueueUrl                  | ✅      |
| ListDeadLetterSourceQueues   | ✅      |
| ListMessageMoveTasks         | ✅      |
| ListQueues                   | ✅      |
| ListQueueTags                | ✅      |
| PurgeQueue                   | ✅      |
| ReceiveMessage               | ✅      |
| RemovePermission             | ✅      |
| SendMessage                  | ✅      |
| SendMessageBatch             | ✅      |
| SetQueueAttributes           | ✅      |
| StartMessageMoveTask         | ✅      |
| TagQueue                     | ✅      |
| UntagQueue                   | ✅      |

## Notes

As this tool is only for local development some behiavours are itentionally ignored.

- No permission checks when calling the API (Access Key, Policy, KMS, etc.)
- Bad region dont throw error
