import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, DeleteMessageBatchCommand, ReceiveMessageCommand, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

describe("Delete Message Batch", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Should fail", () => {
    it("without Entries", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName }));
      }).rejects.toThrow("The request must contain the parameter Entries.");
    });

    it("with empty Entries", async () => {
      await expect(async () => {
        await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
      }).rejects.toThrow("There should be at least one DeleteMessageBatchRequestEntry in the request.");
    });

    it("with too much entries", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
      }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
    });

    it("without Entry id", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [{ Id: "id-1", ReceiptHandle: "dummy" }, { ReceiptHandle: "dummy2" }] }));
      }).rejects.toThrow("The request must contain the parameter DeleteMessageBatchRequestEntry.2.Id.");
    });

    it("with empty Entry id", async () => {
      await expect(async () => {
        await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", ReceiptHandle: "dummy" },
              { Id: " ", ReceiptHandle: "dummy2" },
            ],
          })
        );
      }).rejects.toThrow("A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.");
    });

    it("with duplicated Entry ids", async () => {
      const Id = "id-1";
      await expect(async () => {
        await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id, ReceiptHandle: "dummy" },
              { Id, ReceiptHandle: "dummy2" },
            ],
          })
        );
      }).rejects.toThrow(`Id ${Id} repeated.`);
    });

    it("without ReceiptHandle", async () => {
      const res = await client.send(
        new DeleteMessageBatchCommand({
          QueueUrl: StandartQueueName,
          // @ts-expect-error
          Entries: [{ Id: "id-1" }],
        })
      );

      expect(res.Successful).toBeUndefined();
      expect(res.Failed).toHaveLength(1);
      expect(res.Failed![0]).deep.eq({
        Code: "MissingParameter",
        Id: "id-1",
        Message: "The request must contain the parameter ReceiptHandle.",
        SenderFault: true,
      });
    });

    it("with empty ReceiptHandle", async () => {
      const res = await client.send(
        new DeleteMessageBatchCommand({
          QueueUrl: StandartQueueName,

          Entries: [{ Id: "id-1", ReceiptHandle: " " }],
        })
      );

      expect(res.Successful).toBeUndefined();
      expect(res.Failed).toHaveLength(1);
      expect(res.Failed![0]).deep.eq({
        Code: "MissingParameter",
        Id: "id-1",
        Message: "The request must contain the parameter ReceiptHandle.",
        SenderFault: true,
      });
    });

    it("with invalid ReceiptHandle", async () => {
      const res = await client.send(
        new DeleteMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [{ Id: "id-1", ReceiptHandle: "dummy2" }],
        })
      );

      expect(res.Successful).toBeUndefined();
      expect(res.Failed).toHaveLength(1);
      expect(res.Failed![0]).deep.eq({
        Code: "ReceiptHandleIsInvalid",
        Id: "id-1",
        Message: 'The input receipt handle "dummy2" is not valid.',
        SenderFault: true,
      });
    });
  });

  describe("Should pass", () => {
    it("with all Entries", async () => {
      await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", MessageBody: "message 1" },
            { Id: "id-2", MessageBody: "message 2" },
            { Id: "id-3", MessageBody: "message 3" },
          ],
        })
      );

      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

      const res = await client.send(
        new DeleteMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
            { Id: "id-2", ReceiptHandle: Messages![1].ReceiptHandle },
            { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
          ],
        })
      );

      expect(res.Failed).toBeUndefined();
      expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-2" }, { Id: "id-3" }]);
    });

    it("(SDK) with partial failure", async () => {
      await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", MessageBody: "message 1" },
            { Id: "id-2", MessageBody: "message 2" },
            { Id: "id-3", MessageBody: "message 3" },
          ],
        })
      );

      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

      const res = await client.send(
        new DeleteMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
            { Id: "id-2", ReceiptHandle: "dummy-receiptHandle" },
            { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "ReceiptHandleIsInvalid",
          Id: "id-2",
          Message: 'The input receipt handle "dummy-receiptHandle" is not valid.',
          SenderFault: true,
        },
      ]);
      expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-3" }]);
    });

    it("(CLI) with partial failure", async () => {
      await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", MessageBody: "message 1" },
            { Id: "id-2", MessageBody: "message 2" },
            { Id: "id-3", MessageBody: "message 3" },
          ],
        })
      );

      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

      const Entries = [
        { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
        { Id: "id-2", ReceiptHandle: "dummy-receiptHandle" },
        { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
      ];
      const res = JSON.parse((await cli(`delete-message-batch --queue-url ${StandartQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

      expect(res.Failed).deep.eq([
        {
          Code: "ReceiptHandleIsInvalid",
          Id: "id-2",
          Message: 'The input receipt handle "dummy-receiptHandle" is not valid.',
          SenderFault: true,
        },
      ]);
      expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-3" }]);
    });
  });
});
