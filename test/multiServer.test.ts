import { describe, it, expect } from "vitest";
import { createSqsServer } from "../src/";

import { SQS } from "@aws-sdk/client-sqs";
import { AddressInfo } from "net";

describe("Multi Server", () => {
  it("should create multiple different servers with different configs", async () => {
    const region1 = "us-west-1";
    const accountId1 = "012123456789";

    const region2 = "eu-west-2";
    const accountId2 = "123456789012";

    const QueueName = "MyQueue";

    const server1 = await createSqsServer({ port: 0, region: region1, accountId: accountId1 });
    const { port: port1 } = server1.address() as AddressInfo;
    const client1 = new SQS({
      region: "us-east-1",
      endpoint: `http://localhost:${port1}`,
      credentials: {
        accessKeyId: "fake",
        secretAccessKey: "fake",
      },
    });

    await client1.createQueue({ QueueName });

    const { QueueUrl: QueueUrl1 } = await client1.getQueueUrl({ QueueName });

    expect(QueueUrl1).toBe(`http://localhost:${port1}/${accountId1}/${QueueName}`);

    const response1 = await client1.getQueueAttributes({ QueueUrl: QueueUrl1, AttributeNames: ["All"] });
    server1.close();
    expect(response1.Attributes?.QueueArn).toBe(`arn:aws:sqs:${region1}:${accountId1}:${QueueName}`);

    const server2 = await createSqsServer({ port: 0, region: region2, accountId: accountId2 });
    const { port: port2 } = server2.address() as AddressInfo;
    const client2 = new SQS({
      region: "us-east-1",
      endpoint: `http://localhost:${port2}`,
      credentials: {
        accessKeyId: "fake",
        secretAccessKey: "fake",
      },
    });

    await client2.createQueue({ QueueName });

    const { QueueUrl: QueueUrl2 } = await client2.getQueueUrl({ QueueName });

    expect(QueueUrl2).toBe(`http://localhost:${port2}/${accountId2}/${QueueName}`);

    const response2 = await client2.getQueueAttributes({ QueueUrl: QueueUrl2, AttributeNames: ["All"] });

    server2.close();
    expect(response2.Attributes?.QueueArn).toBe(`arn:aws:sqs:${region2}:${accountId2}:${QueueName}`);
  });
});
