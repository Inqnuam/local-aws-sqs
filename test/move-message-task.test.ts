import { describe, it, expect, afterAll, beforeAll } from "vitest";
import {
  CancelMessageMoveTaskCommand,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ListMessageMoveTasksCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

describe("MessageMoveTask", () => {
  afterAll(() => {
    server?.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Should fail to start a new Task", () => {
    const SourceArn = "arn:aws:sqs:eu-west-3:123456789012:FAILStartMessageMoveTask_SourceArn";
    const DestinationArn = "arn:aws:sqs:eu-west-3:123456789012:FAILStartMessageMoveTask_DestinationArn";

    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: "FAILStartMessageMoveTask_SourceArn" }));

      await client.send(
        new CreateQueueCommand({
          QueueName: "FAILStartMessageMoveTask_DestinationArn",
          Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
        })
      );
    });

    it("without SourceArn", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({}));
      }).rejects.toThrow("The request must contain the parameter SourceArn.");
    });

    it("with empty SourceArn", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn: "" }));
      }).rejects.toThrow("You must use this format to specify the SourceArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
    });

    it("with invalid SourceArn type (object)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn: {} }));
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("with invalid SourceArn type (array)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn: [] }));
      }).rejects.toThrow("Start of list found where not expected");
    });

    it("with inexisting SourceArn", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn: "arn:aws:sqs:eu-west-3:123456789012:IDontExist" }));
      }).rejects.toThrow("The resource that you specified for the SourceArn parameter doesn't exist.");
    });

    it("without DLQ Policy SourceArn Queue", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "ImNotDLQ" }));
        await client.send(new StartMessageMoveTaskCommand({ SourceArn: "arn:aws:sqs:eu-west-3:123456789012:ImNotDLQ" }));
      }).rejects.toThrow("Source queue must be configured as a Dead Letter Queue.");
    });

    it("with invalid DestinationArn", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "invalid" }));
      }).rejects.toThrow("You must use this format to specify the DestinationArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
    });

    it("with inexisting DestinationArn", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "arn:aws:sqs:eu-west-3:123456789012:IDontExist" }));
      }).rejects.toThrow("The resource that you specified for the DestinationArn parameter doesn't exist.");
    });

    it("with same ARN", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: SourceArn }));
      }).rejects.toThrow("Source queue arn and destination queue arn cannot be the same.");
    });

    it("with invalid MaxNumberOfMessagesPerSecond (-)", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 0 }));
      }).rejects.toThrow("Value for parameter MaxNumberOfMessagesPerSecond is invalid. Reason: You must enter a number that's between 1 and 500.");
    });

    it("with invalid MaxNumberOfMessagesPerSecond (+)", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 509 }));
      }).rejects.toThrow("Value for parameter MaxNumberOfMessagesPerSecond is invalid. Reason: You must enter a number that's between 1 and 500.");
    });

    it("with empty DestinationArn", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "" }));
      }).rejects.toThrow("You must use this format to specify the DestinationArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
    });

    it("with invalid DestinationArn type (object)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: {} }));
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("with invalid DestinationArn type (array)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: [] }));
      }).rejects.toThrow("Start of list found where not expected");
    });

    it("with empty MaxNumberOfMessagesPerSecond", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: "" }));
      }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
    });

    it("with multi empty MaxNumberOfMessagesPerSecond", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: " " }));
      }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
    });

    it("with invalid MaxNumberOfMessagesPerSecond type (object)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: {} }));
      }).rejects.toThrow("Start of structure or map found where not expected.");
    });

    it("with invalid MaxNumberOfMessagesPerSecond type (array)", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: [] }));
      }).rejects.toThrow("Start of list found where not expected");
    });

    it("with invalid Source/Destination Queue Type", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "Destination.fifo", Attributes: { FifoQueue: "true" } }));
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "arn:aws:sqs:eu-west-3:123456789012:Destination.fifo" }));
      }).rejects.toThrow("The source queue and destination queue must be of the same queue type.");
    });

    it("when a Task is already running", async () => {
      await expect(async () => {
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));
      }).rejects.toThrow("There is already a task running. Only one active task is allowed for a source queue arn at a given time.");
    });
  });

  describe("Should pass", () => {
    const SourceQueueName = "PASSStartMessageMoveTask_SourceArn";
    const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

    const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn";
    const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: SourceQueueName }));

      await client.send(
        new CreateQueueCommand({
          QueueName: DestinationQueueName,
          Attributes: { VisibilityTimeout: "2", RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
        })
      );
    });

    it("return valid TaskHandle", async () => {
      const res = await client.send(new StartMessageMoveTaskCommand({ SourceArn }));

      const TaskHandle = JSON.parse(Buffer.from(res.TaskHandle!, "base64").toString("utf-8"));
      expect(TaskHandle.taskId).toBeTypeOf("string");
      expect(TaskHandle.sourceArn).toBe(SourceArn);
    });

    it(
      "by moving messages back to default Destiantion",
      async () => {
        const SourceQueueName = "PASSStartMessageMoveTask_SourceArn2";
        const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

        const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn2";
        const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

        await client.send(new CreateQueueCommand({ QueueName: SourceQueueName }));

        await client.send(
          new CreateQueueCommand({
            QueueName: DestinationQueueName,
            Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
          })
        );

        await client.send(
          new SendMessageCommand({
            QueueUrl: DestinationQueueName,
            MessageBody: "Hello, World!",
            MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
          })
        );
        await client.send(
          new ReceiveMessageCommand({
            QueueUrl: DestinationQueueName,
            VisibilityTimeout: 0,
            // @ts-ignore
            AttributeNames: ["ApproximateReceiveCount"],
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 3,
          })
        );

        const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

        expect(Attributes?.ApproximateNumberOfMessages).toBe("1");

        const res2 = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: DestinationQueueName,
          })
        );
        expect(res2.Messages).toBeUndefined();

        await client.send(new StartMessageMoveTaskCommand({ SourceArn }));

        await sleep(2);

        const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
        const { Attributes: destinationAttribs } = await client.send(
          new GetQueueAttributesCommand({ QueueUrl: DestinationQueueName, AttributeNames: ["ApproximateNumberOfMessages"] })
        );

        expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("0");
        expect(destinationAttribs?.ApproximateNumberOfMessages).toBe("1");
      },
      { timeout: 20 * 1000 }
    );

    it(
      "by moving messages to a custom Destiantion",
      async () => {
        const SourceQueueName = "PASSStartMessageMoveTask_SourceArn3";
        const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

        const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn3";
        const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

        await client.send(
          new CreateQueueCommand({
            QueueName: DestinationQueueName,
          })
        );

        await client.send(
          new CreateQueueCommand({ QueueName: SourceQueueName, Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: DestinationArn, maxReceiveCount: 2 }) } })
        );

        await client.send(
          new SendMessageCommand({
            QueueUrl: DestinationQueueName,
            MessageBody: "Hello, World!",
            MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
          })
        );

        const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

        expect(Attributes?.ApproximateNumberOfMessages).toBe("0");

        await client.send(new StartMessageMoveTaskCommand({ SourceArn: DestinationArn, DestinationArn: SourceArn }));

        await sleep(2);

        const { Attributes: destinationAttribs } = await client.send(
          new GetQueueAttributesCommand({ QueueUrl: DestinationQueueName, AttributeNames: ["ApproximateNumberOfMessages"] })
        );
        expect(destinationAttribs?.ApproximateNumberOfMessages).toBe("0");

        const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
        expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("1");
      },
      { timeout: 20 * 1000 }
    );

    it(
      "with failure (CouldNotDetermineMessageSource)",
      async () => {
        const SourceQueueName = "PASSStartMessageMoveTask_SourceArn4";
        const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

        const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn4";

        await client.send(
          new CreateQueueCommand({
            QueueName: SourceQueueName,
          })
        );

        await client.send(
          new CreateQueueCommand({ QueueName: DestinationQueueName, Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) } })
        );

        await client.send(
          new SendMessageCommand({
            QueueUrl: SourceQueueName,
            MessageBody: "Hello, World!",
            MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
          })
        );
        await sleep(1);
        const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

        expect(Attributes?.ApproximateNumberOfMessages).toBe("1");
        const MaxNumberOfMessagesPerSecond = 93;
        await client.send(new StartMessageMoveTaskCommand({ SourceArn, MaxNumberOfMessagesPerSecond }));

        await sleep(2);

        const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
        expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("1");

        const { Results } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));

        expect(Results).toHaveLength(1);

        const [task] = Results!;

        expect(task.ApproximateNumberOfMessagesMoved).toBe(0);
        expect(task.ApproximateNumberOfMessagesToMove).toBe(1);
        expect(task.FailureReason).toBe("CouldNotDetermineMessageSource");
        expect(task.MaxNumberOfMessagesPerSecond).toBe(MaxNumberOfMessagesPerSecond);
        expect(task.SourceArn).toBe(SourceArn);
        expect(new Date(task.StartedTimestamp!).getFullYear()).toBe(new Date().getFullYear()); // is valid date timestamp
        expect(task.Status).toBe("FAILED");
        expect(task.TaskHandle).toBeUndefined();
      },
      { timeout: 20 * 1000 }
    );

    it(
      "start and cancel task",
      async () => {
        const Entries: { Id: string; MessageBody: string }[] = [];

        let i = 1;

        while (i < 11) {
          Entries.push({ Id: `id-${i}`, MessageBody: `message ${i}` });
          i++;
        }

        await client.send(new SendMessageBatchCommand({ QueueUrl: SourceQueueName, Entries }));

        const { TaskHandle } = await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));

        await sleep(3);

        const { ApproximateNumberOfMessagesMoved } = await client.send(new CancelMessageMoveTaskCommand({ TaskHandle }));

        expect(ApproximateNumberOfMessagesMoved).greaterThan(1);

        const { Results } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));

        const [cancellingTask] = Results!;

        expect(["CANCELLING", "CANCELLED"]).toContain(cancellingTask.Status);
        // expect(cancellingTask.Status).toBe("CANCELLING");  depending on CPU speed / event loops we may "lose" this step
        expect(cancellingTask.SourceArn).toBe(SourceArn);
        expect(cancellingTask.DestinationArn).toBe(DestinationArn);
        expect(cancellingTask.ApproximateNumberOfMessagesToMove).toBe(10);
        await sleep(2);

        const { Results: Results2 } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));
        const [cancelledTask] = Results2!;
        expect(cancelledTask.Status).toBe("CANCELLED");
      },
      { timeout: 10 * 1000 }
    );
  });
});
