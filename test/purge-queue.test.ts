import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, PurgeQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server } = await createServerAndCli();

const StandartQueueName = randomUUID();

describe("Purge Queue", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
  });

  it("Should purge queue", async () => {
    await client.send(new PurgeQueueCommand({ QueueUrl: StandartQueueName }));
  });

  it("Should fail to purge already purged queue", async () => {
    await expect(async () => {
      await client.send(new PurgeQueueCommand({ QueueUrl: StandartQueueName }));
    }).rejects.toThrow(`Only one PurgeQueue operation on ${StandartQueueName} is allowed every 60 seconds.`);
  });
});
