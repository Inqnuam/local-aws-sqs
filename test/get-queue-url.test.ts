import { describe, it, expect, afterAll } from "vitest";
import { GetQueueUrlCommand, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const AWS_ACCOUNT_ID = 123456789012;

const { PORT, client, server, cli } = await createServerAndCli();

describe("Get Queue Url", () => {
  afterAll(() => {
    server.close();
  });

  it("should fail to with empty queue name", async () => {
    await expect(async () => {
      const cmd = new GetQueueUrlCommand({ QueueName: "" });
      await client.send(cmd);
    }).rejects.toThrow("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
  });

  it("should fail to with invalid queue name", async () => {
    await expect(async () => {
      const cmd = new GetQueueUrlCommand({ QueueName: "InvalidName" });
      await client.send(cmd);
    }).rejects.toThrow("The specified queue does not exist.");
  });

  it("SDK", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));

    const cmd = new GetQueueUrlCommand({ QueueName });
    const res = await client.send(cmd);
    expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${QueueName}`);
  });

  it("CLI", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));
    const res = JSON.parse((await cli(`get-queue-url --queue-name ${QueueName}`)) as string);
    expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${QueueName}`);
  });
});
