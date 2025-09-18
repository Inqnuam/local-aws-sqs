import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, ListDeadLetterSourceQueuesCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const { client, server, cli, PORT } = await createServerAndCli();

const QueueName = "ListDLSQueue";

describe("List Dead Letter Source Queues", () => {
  afterAll(() => {
    server.close();
  });

  const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:${QueueName}`, maxReceiveCount: 5 });
  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName }));
    await client.send(
      new CreateQueueCommand({
        QueueName: "SourceQueue1",
        Attributes: { RedrivePolicy },
      })
    );

    await client.send(
      new CreateQueueCommand({
        QueueName: "SourceQueue2",
        Attributes: { RedrivePolicy },
      })
    );
    await client.send(
      new CreateQueueCommand({
        QueueName: "SourceQueue3",
        Attributes: { RedrivePolicy },
      })
    );
  });

  describe("Should fail", () => {
    it("with invalid MaxResults integer range", async () => {
      await expect(async () => {
        await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: -23 }));
      }).rejects.toThrow("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");

      await expect(async () => {
        await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1020 }));
      }).rejects.toThrow("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");
    });

    it("with invalid NextToken", async () => {
      await expect(async () => {
        await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, NextToken: "invalidtoken" }));
      }).rejects.toThrow("Invalid or expired next token.");
    });
  });

  describe("Should pass", () => {
    it("by listing all queueUrls", async () => {
      const res = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName }));

      expect(res.NextToken).toBeUndefined();
      expect(res.queueUrls).deep.eq([
        `http://localhost:${PORT}/123456789012/SourceQueue1`,
        `http://localhost:${PORT}/123456789012/SourceQueue2`,
        `http://localhost:${PORT}/123456789012/SourceQueue3`,
      ]);
    });

    it("with MaxResults 0", async () => {
      const res = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 0 }));

      expect(res.NextToken).toBeUndefined();
      expect(res.queueUrls).deep.eq([
        `http://localhost:${PORT}/123456789012/SourceQueue1`,
        `http://localhost:${PORT}/123456789012/SourceQueue2`,
        `http://localhost:${PORT}/123456789012/SourceQueue3`,
      ]);
    });

    it("with one by requests pagination", async () => {
      const res1 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1 }));
      expect(res1.queueUrls).deep.eq([`http://localhost:${PORT}/123456789012/SourceQueue1`]);
      expect(typeof res1.NextToken).toBe("string");

      const res2 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1, NextToken: res1.NextToken }));
      expect(res2.queueUrls).deep.eq([`http://localhost:${PORT}/123456789012/SourceQueue2`]);
      expect(typeof res2.NextToken).toBe("string");

      const res3 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1, NextToken: res2.NextToken }));
      expect(res3.queueUrls).deep.eq([`http://localhost:${PORT}/123456789012/SourceQueue3`]);
      expect(res3.NextToken).toBeUndefined();
    });

    it("with CLI", async () => {
      const res = JSON.parse((await cli(`list-dead-letter-source-queues --queue-url ${QueueName} --max-results 1`)) as string);
      expect(res.queueUrls).deep.eq([`http://localhost:${PORT}/123456789012/SourceQueue1`]);
      expect(typeof res.NextToken).toBe("string");
    });
  });
});
