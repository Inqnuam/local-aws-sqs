import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const { client, server, cli, PORT } = await createServerAndCli();
const AWS_ACCOUNT_ID = 123456789012;

const StandartQueueName = "MyQueue";
const FifoQueueName = "MyFifoQueue.fifo";

describe("Should List Queues", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
    await client.send(new CreateQueueCommand({ QueueName: "MyAwsomeDlq" }));
    await client.send(new CreateQueueCommand({ QueueName: "DummyQueue1" }));
    await client.send(new CreateQueueCommand({ QueueName: "DummyQueue2" }));
    await client.send(new CreateQueueCommand({ QueueName: "DummyQueue1.fifo", Attributes: { FifoQueue: "true" } }));
    await client.send(new CreateQueueCommand({ QueueName: "DummyQueue2.fifo", Attributes: { FifoQueue: "true" } }));
  });

  it("Should list created queues", async () => {
    const res = await client.send(new ListQueuesCommand());

    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.QueueUrls).deep.eq([
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${FifoQueueName}`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/MyAwsomeDlq`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1.fifo`,
      `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2.fifo`,
    ]);
  });

  it("(SDK) Should list created queues with prefix and limit", async () => {
    const res = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 1 }));

    expect(res.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`]);

    const res2 = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 1, NextToken: res.NextToken }));

    expect(res2.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${FifoQueueName}`]);

    const res3 = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 10, NextToken: res2.NextToken }));

    expect(res3.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/MyAwsomeDlq`]);

    expect(res3.NextToken).toBeUndefined();
  });

  it("(CLI) Should list created queues with prefix and limit", async () => {
    const res = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 1`)) as string);

    expect(res.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1`]);

    const res2 = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 2 --starting-token "${res.NextToken}"`)) as string);

    expect(res2.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2`, `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1.fifo`]);

    const res3 = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 10 --starting-token "${res2.NextToken}"`)) as string);
    expect(res3.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2.fifo`]);
    expect(res3.NextToken).toBeUndefined();
  });
});
