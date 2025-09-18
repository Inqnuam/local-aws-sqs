import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, SendMessageCommand, DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));
describe("Send Message", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Standart Queue", () => {
    describe("Should fail", () => {
      it("without MessageBody", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName }));
        }).rejects.toThrow("The request must contain the parameter MessageBody.");
      });

      it("with empty MessageBody", async () => {
        await expect(async () => {
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "" }));
        }).rejects.toThrow("The request must contain the parameter MessageBody.");
      });

      it("with invalid MessageBody", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: {} }));
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("with invalid DelaySeconds (NaN)", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: "invalid" }));
        }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
      });

      it("with invalid DelaySeconds (invalid integer range)", async () => {
        await expect(async () => {
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: -234 }));
        }).rejects.toThrow("Value -234 for parameter DelaySeconds is invalid. Reason: DelaySeconds must be >= 0 and <= 900.");

        await expect(async () => {
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: 1000 }));
        }).rejects.toThrow("Value 1000 for parameter DelaySeconds is invalid. Reason: DelaySeconds must be >= 0 and <= 900.");
      });

      it("with invalid attributes", async () => {
        await expect(async () => {
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageDeduplicationId: "1000" }));
        }).rejects.toThrow("The request include parameter MessageDeduplicationId which is not valid for this queue type");
      });

      it("with invalid MessageAttributes", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: { DataType: "Number", StringValue: "world" } } })
          );
        }).rejects.toThrow("Can't cast the value of message (user) attribute 'Hello' to a number.");

        await expect(async () => {
          await client.send(
            new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: { DataType: "String", StringValue: "" } } })
          );
        }).rejects.toThrow("Message (user) attribute 'Hello' must contain a non-empty value of type 'String'.");

        await expect(async () => {
          await client.send(
            new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { "": { DataType: "String", StringValue: "some value" } } })
          );
        }).rejects.toThrow("The request must contain non-empty message (user) attribute names.");

        await expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: {} } }));
        }).rejects.toThrow("The message (user) attribute 'Hello' must contain a non-empty message attribute value.");

        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: { Hello: { DataType: "InvalidType", StringValue: "some value" } },
            })
          );
        }).rejects.toThrow("The type of message (user) attribute 'Hello' is invalid. You must use only the following supported type prefixes: Binary, Number, String.");
      });

      it("with invalid MessageAttributes", async () => {
        await expect(async () => {
          await client.send(
            // @ts-expect-error
            new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageSystemAttributes: { Hello: { StringValue: "World", DataType: "String" } } })
          );
        }).rejects.toThrow("Message system attribute name 'Hello' is invalid.");
      });

      it("with invalid MessageAttributes data type (String List)", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                Hello: {
                  DataType: "StringList",
                  StringListValues: ["World"],
                },
              },
            })
          );
        }).rejects.toThrow("Message attribute list values in SendMessage operation are not supported.");
      });

      it("with invalid MessageAttributes data type (Binary List)", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                Hello: {
                  DataType: "BinaryList",
                  BinaryListValues: [Buffer.from("World")],
                },
              },
            })
          );
        }).rejects.toThrow("Message attribute list values in SendMessage operation are not supported.");
      });

      it("with reserved MessageAttributes name (AWS.)", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                "AWS.Hello": {
                  DataType: "String",
                  StringValue: "World",
                },
              },
            })
          );
        }).rejects.toThrow("You can't use message attribute names beginning with 'AWS.' or 'Amazon'. These strings are reserved for internal use.");
      });

      it("with reserved MessageAttributes name (amazon.)", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                "amazon.Hello": {
                  DataType: "String",
                  StringValue: "World",
                },
              },
            })
          );
        }).rejects.toThrow("You can't use message attribute names beginning with 'AWS.' or 'Amazon'. These strings are reserved for internal use.");
      });

      it("with invalid MessageAttributes enteries length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                attrib1: { DataType: "String", StringValue: "World" },
                attrib2: { DataType: "String", StringValue: "World" },
                attrib3: { DataType: "String", StringValue: "World" },
                attrib4: { DataType: "String", StringValue: "World" },
                attrib5: { DataType: "String", StringValue: "World" },
                attrib6: { DataType: "String", StringValue: "World" },
                attrib7: { DataType: "String", StringValue: "World" },
                attrib8: { DataType: "String", StringValue: "World" },
                attrib9: { DataType: "String", StringValue: "World" },
                attrib10: { DataType: "String", StringValue: "World" },
                attrib11: { DataType: "String", StringValue: "World" },
              },
            })
          );
        }).rejects.toThrow("Number of message attributes [11] exceeds the allowed maximum [10].");
      });

      it("with invalid MessageAttributes entry name length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                [Array(257).fill("a").join("")]: { DataType: "String", StringValue: "World" },
              },
            })
          );
        }).rejects.toThrow("Message (user) attribute name must be shorter than 256 bytes.");
      });

      it("with invalid MessageAttributes entry type length", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: StandartQueueName,
              MessageBody: "Test message",
              MessageAttributes: {
                attrib1: { DataType: `String.${Array(250).fill("a").join("")}`, StringValue: "World" },
              },
            })
          );
        }).rejects.toThrow("Message (user) attribute type must be shorter than 256 bytes.");
      });

      describe("with invalid Message length", () => {
        const QueueUrl = "MessageLengthDefinedQueue";
        const MaximumMessageSize = 1024;
        beforeAll(async () => {
          await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: String(MaximumMessageSize) } }));
        });

        it("MessageBody", async () => {
          await expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl,
                MessageBody: Array(MaximumMessageSize + 1)
                  .fill("a")
                  .join(""),
              })
            );
          }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
        });

        it("MessageAttributes", async () => {
          await expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl,
                MessageBody: "Hello",
                MessageAttributes: {
                  attrib1: {
                    DataType: "String",
                    StringValue: Array(MaximumMessageSize + 1)
                      .fill("a")
                      .join(""),
                  },
                },
              })
            );
          }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
        });

        it("MessageBody + MessageAttributes", async () => {
          await expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl,
                MessageBody: Array(513).fill("a").join(""),
                MessageAttributes: {
                  attrib1: {
                    DataType: "String",
                    StringValue: Array(256).fill("a").join(""),
                  },
                  attrib2: {
                    DataType: "String",
                    StringValue: Array(256).fill("a").join(""),
                  },
                },
              })
            );
          }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
        });
      });
    });

    it("should send message with custom data type", async () => {
      const res = await client.send(
        new SendMessageCommand({
          QueueUrl: StandartQueueName,
          MessageBody: "Test Message",
          MessageAttributes: { UserId: { DataType: "Number.bigint", StringValue: "1234567890123456789012" } },
          MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "some-trace-id" } },
        })
      );

      expect(res.MD5OfMessageAttributes).toBe("797ab158d73dcb5242dedc4412c8e855");
      expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
      expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
      expect(typeof res.MessageId).toBe("string");
      expect(res.MessageId!.length).toBeGreaterThan(10);
    });

    it("should send with castable type", async () => {
      const QueueUrl = "CastableQueue";

      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

      try {
        await client.send(
          // @ts-ignore
          new SendMessageCommand({
            QueueUrl,
            MessageBody: 0,
            MessageAttributes: { attrib1: { DataType: "String", StringValue: 2345 }, attrib2: { DataType: "String", StringValue: true } },
          })
        );
      } catch (error) {}

      const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"] }));

      const [msg] = res.Messages!;

      expect(msg.Body).toBe("0");
      expect(msg.MD5OfBody).toBe("cfcd208495d565ef66e7dff9f98764da");
      expect(msg.MD5OfMessageAttributes).toBe("c92eae09ef2c14cd949cc265ebc9cb50");
      expect(msg.MessageAttributes).deep.eq({
        attrib1: { DataType: "String", StringValue: "2345" },
        attrib2: { DataType: "String", StringValue: "true" },
      });
    });

    it("(SDK) should send message", async () => {
      const res = await client.send(
        new SendMessageCommand({
          QueueUrl: StandartQueueName,
          MessageBody: "Test Message",

          MessageAttributes: { Hello: { DataType: "String", StringValue: "World" } },
          MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "some-trace-id" } },
        })
      );

      expect(res.MD5OfMessageAttributes).toBe("7db7fb1ba7f41366a8ea5eb18220b26d");
      expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
      expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
      expect(typeof res.MessageId).toBe("string");
      expect(res.MessageId!.length).toBeGreaterThan(10);
    });

    it("(CLI) should send message", async () => {
      const res = JSON.parse(
        (await cli(
          `send-message --queue-url ${StandartQueueName} --message-body "Test Message" --message-attributes '{ "Hello":{ "DataType":"String","StringValue":"World" } }' --message-system-attributes '{ "AWSTraceHeader":{ "DataType":"String","StringValue":"some-trace-id" } }'`
        )) as string
      );

      expect(res.MD5OfMessageAttributes).toBe("7db7fb1ba7f41366a8ea5eb18220b26d");
      expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
      expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
      expect(typeof res.MessageId).toBe("string");
      expect(res.MessageId!.length).toBeGreaterThan(10);
    });

    it("should pass with Fair Queue", async () => {
      const res = await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageGroupId: "23432" }));

      expect(res.MessageId!.length).toBeGreaterThan(10);
    });

    it(
      "should pass with SQS expected DelaySeconds behaviour",
      async () => {
        const QueueUrl = "DelayedTestQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: "2" } }));
        await client.send(new SendMessageCommand({ QueueUrl, MessageBody: "Hello world" }));

        const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages).toBeUndefined();

        await sleep(3);

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(Messages).toHaveLength(1);

        await client.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: Messages![0].ReceiptHandle }));
        const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages2).toBeUndefined();

        const MessageBody = "Hello world from delayed queue";
        await client.send(new SendMessageCommand({ QueueUrl, MessageBody, DelaySeconds: 5 }));

        await sleep(3);
        const { Messages: NoneMessages3 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages3).toBeUndefined();

        await sleep(3); // 3 + 3 exceeds DelaySeconds: 5

        const { Messages: Messages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(Messages2).toHaveLength(1);

        expect(Messages2![0].Body).toBe(MessageBody);
      },
      { timeout: 20 * 1000 }
    );
  });

  describe("FIFO Queue", () => {
    describe("Should fail", () => {
      it("without MessageDeduplicationId", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: FifoQueueName,
              MessageBody: "Test message",
              MessageGroupId: randomUUID(),
            })
          );
        }).rejects.toThrow("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
      });

      it("without MessageGroupId", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: FifoQueueName,
              MessageBody: "Test message",
              MessageDeduplicationId: randomUUID(),
            })
          );
        }).rejects.toThrow("The request must contain the parameter MessageGroupId.");
      });

      it("with invalid DelaySeconds (NaN)", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({
              QueueUrl: FifoQueueName,
              MessageBody: "Test message",
              MessageDeduplicationId: randomUUID(),
              MessageGroupId: randomUUID(),
              // @ts-expect-error
              DelaySeconds: "invalid",
            })
          );
        }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
      });

      it("with invalid FIFO Queue attribtue DelaySeconds", async () => {
        await expect(async () => {
          await client.send(
            new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message", MessageDeduplicationId: randomUUID(), MessageGroupId: randomUUID(), DelaySeconds: 60 })
          );
        }).rejects.toThrow("Value 60 for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.");
      });
    });
    it("should send message", async () => {
      const res = await client.send(
        new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message", MessageDeduplicationId: randomUUID(), MessageGroupId: randomUUID() })
      );

      expect(res.MD5OfMessageBody).toBe("82dfa5549ebc9afc168eb7931ebece5f");
      expect(typeof res.MessageId).toBe("string");
      expect(res.MessageId!.length).toBeGreaterThan(10);
      expect(typeof res.SequenceNumber).toBe("string");
      expect(res.SequenceNumber!.length).toBe(20);
    });

    it("should deduplicate message", async () => {
      const MessageDeduplicationId = randomUUID();
      const MessageGroupId = randomUUID();
      const res1 = await client.send(new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message 1", MessageDeduplicationId, MessageGroupId }));
      const res2 = await client.send(new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "another message", MessageDeduplicationId, MessageGroupId }));

      expect(typeof res1.MessageId).toBe("string");
      expect(res1.MessageId!.length).toBeGreaterThan(10);
      expect(res1.MessageId).toBe(res2.MessageId);

      expect(typeof res1.SequenceNumber).toBe("string");
      expect(res1.SequenceNumber!.length).toBe(20);
      expect(res1.SequenceNumber).toBe(res2.SequenceNumber);

      expect(res1.MD5OfMessageBody).toBe("b607df2baaced02c7a7f5c3dc6973301");
      expect(res2.MD5OfMessageBody).toBe("80d402c39512ac39d7e8e79e2cfa935e");
    });
  });
});
