import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, ReceiveMessageCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

describe("DLQ", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  const SourceQueue = "MoveMessage_SourceQueue";
  const DLQ = "MoveMessage_DLQ";
  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: DLQ }));

    const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:1234567890:${DLQ}`, maxReceiveCount: 3 });
    await client.send(new CreateQueueCommand({ QueueName: SourceQueue, Attributes: { RedrivePolicy, VisibilityTimeout: "1" } }));
  });

  it("Should move messages to DLQ after x receive", async () => {
    const AWSTraceHeader = "trace-id=1234";
    const MessageAttributes = { attrib1: { DataType: "String", StringValue: "dummy value" } };
    const MessageBody = "Hello World";

    const { MessageId, MD5OfMessageAttributes, MD5OfMessageBody } = await client.send(
      new SendMessageCommand({
        QueueUrl: SourceQueue,
        MessageBody,
        MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: AWSTraceHeader } },
        MessageAttributes,
      })
    );
    await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));
    await sleep(1);
    await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));
    await sleep(1);
    await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));

    await sleep(1);

    const { Messages: SourceQueueMsg } = await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));

    expect(SourceQueueMsg).toBeUndefined();

    const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: DLQ, AttributeNames: ["All"], MessageAttributeNames: ["All"] }));

    expect(Messages).toHaveLength(1);

    const [msg] = Messages!;

    expect(msg.MessageId).toBe(MessageId);
    expect(msg.Body).toBe(MessageBody);
    expect(msg.MD5OfBody).toBe(MD5OfMessageBody);
    expect(msg.MessageAttributes).deep.eq(MessageAttributes);
    expect(msg.MD5OfMessageAttributes).toBe(MD5OfMessageAttributes);
    expect(msg.Attributes!.AWSTraceHeader).toBe(AWSTraceHeader);
    expect(msg.Attributes!.DeadLetterQueueSourceArn).toBe(`arn:aws:sqs:us-east-1:123456789012:${SourceQueue}`);
  });
});
