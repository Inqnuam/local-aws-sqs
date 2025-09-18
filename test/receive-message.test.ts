import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, ReceiveMessageCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

describe("Receive Message", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Should fail", () => {
    it("with invalid MaxNumberOfMessages", async () => {
      await expect(async () => {
        await client.send(
          new ReceiveMessageCommand({
            QueueUrl: StandartQueueName,
            MaxNumberOfMessages: 50,
          })
        );
      }).rejects.toThrow("Value 50 for parameter MaxNumberOfMessages is invalid. Reason: Must be between 1 and 10, if provided.");
    });

    it("with invalid WaitTimeSeconds", async () => {
      await expect(async () => {
        await client.send(
          new ReceiveMessageCommand({
            QueueUrl: StandartQueueName,
            WaitTimeSeconds: 50,
          })
        );
      }).rejects.toThrow("Value 50 for parameter WaitTimeSeconds is invalid. Reason: Must be >= 0 and <= 20, if provided.");
    });

    it("with invalid VisibilityTimeout", async () => {
      await expect(async () => {
        await client.send(
          new ReceiveMessageCommand({
            QueueUrl: StandartQueueName,
            VisibilityTimeout: 43201,
          })
        );
      }).rejects.toThrow("Value 43201 for parameter VisibilityTimeout is invalid. Reason: Must be >= 0 and <= 43200, if provided.");
    });
  });

  describe("Should pass", () => {
    it("with All Attributes", async () => {
      const QueueUrl = "AllAttribsQueue";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

      await client.send(
        new SendMessageCommand({
          QueueUrl: QueueUrl,
          MessageBody: "message from SDK",
          MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "dummy-id" } },
          MessageAttributes: { DummyName: { DataType: "String", StringValue: "dummy value" } },
        })
      );

      const { Messages } = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: QueueUrl,
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"],
        })
      );

      const [msg] = Messages!;

      expect(msg.Body).toBe("message from SDK");
      expect(msg.MD5OfBody).toBe("6d05602485318fa52030abb234e75682");
      expect(msg.MessageAttributes).deep.eq({ DummyName: { DataType: "String", StringValue: "dummy value" } });
      expect(msg.MD5OfMessageAttributes).toBe("ceb4493d294c7939e5ef8d20ee169e02");
      expect(typeof msg.ReceiptHandle).toBe("string");

      expect(msg.Attributes).toBeDefined();
      expect(isNaN(msg.Attributes!.ApproximateReceiveCount as unknown as number)).toBe(false);
      expect(isNaN(msg.Attributes!.SentTimestamp as unknown as number)).toBe(false);
      expect(isNaN(msg.Attributes!.ApproximateFirstReceiveTimestamp as unknown as number)).toBe(false);
    });

    it("(SDK) with filtered Message Attributes", async () => {
      const QueueUrl = "SDKFilterAttribQueue";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
      await client.send(
        new SendMessageCommand({
          QueueUrl,
          MessageBody: "message from SDK",
          MessageAttributes: {
            Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
            Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
            OtherName: { DataType: "String", StringValue: "other value" },
            Dummy3Name: { DataType: "Binary", BinaryValue: Buffer.from("dummy 2 value") },
          },
        })
      );

      const { Messages } = await client.send(
        new ReceiveMessageCommand({
          QueueUrl,
          MessageAttributeNames: ["Dummy.*"],
        })
      );

      const [msg] = Messages!;

      expect(msg.Body).toBe("message from SDK");
      expect(msg.MD5OfBody).toBe("6d05602485318fa52030abb234e75682");
      expect(msg.MessageAttributes).deep.eq({
        Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
        Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
        Dummy3Name: { DataType: "Binary", BinaryValue: Buffer.from("dummy 2 value") },
      });
      expect(msg.MD5OfMessageAttributes).toBe("c5c0d2c6f195fcbc91083c5465d8955f");
      expect(typeof msg.ReceiptHandle).toBe("string");
    });

    it("(CLI) with filtered Message Attributes", async () => {
      const QueueUrl = "CLIFilterAttribQueue";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
      await client.send(
        new SendMessageCommand({
          QueueUrl,
          MessageBody: "message from CLI",
          MessageAttributes: {
            Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
            Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
            OtherName: { DataType: "String", StringValue: "other value" },
          },
        })
      );

      const { Messages } = JSON.parse((await cli(`receive-message --queue-url ${QueueUrl} --message-attribute-names Dummy.*`)) as string);
      const [msg] = Messages!;

      expect(msg.Body).toBe("message from CLI");
      expect(msg.MD5OfBody).toBe("72db3782a7482d9cf0dc847798cf0f3a");
      expect(msg.MessageAttributes).deep.eq({
        Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
        Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
      });
      expect(msg.MD5OfMessageAttributes).toBe("00954f005e854e11dbe82998292c6666");
      expect(typeof msg.ReceiptHandle).toBe("string");
    });

    it(
      "with SQS WaitTimeSeconds behaviour",
      async () => {
        const QueueUrl = "WaitTimeSecondsQueue";
        const MessageBody = "Message sent later";
        const WaitTimeSeconds = 5;

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

        setTimeout(async () => {
          await client.send(new SendMessageCommand({ QueueUrl, MessageBody }));
        }, 3 * 1000);

        const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages).toBeUndefined();

        const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 1 }));
        expect(NoneMessages2).toBeUndefined();

        const beforeReq = Date.now() / 1000;
        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds, MaxNumberOfMessages: 2 }));
        const afterReq = Date.now() / 1000;

        const spentTime = afterReq - beforeReq;
        expect(spentTime).toBeGreaterThan(WaitTimeSeconds);

        expect(Messages).toHaveLength(1);
        expect(Messages![0].Body).toBe(MessageBody);
      },
      { timeout: 10 * 1000 }
    );

    it(
      "with SQS WaitTimeSeconds + VisibilityTimeout behaviour",
      async () => {
        const QueueUrl = "WaitTimeSecondsVisibilityTimeoutQueue";
        const MessageBody = "Message with 0 Visibility";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
        await client.send(new SendMessageCommand({ QueueUrl, MessageBody }));

        const { Messages } = await client.send(
          // @ts-ignore
          new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 0, VisibilityTimeout: 0, MaxNumberOfMessages: 10, AttributeNames: ["ApproximateReceiveCount"] })
        );
      },
      { timeout: 10 * 1000 }
    );
  });
});
