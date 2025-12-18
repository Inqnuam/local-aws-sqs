import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { ChangeMessageVisibilityCommand, CreateQueueCommand, ReceiveMessageCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

describe("Change Message Visibility", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Should fail", () => {
    it("without ReceiptHandle", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, VisibilityTimeout: 34 }));
      }).rejects.toThrow("The request must contain the parameter ReceiptHandle.");
    });

    it("with empty ReceiptHandle", async () => {
      await expect(async () => {
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "", VisibilityTimeout: 34 }));
      }).rejects.toThrow("The request must contain the parameter ReceiptHandle.");
    });

    it("with invalid ReceiptHandle", async () => {
      const ReceiptHandle = "45234sdsqdZER/qsqd";
      await expect(async () => {
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle, VisibilityTimeout: 34 }));
      }).rejects.toThrow(`The input receipt handle "${ReceiptHandle}" is not valid.`);
    });

    it("without VisibilityTimeout", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id" }));
      }).rejects.toThrow("The request must contain the parameter VisibilityTimeout.");
    });

    it("with invalid VisibilityTimeout (object)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout: {} }));
      }).rejects.toThrow(`Start of structure or map found where not expected.`);
    });

    it("with invalid VisibilityTimeout (array)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout: [] }));
      }).rejects.toThrow(`Start of list found where not expected`);
    });

    it("with invalid VisibilityTimeout (NaN)", async () => {
      const VisibilityTimeout = "dummy-value";
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
      }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
    });

    it("with invalid VisibilityTimeout (-)", async () => {
      const VisibilityTimeout = -10;
      await expect(async () => {
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
      }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
    });
    it("with invalid VisibilityTimeout (+)", async () => {
      const VisibilityTimeout = 43201;
      await expect(async () => {
        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
      }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
    });
  });

  it("Should pass", async () => {
    await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Hello" }));
    const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName }));

    const res = await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 34 }));

    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  it("Should pass with SQS VisibilityTimeout expected behaviour", { timeout: 10 * 1000 }, async () => {
    const QueueUrl = "VisibilityTestQueue";

    await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { VisibilityTimeout: "3" } }));
    await client.send(new SendMessageCommand({ QueueUrl, MessageBody: "Hello world" }));

    const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));

    expect(Messages).toHaveLength(1);

    const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
    expect(NoneMessages).toBeUndefined();

    await sleep(3);

    const { Messages: backedMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
    expect(backedMessages).toHaveLength(1);

    const [msg] = backedMessages!;

    await client.send(new ChangeMessageVisibilityCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle, VisibilityTimeout: 10 }));
    await sleep(5);

    const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
    expect(NoneMessages2).toBeUndefined();
  });
});
