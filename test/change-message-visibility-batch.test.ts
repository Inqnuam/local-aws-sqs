import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { ChangeMessageVisibilityBatchCommand, CreateQueueCommand, ReceiveMessageCommand, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

describe("Change Message Visibility Batch", () => {
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
        await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName }));
      }).rejects.toThrow("The request must contain the parameter Entries.");
    });
    it("with empty entries", async () => {
      await expect(async () => {
        await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
      }).rejects.toThrow("There should be at least one ChangeMessageVisibilityBatch in the request.");
    });

    it("with too much entries", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
      }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
    });

    it("without entry id", async () => {
      await expect(async () => {
        await client.send(
          // @ts-expect-error
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
              },

              {
                ReceiptHandle: "dummy",
              },
              {
                Id: "3",
              },
            ],
          })
        );
      }).rejects.toThrow("The request must contain the parameter ChangeMessageVisibilityBatch.2.Id.");
    });

    it("with invalid entry id", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              // @ts-expect-error
              {
                Id: "é",
              },
            ],
          })
        );
      }).rejects.toThrow("A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.");
    });

    it("with duplicated entry ids", async () => {
      const Id = "some-id";
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id,
                ReceiptHandle: "Hello WORLD 1",
              },
              {
                Id,
                ReceiptHandle: "Hello WORLD 2",
              },
            ],
          })
        );
      }).rejects.toThrow(`Id ${Id} repeated.`);
    });

    it("without ReceiptHandle", async () => {
      const res = await client.send(
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,
          // @ts-expect-error
          Entries: [{ Id: "id-1", VisibilityTimeout: 20 }],
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
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,

          Entries: [{ Id: "id-1", ReceiptHandle: " ", VisibilityTimeout: 20 }],
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
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: 20 }],
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

    it("without VisibilityTimeout", async () => {
      const res = await client.send(
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,

          Entries: [{ Id: "id-1", ReceiptHandle: "dummy" }],
        })
      );

      expect(res.Successful).toBeUndefined();
      expect(res.Failed).toHaveLength(1);
      expect(res.Failed![0]).deep.eq({
        Code: "MissingParameter",
        Id: "id-1",
        Message: "The request must contain the parameter ChangeMessageVisibilityBatchRequestEntry.1.VisibilityTimeout.",
        SenderFault: true,
      });
    });

    it("with invalid VisibilityTimeout", async () => {
      const res = await client.send(
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: -85 }],
        })
      );

      expect(res.Successful).toBeUndefined();
      expect(res.Failed).toHaveLength(1);
      expect(res.Failed![0]).deep.eq({
        Code: "InvalidParameterValue",
        Id: "id-1",
        Message: "Value -85 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
        SenderFault: true,
      });
    });

    it("with Id as array", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: [], ReceiptHandle: "dummy2", VisibilityTimeout: 5 }],
          })
        );
      }).rejects.toThrow("Start of list found where not expected");
    });
    it("with Id as object", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: {}, ReceiptHandle: "dummy2", VisibilityTimeout: 5 }],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected");
    });

    it("with VisibilityTimeout as array", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: [] }],
          })
        );
      }).rejects.toThrow("Start of list found where not expected");
    });
    it("with VisibilityTimeout as object", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: {} }],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected");
    });

    it("with ReceiptHandle as array", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1", ReceiptHandle: [], VisibilityTimeout: 8 }],
          })
        );
      }).rejects.toThrow("Start of list found where not expected");
    });
    it("with ReceiptHandle as object", async () => {
      await expect(async () => {
        await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1", ReceiptHandle: {}, VisibilityTimeout: 5 }],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected");
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
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
            { Id: "id-2", ReceiptHandle: Messages![1].ReceiptHandle, VisibilityTimeout: 20 },
            { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: 20 },
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
        new ChangeMessageVisibilityBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
            { Id: "id-2", ReceiptHandle: "dummy", VisibilityTimeout: 20 },
            { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: -20 },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "ReceiptHandleIsInvalid",
          Id: "id-2",
          Message: 'The input receipt handle "dummy" is not valid.',
          SenderFault: true,
        },
        {
          Code: "InvalidParameterValue",
          Id: "id-3",
          Message: "Value -20 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
          SenderFault: true,
        },
      ]);
      expect(res.Successful).deep.eq([{ Id: "id-1" }]);
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
        { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
        { Id: "id-2", ReceiptHandle: "dummy", VisibilityTimeout: 20 },
        { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: -20 },
      ];

      const res = JSON.parse((await cli(`change-message-visibility-batch --queue-url ${StandartQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

      expect(res.Failed).deep.eq([
        {
          Code: "ReceiptHandleIsInvalid",
          Id: "id-2",
          Message: 'The input receipt handle "dummy" is not valid.',
          SenderFault: true,
        },
        {
          Code: "InvalidParameterValue",
          Id: "id-3",
          Message: "Value -20 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
          SenderFault: true,
        },
      ]);
      expect(res.Successful).deep.eq([{ Id: "id-1" }]);
    });
  });
});
