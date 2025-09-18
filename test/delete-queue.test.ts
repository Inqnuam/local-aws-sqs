import { describe, it, expect, afterAll } from "vitest";
import { CreateQueueCommand, DeleteQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const { client, server } = await createServerAndCli();

describe("Delete Queue", () => {
  afterAll(() => {
    server.close();
  });

  it("should delete queue", async () => {
    const QueueName = "DeleteableQueue";
    await client.send(new CreateQueueCommand({ QueueName }));

    const res = await client.send(new DeleteQueueCommand({ QueueUrl: QueueName }));

    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  it("should fail to create a queue with in progress deleted queue", async () => {
    const QueueName = "DeleteableQueue2";
    await client.send(new CreateQueueCommand({ QueueName }));

    const res = await client.send(new DeleteQueueCommand({ QueueUrl: QueueName }));
    expect(res.$metadata.httpStatusCode).toBe(200);

    await expect(async () => {
      await client.send(new CreateQueueCommand({ QueueName }));
    }).rejects.toThrow("You must wait 60 seconds after deleting a queue before you can create another with the same name.");
  });
});
