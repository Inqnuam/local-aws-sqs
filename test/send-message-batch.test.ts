import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, SendMessageBatchCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

describe("Send Message Batch", () => {
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
        await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName }));
      }).rejects.toThrow("The request must contain the parameter Entries.");
    });
    it("with empty entries", async () => {
      await expect(async () => {
        await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
      }).rejects.toThrow("There should be at least one SendMessageBatchRequestEntry in the request.");
    });

    it("with too much entries", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
      }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
    });

    it("without entry id", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "Hello WORLD",
              },
              // @ts-expect-error
              {
                MessageBody: "Hello WORLD 2",
              },
              {
                Id: "3",
                MessageBody: "Hello WORLD 3",
              },
            ],
          })
        );
      }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.2.Id.");
    });

    it("with invalid entry id", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "é",
                MessageBody: "Hello WORLD",
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
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id,
                MessageBody: "Hello WORLD 1",
              },
              {
                Id,
                MessageBody: "Hello WORLD 2",
              },
            ],
          })
        );
      }).rejects.toThrow(`Id ${Id} repeated.`);
    });

    it("[Standart Queue] without MessageBody", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            // @ts-expect-error
            {
              Id: "1",
            },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "MissingParameter",
          Id: "1",
          Message: "The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.",
          SenderFault: true,
        },
      ]);
    });

    it("[Standart Queue] with empty MessageBody", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "",
            },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "MissingParameter",
          Id: "1",
          Message: "The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.",
          SenderFault: true,
        },
      ]);
    });

    it("[Standart Queue] with invalid MessageBody", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                // @ts-expect-error
                MessageBody: {},
              },
            ],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("[Standart Queue] with invalid DelaySeconds (object)", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                // @ts-expect-error
                DelaySeconds: {},
              },
            ],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("[Standart Queue] with invalid DelaySeconds (object)", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                // @ts-expect-error
                DelaySeconds: [],
              },
            ],
          })
        );
      }).rejects.toThrow("Start of list found where not expected");
    });

    it("[Standart Queue] with invalid DelaySeconds (object)", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                // @ts-expect-error
                DelaySeconds: {},
              },
            ],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("[Standart Queue] with invalid MessageAttributes - StringValue (object)", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageAttributes: {
                  attrib1: {
                    DataType: "Number",
                    // @ts-expect-error
                    StringValue: {},
                  },
                },
              },
            ],
          })
        );
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("[Standart Queue] with MessageDeduplicationId", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
              MessageDeduplicationId: "id-1",
            },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "InvalidParameterValue",
          Id: "1",
          Message: "The request include parameter that is not valid for this queue type",
          SenderFault: true,
        },
      ]);
    });

    it("[Standart Queue] with invalid MessageGroupId", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
              MessageGroupId: " ",
            },
          ],
        })
      );

      expect(res.Failed).deep.eq([
        {
          Code: "InvalidParameterValue",
          Id: "1",
          Message: "MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length",
          SenderFault: true,
        },
      ]);
    });

    it("[FIFO Queue] without MessageBody", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              // @ts-expect-error
              {
                Id: "1",
              },
            ],
          })
        );
      }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.");
    });

    it("[FIFO Queue] with empty MessageBody", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "",
              },
            ],
          })
        );
      }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.");
    });

    it("[FIFO Queue] without MessageGroupId", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
              },
            ],
          })
        );
      }).rejects.toThrow("The request must contain the parameter MessageGroupId.");
    });

    it("[FIFO Queue] without MessageDeduplicationId", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageGroupId: "id-1",
              },
            ],
          })
        );
      }).rejects.toThrow("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
    });

    it("[FIFO Queue] with DelaySeconds", async () => {
      await expect(async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageGroupId: "id-1",
                MessageDeduplicationId: "id-1",
                DelaySeconds: 3,
              },
            ],
          })
        );
      }).rejects.toThrow("Value 3 for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.");
    });

    describe("with invalid Message length", () => {
      const QueueUrl = "MessageBatchLengthDefinedQueue";
      const FifoQueueUrl = "FifoMessageBatchLengthDefinedQueue.fifo";
      const MaximumMessageSize = 1024;
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: String(MaximumMessageSize) } }));
        await client.send(
          new CreateQueueCommand({
            QueueName: FifoQueueUrl,
            Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true", MaximumMessageSize: String(MaximumMessageSize) },
          })
        );
      });

      it("[Standart Queue] total length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl,
              Entries: [
                {
                  Id: "1",
                  MessageBody: Array(524288).fill("a").join(""),
                },
                {
                  Id: "2",
                  MessageBody: Array(524230).fill("b").join(""),
                },
                {
                  Id: "3",
                  MessageBody: "message3",
                  MessageAttributes: {
                    Yolo: {
                      DataType: "Number.customtype",
                      StringValue: "12345678901234567890",
                    },
                  },
                },
                {
                  Id: "4",
                  MessageBody: "message4",
                  MessageAttributes: {
                    Yolo: {
                      DataType: "String",
                      StringValue: Array(50).fill("c").join(""),
                    },
                  },
                },
              ],
            })
          );
        }).rejects.toThrow("Batch requests cannot be longer than 1048576 bytes. You have sent 1048635 bytes.");
      });
      it("[FIFO Queue] total length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueUrl,
              Entries: [
                {
                  Id: "1",
                  MessageGroupId: "1",
                  MessageBody: Array(524288).fill("a").join(""),
                },
                {
                  Id: "2",
                  MessageGroupId: "2",
                  MessageBody: Array(524230).fill("b").join(""),
                },
                {
                  Id: "3",
                  MessageGroupId: "3",
                  MessageBody: "message3",
                  MessageAttributes: {
                    Yolo: {
                      DataType: "Number.customtype",
                      StringValue: "12345678901234567890",
                    },
                  },
                },
                {
                  Id: "4",
                  MessageGroupId: "4",
                  MessageBody: "message4",
                  MessageAttributes: {
                    Yolo: {
                      DataType: "String",
                      StringValue: Array(50).fill("c").join(""),
                    },
                  },
                },
              ],
            })
          );
        }).rejects.toThrow("Batch requests cannot be longer than 1048576 bytes. You have sent 1048635 bytes.");
      });

      it("[Standart Queue] individual message length", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl,
            Entries: [
              {
                Id: "1",
                MessageBody: Array(MaximumMessageSize).fill("a").join(""),
              },
              {
                Id: "2",
                MessageBody: Array(MaximumMessageSize - 100)
                  .fill("a")
                  .join(""),
                MessageAttributes: {
                  attrib1: {
                    DataType: "String",
                    StringValue: Array(50).fill("b").join(""),
                  },
                  attrib2: {
                    DataType: "Number",
                    StringValue: "12345678901234568",
                  },
                  attrib3: {
                    DataType: "Binary",
                    BinaryValue: Buffer.from(Array(30).fill("c").join("")),
                  },
                },
              },
            ],
          })
        );

        expect(res.Successful).toHaveLength(1);
        expect(res.Successful![0].Id).toBe("1");

        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0].Id).toBe("2");
      });

      it("[FIFO Queue] individual message length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueUrl,
              Entries: [
                {
                  Id: "1",
                  MessageGroupId: "1",
                  MessageBody: Array(MaximumMessageSize).fill("a").join(""),
                },
                {
                  Id: "2",
                  MessageGroupId: "2",
                  MessageBody: Array(MaximumMessageSize - 100)
                    .fill("a")
                    .join(""),
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: Array(50).fill("b").join(""),
                    },
                    attrib2: {
                      DataType: "Number",
                      StringValue: "12345678901234568",
                    },
                    attrib3: {
                      DataType: "Binary",
                      BinaryValue: Buffer.from(Array(30).fill("c").join("")),
                    },
                  },
                },
              ],
            })
          );
        }).rejects.toThrow("One or more parameters are invalid. Reason: Message must be shorter than 1024 bytes.");
      });
    });
  });

  describe("Should pass", () => {
    it("[Standart Queue] with MessageGroupId", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
            },
            {
              Id: "2",
              MessageBody: "some message 2",
              MessageGroupId: "group-1",
            },
          ],
        })
      );

      expect(res.Failed).toBeUndefined();
      expect(res.Successful!.length).toBe(2);

      const [msg1, msg2] = res.Successful!;

      expect(msg1.Id).toBe("1");
      expect(typeof msg1.MessageId).toBe("string");
      expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");

      expect(msg2.Id).toBe("2");
      expect(typeof msg2.MessageId).toBe("string");
      expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
    });

    it("[Standart Queue] without Attributes", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
            },
            {
              Id: "2",
              MessageBody: "some message 2",
            },
          ],
        })
      );

      expect(res.Failed).toBeUndefined();
      expect(res.Successful!.length).toBe(2);

      const [msg1, msg2] = res.Successful!;

      expect(msg1.Id).toBe("1");
      expect(typeof msg1.MessageId).toBe("string");
      expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");

      expect(msg2.Id).toBe("2");
      expect(typeof msg2.MessageId).toBe("string");
      expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
    });

    it("[Standart Queue] with Attributes", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: StandartQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
              MessageAttributes: {
                data1: {
                  DataType: "Number",
                  StringValue: "1",
                },
                data2: {
                  DataType: "Number",
                  StringValue: "2",
                },
              },
            },
            {
              Id: "2",
              MessageBody: "some message 2",
              MessageAttributes: {
                data1: {
                  DataType: "Number",
                  StringValue: "1",
                },
              },
              MessageSystemAttributes: {
                AWSTraceHeader: {
                  DataType: "String",
                  StringValue: "some-value",
                },
              },
            },
          ],
        })
      );

      expect(res.Failed).toBeUndefined();
      expect(res.Successful!.length).toBe(2);

      const [msg1, msg2] = res.Successful!;

      expect(msg1.Id).toBe("1");
      expect(typeof msg1.MessageId).toBe("string");
      expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
      expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
      expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
      expect(msg1.SequenceNumber).toBeUndefined();

      expect(msg2.Id).toBe("2");
      expect(typeof msg2.MessageId).toBe("string");
      expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
      expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
      expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
      expect(msg2.SequenceNumber).toBeUndefined();
    });

    it("[FIFO Queue] with Attributes", async () => {
      const res = await client.send(
        new SendMessageBatchCommand({
          QueueUrl: FifoQueueName,
          Entries: [
            {
              Id: "1",
              MessageBody: "some message",
              MessageGroupId: "group-1",
              MessageDeduplicationId: "id-1",
              MessageAttributes: {
                data1: {
                  DataType: "Number",
                  StringValue: "1",
                },
                data2: {
                  DataType: "Number",
                  StringValue: "2",
                },
              },
            },
            {
              Id: "2",
              MessageBody: "some message 2",
              MessageDeduplicationId: "id-2",
              MessageGroupId: "group-1",
              MessageAttributes: {
                data1: {
                  DataType: "Number",
                  StringValue: "1",
                },
              },
              MessageSystemAttributes: {
                AWSTraceHeader: {
                  DataType: "String",
                  StringValue: "some-value",
                },
              },
            },
          ],
        })
      );

      expect(res.Failed).toBeUndefined();
      expect(res.Successful!.length).toBe(2);

      const [msg1, msg2] = res.Successful!;

      expect(msg1.Id).toBe("1");
      expect(typeof msg1.MessageId).toBe("string");
      expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
      expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
      expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
      expect(typeof msg1.SequenceNumber).toBe("string");
      expect(msg1.SequenceNumber).toHaveLength(20);

      expect(msg2.Id).toBe("2");
      expect(typeof msg2.MessageId).toBe("string");
      expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
      expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
      expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
      expect(typeof msg2.SequenceNumber).toBe("string");
      expect(msg2.SequenceNumber).toHaveLength(20);
    });

    it("(CLI) [FIFO Queue] with Attributes", async () => {
      const Entries = [
        {
          Id: "1",
          MessageBody: "some message",
          MessageGroupId: "group-1",
          MessageDeduplicationId: "id-1",
          MessageAttributes: {
            data1: {
              DataType: "Number",
              StringValue: "1",
            },
            data2: {
              DataType: "Number",
              StringValue: "2",
            },
          },
        },
        {
          Id: "2",
          MessageBody: "some message 2",
          MessageDeduplicationId: "id-2",
          MessageGroupId: "group-1",
          MessageAttributes: {
            data1: {
              DataType: "Number",
              StringValue: "1",
            },
          },
          MessageSystemAttributes: {
            AWSTraceHeader: {
              DataType: "String",
              StringValue: "some-value",
            },
          },
        },
      ];

      const res = JSON.parse((await cli(`send-message-batch --queue-url ${FifoQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

      expect(res.Failed).toBeUndefined();
      expect(res.Successful!.length).toBe(2);

      const [msg1, msg2] = res.Successful!;

      expect(msg1.Id).toBe("1");
      expect(typeof msg1.MessageId).toBe("string");
      expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
      expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
      expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
      expect(typeof msg1.SequenceNumber).toBe("string");
      expect(msg1.SequenceNumber).toHaveLength(20);

      expect(msg2.Id).toBe("2");
      expect(typeof msg2.MessageId).toBe("string");
      expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
      expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
      expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
      expect(typeof msg2.SequenceNumber).toBe("string");
      expect(msg2.SequenceNumber).toHaveLength(20);
    });

    it("[Standart Queue] with castable types", async () => {
      const QueueUrl = "BatchCastableQueue";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

      try {
        await client.send(
          // @ts-ignore
          new SendMessageBatchCommand({
            QueueUrl,
            Entries: [
              {
                Id: "1",
                MessageBody: false,
                MessageAttributes: {
                  attrib1: {
                    DataType: "String",
                    StringValue: 0,
                  },
                  attrib2: {
                    DataType: "String",
                    StringValue: false,
                  },
                },
              },
            ],
          })
        );
      } catch (error) {}

      const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"] }));

      const [msg] = res.Messages!;

      expect(msg.Body).toBe("false");
      expect(msg.MD5OfBody).toBe("68934a3e9455fa72420237eb05902327");
      expect(msg.MD5OfMessageAttributes).toBe("2739524b68e7d718aeaf6730e2e38cfe");
      expect(msg.MessageAttributes).deep.eq({
        attrib1: { DataType: "String", StringValue: "0" },
        attrib2: { DataType: "String", StringValue: "false" },
      });
    });
    it("[FIFO Queue] with castable types", async () => {
      const QueueUrl = "FifoBatchCastableQueue.fifo";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" } }));

      try {
        await client.send(
          // @ts-ignore
          new SendMessageBatchCommand({
            QueueUrl,
            Entries: [
              {
                Id: 5,
                MessageGroupId: 7654,
                MessageBody: false,
                MessageAttributes: {
                  attrib1: {
                    DataType: "String",
                    StringValue: 0,
                  },
                  attrib2: {
                    DataType: "String",
                    StringValue: false,
                  },
                },
              },
            ],
          })
        );
      } catch (error) {}

      const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"], AttributeNames: ["All"] }));

      const [msg] = res.Messages!;

      expect(msg.Body).toBe("false");
      expect(msg.MD5OfBody).toBe("68934a3e9455fa72420237eb05902327");
      expect(msg.MD5OfMessageAttributes).toBe("2739524b68e7d718aeaf6730e2e38cfe");
      expect(msg.MessageAttributes).deep.eq({
        attrib1: { DataType: "String", StringValue: "0" },
        attrib2: { DataType: "String", StringValue: "false" },
      });
      expect(typeof msg.Attributes!.MessageGroupId).toBe("string");
      expect(msg.Attributes!.MessageGroupId).toBe("7654");
    });
  });
});
