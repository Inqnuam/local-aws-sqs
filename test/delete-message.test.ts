import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, DeleteMessageCommand, ReceiveMessageCommand, SendMessageBatchCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

describe("Delete Message", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  it("should delete with valid ReceiptHandle", async () => {
    await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message" }));

    const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName }));

    const res = await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle }));

    expect(res.$metadata.httpStatusCode).toBe(200);

    const res2 = await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle }));

    expect(res2.$metadata.httpStatusCode).toBe(200);
  });

  it("Should fail to delete with invalid ReceiptHandle", async () => {
    await expect(async () => {
      await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "invalid-receipt-id" }));
    }).rejects.toThrow('The input receipt handle "invalid-receipt-id" is not valid.');
  });

  describe("[FIFO]", () => {
    const QueueUrl = "FIFODeleteMessageQueue789.fifo";
    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" } }));
      await client.send(
        new SendMessageBatchCommand({
          QueueUrl,
          Entries: [
            { Id: "1", MessageBody: "Hello", MessageGroupId: "gid-1" },
            { Id: "2", MessageBody: "Hello 2", MessageGroupId: "gid-2" },
            { Id: "3", MessageBody: "Hello 3", MessageGroupId: "gid-3" },
          ],
        })
      );
    });

    it("[FIFO] should fail to delete visible message", async () => {
      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl, VisibilityTimeout: 0 }));
      await sleep(1);
      const [msg] = Messages!;
      await expect(async () => {
        await client.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle }));
      }).rejects.toThrow(`Value ${msg.ReceiptHandle} for parameter ReceiptHandle is invalid. Reason: The receipt handle has expired.`);
    });
  });
});
